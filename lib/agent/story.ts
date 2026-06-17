import Anthropic from '@anthropic-ai/sdk';
import { ageById, type Picks, type Story } from '@/lib/story/catalog';
import { getLlmConfig, hasApiKey } from '@/lib/llm/config';
import { openaiCompleteText } from '@/lib/llm/openai';

/**
 * Génération d'une histoire éducative sur mesure.
 *
 * Le prompt (système + utilisateur) reprend la conception de la branche `react`
 * (« Fabrique à histoires ») : ingrédients imposés + consigne d'adaptation à
 * l'âge + sortie JSON stricte `{titre, paragraphes[], lecon}`.
 *
 * Tourne côté serveur, donc la clé reste secrète et il n'y a pas de souci de CORS
 * (contrairement à l'appel navigateur direct de la maquette d'origine).
 */

export interface StoryInput extends Picks {
  age: string;
}

const SYSTEM =
  'Tu es un conteur francophone spécialisé dans les histoires éducatives pour enfants. ' +
  'Tu écris des récits captivants qui enseignent une notion de manière naturelle, jamais comme un cours plaqué. ' +
  'Tu réponds toujours et uniquement en JSON valide.';

function buildUserPrompt(input: StoryInput): string {
  const age = ageById(input.age);
  const label = age?.label ?? input.age;
  const guidance = age?.guidance ?? 'Adapte le langage à un enfant.';
  return `Écris une histoire originale en français pour un enfant de la tranche d'âge « ${label} ».

Ingrédients imposés, à intégrer de façon centrale :
- Lieu : ${input.lieu}
- Personnage principal : ${input.personnage}
- Objet important : ${input.objet}
- Notion à enseigner : ${input.theme}

Consignes :
- Le personnage doit découvrir ou utiliser la notion (${input.theme}) pour résoudre un problème concret de l'intrigue.
- Donne un titre évocateur.
- Adaptation à l'âge : ${guidance}
- Le champ "lecon" explique clairement la notion pour cet âge (2 à 4 phrases), avec un exemple si pertinent.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises Markdown, au format exact :
{"titre": "…", "paragraphes": ["…", "…"], "lecon": "…"}`;
}

function parseStory(raw: string): Story {
  const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(clean);
    if (parsed && Array.isArray(parsed.paragraphes) && parsed.paragraphes.length) {
      return {
        titre: String(parsed.titre || 'Ton histoire'),
        paragraphes: parsed.paragraphes.map(String).filter(Boolean),
        lecon: String(parsed.lecon || ''),
      };
    }
  } catch {
    // pas du JSON : on retombe sur un découpage par paragraphes
  }
  const paras = clean.split(/\n\n+/).filter(Boolean);
  return { titre: 'Ton histoire', paragraphes: paras.length ? paras : [clean], lecon: '' };
}

let _anthropic: Anthropic | null = null;
function anthropicClient(baseURL: string): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ baseURL });
  return _anthropic;
}

export async function generateStory(input: StoryInput): Promise<Story> {
  const cfg = getLlmConfig();
  if (!hasApiKey(cfg)) {
    throw new Error('NO_API_KEY');
  }
  const user = buildUserPrompt(input);

  if (cfg.provider === 'openai') {
    const text = await openaiCompleteText({
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey!,
      model: cfg.storyModel,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      jsonMode: true,
      maxTokens: 1400,
    });
    return parseStory(text);
  }

  const client = anthropicClient(cfg.baseURL);
  const msg = await client.messages.create({
    model: cfg.storyModel,
    max_tokens: 1400,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return parseStory(text);
}
