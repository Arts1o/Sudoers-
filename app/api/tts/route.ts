import {
  hasTtsKey,
  missingTtsKeyMessage,
  storyToNarration,
  synthesize,
} from '@/lib/tts/elevenlabs';
import type { Story } from '@/lib/story/catalog';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface TtsBody {
  text?: string;
  story?: Story;
}

export async function POST(req: Request) {
  let body: TtsBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: 'Corps de requête invalide.' }, { status: 400 });
  }

  const text =
    (body.text && body.text.trim()) || (body.story && storyToNarration(body.story)) || '';
  if (!text.trim()) {
    return Response.json({ ok: false, message: 'Aucun texte à lire.' }, { status: 400 });
  }

  // Pas de clé : on répond 200 + message (l'UI dégrade proprement, comme /api/story).
  if (!hasTtsKey()) {
    return Response.json({ ok: false, message: missingTtsKeyMessage() }, { status: 200 });
  }

  try {
    const audio = await synthesize(text);
    return new Response(audio, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { ok: false, message: `La lecture à voix haute a échoué : ${message}` },
      { status: 200 },
    );
  }
}
