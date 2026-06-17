# 🎓 Edu-Agent

> **IA agentique au service de l'éducation** — base de projet pour le hackathon.

Un agent IA conversationnel qui aide apprenant·e·s et enseignant·e·s : il explique
des concepts, construit des parcours de révision personnalisés, s'adapte au niveau,
et **cherche des ressources fiables sur le web** quand l'info peut avoir changé.

Ce n'est pas qu'un chatbot : c'est un **vrai harnais agentique** (boucle outils +
streaming) que l'équipe peut étendre.

---

## ✨ Ce qui est déjà là

- **Boucle agentique** côté serveur (`lib/agent/loop.ts`) : le modèle décide, appelle
  des outils, lit les résultats, recommence — jusqu'à avoir terminé.
- **Recherche web** intégrée (outil serveur Anthropic) — l'agent s'ancre dans des
  sources à jour.
- **Outils custom** d'exemple (`lib/agent/tools.ts`) : enregistrer / lister des plans
  de révision. C'est le point d'extension n°1 de l'équipe.
- **UI de chat en streaming** (Next.js + React) avec affichage des outils utilisés.

## 🏗️ Architecture

```
app/
├─ page.tsx              UI de chat (client) — streaming NDJSON
├─ layout.tsx
├─ globals.css
└─ api/agent/route.ts    Endpoint : lance la boucle, streame les événements
lib/agent/
├─ loop.ts               🧠 Boucle agentique (modèle ↔ outils)
├─ tools.ts              🔧 Outils custom — AJOUTEZ LES VÔTRES ICI
└─ system-prompt.ts      📜 Personnalité + consignes pédagogiques de l'agent
```

Modèle par défaut : **`claude-opus-4-8`** (configurable via `ANTHROPIC_MODEL`).

## 🚀 Démarrage

**Prérequis** : Node.js 18+ et une clé API Anthropic.

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer la clé API
cp .env.example .env.local
# puis éditez .env.local et collez votre ANTHROPIC_API_KEY

# 3. Lancer
npm run dev
```

Ouvrez http://localhost:3000.

> 🔑 La clé API se met **dans `.env.local`** (git-ignoré). Ne committez jamais de clé.

## 🧩 Étendre l'agent — ajouter un outil

Tout se passe dans `lib/agent/tools.ts` :

1. Ajoutez une définition dans `customTools` (nom, **description prescriptive**, schéma).
2. Ajoutez un `case` dans `executeTool` qui exécute l'action et renvoie un `string`.

La boucle (`loop.ts`) gère automatiquement l'appel, l'exécution et le retour au modèle.

Idées d'outils selon votre angle :
- Tuteur : `generer_quiz`, `corriger_reponse`, `suivre_progression`
- Assistant prof : `creer_sequence_pedagogique`, `differencier_exercice`
- Orientation : `chercher_formations`, `construire_parcours`

## 📋 Pistes pour le hackathon

L'angle produit est ouvert — à décider en équipe au kickoff. Quelques directions :
le tuteur adaptatif, l'assistant enseignant (préparation/correction), l'orientation.

## 🗂️ Stack

Next.js 15 · React 19 · TypeScript · SDK Anthropic.

## 🤝 Contribuer

Voir [CONTRIBUTING.md](./CONTRIBUTING.md). En bref : une branche par feature, PR vers `main`.
