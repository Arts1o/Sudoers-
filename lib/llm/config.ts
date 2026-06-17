/**
 * Configuration du fournisseur de modèle — « Claude ou autre ».
 *
 * Deux familles supportées, choisies par `LLM_PROVIDER` :
 *   - `anthropic` (défaut) : Claude, avec boucle agentique complète
 *      (recherche web + outils custom).
 *   - `openai` : tout endpoint compatible OpenAI (OpenAI, OpenRouter, Mistral,
 *      Groq, vLLM, Ollama en local…). Chat en streaming simple, sans outils
 *      serveur. Idéal pour une démo gratuite / locale.
 *
 * Toutes les clés sont lues côté serveur uniquement (jamais exposées au client).
 * Rétro-compatible avec l'ancien `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`.
 */

export type Provider = 'anthropic' | 'openai';

export interface LlmConfig {
  provider: Provider;
  /** Modèle pour le chat agentique / conversation. */
  model: string;
  /** Modèle pour la génération d'histoire (peut être plus rapide/moins cher). */
  storyModel: string;
  apiKey: string | undefined;
  /** Base URL (endpoints compatibles OpenAI). Ignoré pour Anthropic. */
  baseURL: string;
  /** Libellé lisible pour les messages d'erreur. */
  label: string;
}

function pickProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER || '').toLowerCase().trim();
  if (raw === 'openai' || raw === 'openai-compatible' || raw === 'compatible') {
    return 'openai';
  }
  return 'anthropic';
}

export function getLlmConfig(): LlmConfig {
  const provider = pickProvider();

  if (provider === 'openai') {
    return {
      provider,
      model:
        process.env.LLM_MODEL ||
        process.env.OPENAI_MODEL ||
        'gpt-4o-mini',
      storyModel:
        process.env.STORY_MODEL ||
        process.env.LLM_MODEL ||
        process.env.OPENAI_MODEL ||
        'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY,
      baseURL: (
        process.env.OPENAI_BASE_URL ||
        process.env.LLM_BASE_URL ||
        'https://api.openai.com/v1'
      ).replace(/\/+$/, ''),
      label: 'OpenAI-compatible',
    };
  }

  // Anthropic (défaut)
  return {
    provider,
    model:
      process.env.LLM_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      'claude-opus-4-8',
    storyModel:
      process.env.STORY_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(
      /\/+$/,
      '',
    ),
    label: 'Anthropic (Claude)',
  };
}

export function hasApiKey(cfg = getLlmConfig()): boolean {
  return Boolean(cfg.apiKey && cfg.apiKey.trim() && !cfg.apiKey.includes('...'));
}

/** Message d'aide affiché quand aucune clé n'est configurée. */
export function missingKeyMessage(cfg = getLlmConfig()): string {
  if (cfg.provider === 'openai') {
    return (
      "🔑 Aucune clé détectée pour le fournisseur compatible OpenAI. " +
      'Dans `.env.local`, renseignez `OPENAI_API_KEY` (et au besoin ' +
      '`OPENAI_BASE_URL` pour OpenRouter / Mistral / un modèle local), ' +
      'puis relancez `npm run dev`.'
    );
  }
  return (
    "🔑 Aucune clé API détectée. Copiez `.env.example` vers `.env.local` " +
    'et renseignez `ANTHROPIC_API_KEY` ' +
    '(https://console.anthropic.com/settings/keys), puis relancez `npm run dev`. ' +
    'Pour utiliser un autre fournisseur, mettez `LLM_PROVIDER=openai`.'
  );
}
