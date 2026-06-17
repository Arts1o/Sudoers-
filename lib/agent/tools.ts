import type Anthropic from '@anthropic-ai/sdk';

/**
 * Outils custom (exécutés côté serveur, par NOUS).
 *
 * C'est ici que votre équipe ajoute les capacités de l'agent. Chaque outil =
 *   1. une définition (nom + description + schéma d'entrée) dans `customTools`
 *   2. un cas dans `executeTool` qui exécute l'action et renvoie un résultat (string).
 *
 * La description est CRUCIALE : le modèle s'en sert pour décider quand appeler
 * l'outil. Soyez prescriptifs ("Utilise ceci quand…").
 *
 * Les deux outils ci-dessous (plan de révision + relecture) sont des exemples
 * volontairement simples et hors-ligne : ils démontrent l'écriture et la
 * lecture d'un état. Remplacez le stockage en mémoire par une vraie base
 * (Supabase, Postgres…) quand vous serez prêts.
 */

export const customTools: Anthropic.Tool[] = [
  {
    name: 'save_study_plan',
    description:
      "Enregistre un plan de révision personnalisé pour un·e apprenant·e. Utilise cet outil dès que l'utilisateur veut réviser, s'entraîner, ou se fixer des objectifs d'apprentissage, afin de garder une trace structurée et un suivi.",
    input_schema: {
      type: 'object',
      properties: {
        learner: { type: 'string', description: "Nom ou identifiant de l'apprenant·e" },
        topic: { type: 'string', description: 'Sujet ou matière à réviser' },
        level: {
          type: 'string',
          enum: ['primaire', 'collège', 'lycée', 'supérieur', 'adulte'],
          description: 'Niveau scolaire',
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Étapes concrètes du plan de révision, dans l\'ordre',
        },
      },
      required: ['learner', 'topic', 'steps'],
    },
  },
  {
    name: 'list_study_plans',
    description:
      "Liste les plans de révision déjà enregistrés (optionnellement filtrés par apprenant·e). Utilise cet outil pour reprendre un suivi, faire le point sur la progression, ou éviter de recréer un plan existant.",
    input_schema: {
      type: 'object',
      properties: {
        learner: {
          type: 'string',
          description: "Filtrer par apprenant·e (laisser vide pour tout lister)",
        },
      },
    },
  },
];

// --- Stockage en mémoire (démo). Réinitialisé à chaque redémarrage serveur. ---
interface StudyPlan {
  id: string;
  learner: string;
  topic: string;
  level?: string;
  steps: string[];
  createdAt: string;
}

const studyPlans: StudyPlan[] = [];
let nextId = 1;

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'save_study_plan': {
      const plan: StudyPlan = {
        id: `plan_${nextId++}`,
        learner: String(input.learner),
        topic: String(input.topic),
        level: input.level ? String(input.level) : undefined,
        steps: Array.isArray(input.steps) ? input.steps.map(String) : [],
        createdAt: new Date().toISOString(),
      };
      studyPlans.push(plan);
      return JSON.stringify({ ok: true, plan });
    }

    case 'list_study_plans': {
      const learner = input.learner ? String(input.learner) : undefined;
      const result = learner
        ? studyPlans.filter((p) => p.learner === learner)
        : studyPlans;
      return JSON.stringify({ ok: true, count: result.length, plans: result });
    }

    default:
      return JSON.stringify({ ok: false, error: `Outil inconnu : ${name}` });
  }
}
