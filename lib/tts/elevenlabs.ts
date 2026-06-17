/**
 * Lecture à voix haute (text-to-speech) via ElevenLabs.
 *
 * Tourne côté serveur uniquement : la clé `ELEVENLABS_API_KEY` n'est jamais
 * exposée au navigateur (contrairement à la maquette d'origine en mono-fichier).
 *
 * La voix par défaut « Sarah » et le modèle `eleven_multilingual_v2` ont été
 * choisis car ils fonctionnent sur un compte ElevenLabs gratuit et rendent
 * correctement le français. Tout est surchargé par variables d'environnement.
 */

import type { Story } from '@/lib/story/catalog';

export interface TtsConfig {
  apiKey: string | undefined;
  voiceId: string;
  modelId: string;
  baseURL: string;
}

export function getTtsConfig(): TtsConfig {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY,
    // « Sarah » — voix douce, disponible en plan gratuit via l'API.
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    baseURL: (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/+$/, ''),
  };
}

export function hasTtsKey(cfg = getTtsConfig()): boolean {
  return Boolean(cfg.apiKey && cfg.apiKey.trim() && !cfg.apiKey.includes('...'));
}

/** Message d'aide affiché quand aucune clé ElevenLabs n'est configurée. */
export function missingTtsKeyMessage(): string {
  return (
    "🔊 Lecture à voix haute indisponible : aucune clé ElevenLabs détectée. " +
    'Ajoutez `ELEVENLABS_API_KEY` dans `.env.local`, puis relancez `npm run dev`.'
  );
}

/** Compose le texte à lire à partir d'une histoire : titre, récit, puis leçon. */
export function storyToNarration(story: Story): string {
  return [
    story.titre,
    ...story.paragraphes,
    story.lecon ? `Ce que tu as appris : ${story.lecon}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Appelle ElevenLabs et renvoie l'audio MP3. Lève une erreur explicite en cas d'échec. */
export async function synthesize(text: string): Promise<ArrayBuffer> {
  const cfg = getTtsConfig();
  if (!hasTtsKey(cfg)) throw new Error('NO_TTS_KEY');

  const res = await fetch(`${cfg.baseURL}/v1/text-to-speech/${cfg.voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': cfg.apiKey!,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: cfg.modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = (await res.json()) as { detail?: { message?: string } | string };
      detail =
        typeof j.detail === 'string' ? j.detail : j.detail?.message || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`ElevenLabs HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
  }

  return res.arrayBuffer();
}
