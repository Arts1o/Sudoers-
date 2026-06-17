import type Anthropic from '@anthropic-ai/sdk';
import { runAgent, type AgentEvent } from '@/lib/agent/loop';

export const runtime = 'nodejs';
export const maxDuration = 300; // l'agent peut prendre du temps (recherche web + raisonnement)

export async function POST(req: Request) {
  let body: { messages?: Anthropic.MessageParam[] };
  try {
    body = await req.json();
  } catch {
    return new Response('Corps de requête invalide', { status: 400 });
  }

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('`messages` est requis', { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, e: AgentEvent) =>
    controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));

  // Streaming NDJSON : une ligne JSON par événement.
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runAgent(messages, (e) => send(controller, e));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(controller, { type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
