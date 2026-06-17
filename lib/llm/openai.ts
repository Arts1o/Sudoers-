/**
 * Adaptateur compatible OpenAI (sans SDK, via `fetch`).
 *
 * Fonctionne avec tout endpoint exposant `/chat/completions` au format OpenAI :
 * OpenAI, OpenRouter, Mistral, Groq, Together, vLLM, Ollama (`/v1`)…
 *
 * Volontairement minimal : pas d'outils serveur ni de recherche web (réservés à
 * la voie Anthropic). On gère le texte et les images ; les autres pièces jointes
 * sont aplaties en note textuelle.
 */

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: string; data: string };
      title?: string;
    }
  | { type: string; [k: string]: unknown };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface OpenAIPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

function blockToParts(block: ContentBlock): OpenAIPart[] {
  if (block.type === 'text' && typeof (block as { text?: string }).text === 'string') {
    return [{ type: 'text', text: (block as { text: string }).text }];
  }
  if (block.type === 'image') {
    const src = (block as Extract<ContentBlock, { type: 'image' }>).source;
    return [
      { type: 'image_url', image_url: { url: `data:${src.media_type};base64,${src.data}` } },
    ];
  }
  if (block.type === 'document') {
    const doc = block as Extract<ContentBlock, { type: 'document' }>;
    return [
      {
        type: 'text',
        text: `[Pièce jointe : ${doc.title || 'document'} (${doc.source.media_type}). Décris ou exploite-la si l'utilisateur le demande.)]`,
      },
    ];
  }
  return [];
}

function toOpenAIMessages(
  system: string,
  messages: ChatMessage[],
): Array<{ role: string; content: string | OpenAIPart[] }> {
  const out: Array<{ role: string; content: string | OpenAIPart[] }> = [
    { role: 'system', content: system },
  ];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const parts = m.content.flatMap(blockToParts);
    if (m.role === 'assistant') {
      // L'API n'accepte pas d'images dans un message assistant : on concatène le texte.
      const text = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      out.push({ role: 'assistant', content: text });
    } else {
      out.push({ role: 'user', content: parts.length ? parts : '' });
    }
  }
  return out;
}

interface OpenAIArgs {
  baseURL: string;
  apiKey: string;
  model: string;
  system: string;
}

/** Complétion non-streamée — renvoie le texte brut concaténé. */
export async function openaiCompleteText(
  args: OpenAIArgs & { messages: ChatMessage[]; jsonMode?: boolean; maxTokens?: number },
): Promise<string> {
  const res = await fetch(`${args.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens ?? 1200,
      messages: toOpenAIMessages(args.system, args.messages),
      ...(args.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} (${args.model}) ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/** Chat en streaming SSE — appelle `onText` à chaque fragment. */
export async function openaiStreamChat(
  args: OpenAIArgs & { messages: ChatMessage[] },
  onText: (delta: string) => void,
): Promise<void> {
  const res = await fetch(`${args.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 2048,
      stream: true,
      messages: toOpenAIMessages(args.system, args.messages),
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} (${args.model}) ${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) onText(delta);
      } catch {
        // fragment SSE incomplet : ignoré (sera complété au tour suivant)
      }
    }
  }
}
