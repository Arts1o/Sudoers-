# 🎓 Edu-Agent — Fabrique à histoires

> **IA agentique au service de l'éducation** — projet de hackathon.

Un compagnon d'apprentissage pour enfants. Le parcours se fait en deux temps :

1. **Fabrique à histoires** — l'enfant choisit son âge et compose un conte
   (lieu, personnage, objet, **notion à apprendre**). Le modèle écrit une
   histoire originale sur mesure qui enseigne la notion en douceur, rendue sur
   une page de conte (lettrine + encart « ce que tu as appris »).
2. **Chat avec Lumi** — l'enfant continue la conversation : il pose des
   questions, demande des exercices, et peut **injecter du texte, des fichiers
   et des images** (un dessin, un exercice photographié). Lumi s'adapte à l'âge
   et à la notion de l'histoire.

Sous le capot, un **vrai harnais agentique** (boucle outils + streaming) que
l'équipe peut étendre, **connectable à Claude ou à tout fournisseur compatible
OpenAI** (OpenRouter, Mistral, Groq, modèle local Ollama…).

---

## ✨ Ce qui est là

- **Fabrique à histoires** (`components/StoryStudio.tsx` + `app/api/story`) :
  profilage par l'âge (4 tranches, chacune avec sa consigne d'écriture) et 4
  ingrédients. Génération côté serveur → JSON `{titre, paragraphes[], lecon}`.
- **Chat en streaming** (`components/Chat.tsx` + `app/api/agent`) avec
  **pièces jointes** (image en base64, PDF, fichiers texte) et affichage des
  outils utilisés.
- **Boucle agentique** (`lib/agent/loop.ts`) : sur Claude, recherche web +
  outils custom ; sur fournisseur compatible OpenAI, chat en streaming simple.
- **Couche fournisseur** (`lib/llm/`) : « Claude ou autre », piloté par l'env.
- **Outils custom** d'exemple (`lib/agent/tools.ts`) : plans de révision.
  C'est le point d'extension n°1 de l'équipe.

## 🏗️ Architecture

```
app/
├─ page.tsx               Orchestrateur : Studio → Chat
├─ layout.tsx             Polices (Fraunces + Nunito)
├─ globals.css            Design system « histoire du soir »
├─ api/story/route.ts     Génère une histoire {titre, paragraphes, lecon}
└─ api/agent/route.ts     Chat : lance la boucle, streame les événements (NDJSON)
components/
├─ StoryStudio.tsx        🎨 Fabrique à histoires (âge + ingrédients)
├─ Chat.tsx               💬 Chat + pièces jointes (texte / image / fichier)
└─ chat-parts.tsx         Types, helpers fichiers, mascotte Lumi
lib/
├─ story/catalog.ts       Âges (+ consignes) et ingrédients — partagé client/serveur
├─ agent/story.ts         🪄 Génération d'histoire (provider-aware)
├─ agent/loop.ts          🧠 Boucle de chat (Claude agentique / OpenAI simple)
├─ agent/tools.ts         🔧 Outils custom — AJOUTEZ LES VÔTRES ICI
├─ agent/system-prompt.ts 📜 Persona « Lumi » + consignes pédagogiques
└─ llm/{config,openai}.ts ⚙️ Sélection du fournisseur + adaptateur OpenAI
```

## 🚀 Démarrage

**Prérequis** : Node.js 18+ et une clé API (Anthropic, ou un fournisseur
compatible OpenAI).

```bash
npm install
cp .env.example .env.local   # puis renseignez votre clé
npm run dev
```

Ouvrez http://localhost:3000.

## 🔌 Connecter le modèle — « Claude ou autre »

Tout se configure dans `.env.local` (voir `.env.example`) :

**Claude (défaut)** — boucle agentique complète (recherche web + outils) :
```bash
ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-opus-4-8   # optionnel
```

**Compatible OpenAI** — OpenAI, OpenRouter, Mistral, Groq, vLLM, Ollama (local) :
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # ou OpenRouter / Ollama…
OPENAI_MODEL=gpt-4o-mini
```
> Sur cette voie, le chat est en streaming simple (sans recherche web ni outils
> serveur, réservés à Claude). La génération d'histoire fonctionne sur les deux.

Les clés sont lues **côté serveur uniquement** : jamais exposées au navigateur,
et pas de souci de CORS (contrairement à un appel direct depuis le client).

## 🧩 Étendre l'agent — ajouter un outil

Tout se passe dans `lib/agent/tools.ts` (voie Claude) :

1. Ajoutez une définition dans `customTools` (nom, **description prescriptive**, schéma).
2. Ajoutez un `case` dans `executeTool` qui exécute l'action et renvoie un `string`.

Idées : `generer_quiz`, `corriger_reponse`, `suivre_progression`,
`creer_sequence_pedagogique`…

## 🗂️ Stack

Next.js 15 · React 19 · TypeScript · SDK Anthropic · API compatible OpenAI (via `fetch`).

## 🤝 Contribuer

Voir [CONTRIBUTING.md](./CONTRIBUTING.md). En bref : une branche par feature, PR vers `main`.
