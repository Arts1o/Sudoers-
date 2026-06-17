import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt';
import { customTools, executeTool } from './tools';
import { getLlmConfig, hasApiKey, missingKeyMessage } from '@/lib/llm/config';
import { openaiStreamChat, type ChatMessage } from '@/lib/llm/openai';

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface RunOptions {
  /** Contexte additionnel (ex. l'histoire composée) ajouté au prompt système. */
  context?: string;
}

// Outil serveur Anthropic : recherche web. Exécuté par Anthropic, pas par nous.
// (cast `as any` : le type littéral n'est pas encore dans les types publics du SDK)
const webSearchTool = { type: 'web_search_20260209', name: 'web_search' } as any;

const MAX_STEPS = 12; // garde-fou contre les boucles infinies

function buildSystem(context?: string): string {
  if (!context) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n## Contexte de la session\n${context}`;
}

let _client: Anthropic | null = null;
function getClient(baseURL: string): Anthropic {
  if (!_client) _client = new Anthropic({ baseURL }); // lit ANTHROPIC_API_KEY depuis l'env
  return _client;
}

/**
 * Boucle de chat. Sur Anthropic : boucle agentique complète (recherche web +
 * outils custom). Sur fournisseur compatible OpenAI : streaming simple.
 * Chaque morceau de texte / appel d'outil est poussé via `emit`.
 */
export async function runAgent(
  messages: Anthropic.MessageParam[],
  emit: (event: AgentEvent) => void,
  opts: RunOptions = {},
): Promise<void> {
  const cfg = getLlmConfig();

  if (!hasApiKey(cfg)) {
    emit({ type: 'text', text: missingKeyMessage(cfg) });
    emit({ type: 'done' });
    return;
  }

  const system = buildSystem(opts.context);

  // --- Voie compatible OpenAI : chat en streaming, sans outils serveur. ---
  if (cfg.provider === 'openai') {
    await openaiStreamChat(
      {
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey!,
        model: cfg.model,
        system,
        messages: messages as unknown as ChatMessage[],
      },
      (delta) => emit({ type: 'text', text: delta }),
    );
    emit({ type: 'done' });
    return;
  }

  // --- Voie Anthropic : boucle agentique. ---
  const client = getClient(cfg.baseURL);
  const working: Anthropic.MessageParam[] = [...messages];
  const tools = [webSearchTool, ...customTools];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream({
      model: cfg.model,
      max_tokens: 4096,
      system,
      tools,
      messages: working,
    });

    stream.on('text', (delta) => emit({ type: 'text', text: delta }));

    const final = await stream.finalMessage();

    // La recherche web a atteint sa limite d'itérations : on relance pour continuer.
    if (final.stop_reason === 'pause_turn') {
      working.push({ role: 'assistant', content: final.content });
      continue;
    }

    // L'agent veut appeler un de NOS outils custom.
    if (final.stop_reason === 'tool_use') {
      working.push({ role: 'assistant', content: final.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of final.content) {
        if (block.type === 'tool_use') {
          emit({ type: 'tool', name: block.name });
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
          );
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      working.push({ role: 'user', content: toolResults });
      continue;
    }

    if (final.stop_reason === 'refusal') {
      emit({
        type: 'text',
        text: '\n\n_(Requête refusée pour des raisons de sécurité.)_',
      });
    }

    // end_turn / max_tokens / stop_sequence → terminé.
    break;
  }

  emit({ type: 'done' });
}
