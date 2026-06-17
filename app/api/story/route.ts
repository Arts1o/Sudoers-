import { generateStory, type StoryInput } from '@/lib/agent/story';
import { getLlmConfig, missingKeyMessage } from '@/lib/llm/config';

export const runtime = 'nodejs';
export const maxDuration = 120;

function isValid(body: Partial<StoryInput>): body is StoryInput {
  return Boolean(body.age && body.lieu && body.personnage && body.objet && body.theme);
}

export async function POST(req: Request) {
  let body: Partial<StoryInput>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: 'Corps de requête invalide.' }, { status: 400 });
  }

  if (!isValid(body)) {
    return Response.json(
      { ok: false, message: 'Champs requis : age, lieu, personnage, objet, theme.' },
      { status: 400 },
    );
  }

  try {
    const story = await generateStory(body);
    return Response.json({ ok: true, story });
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_API_KEY') {
      return Response.json({ ok: false, message: missingKeyMessage(getLlmConfig()) }, { status: 200 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { ok: false, message: `La création de l'histoire a échoué : ${message}` },
      { status: 200 },
    );
  }
}
