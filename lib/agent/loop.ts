import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt';
import { customTools, executeTool } from './tools';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

// Client construit paresseusement : sans ANTHROPIC_API_KEY, le SDK lève une
// erreur dès la construction. On l'évite pour pouvoir afficher un message clair.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic(); // lit ANTHROPIC_API_KEY depuis l'env
  return _client;
}

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

// Outil serveur Anthropic : recherche web. Exécuté par Anthropic, pas par nous.
// (cast `as any` : le type littéral n'est pas encore dans les types publics du SDK)
const webSearchTool = { type: 'web_search_20260209', name: 'web_search' } as any;

const MAX_STEPS = 12; // garde-fou contre les boucles infinies

/**
 * Boucle agentique : appelle le modèle en streaming, exécute les outils
 * demandés, et recommence jusqu'à ce que l'agent ait fini (`end_turn`).
 * Chaque morceau de texte / appel d'outil est poussé via `emit`.
 */
export async function runAgent(
  messages: Anthropic.MessageParam[],
  emit: (event: AgentEvent) => void,
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    emit({
      type: 'text',
      text:
        "🔑 Aucune clé API détectée. Copiez `.env.example` vers `.env.local` " +
        'et renseignez `ANTHROPIC_API_KEY` (https://console.anthropic.com/settings/keys), ' +
        'puis relancez `npm run dev`.',
    });
    emit({ type: 'done' });
    return;
  }

  const client = getClient();
  const working: Anthropic.MessageParam[] = [...messages];
  const tools = [webSearchTool, ...customTools];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: working,
    });

    // Diffuse le texte token par token vers le client.
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
