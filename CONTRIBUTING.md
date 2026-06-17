# Contribuer — workflow d'équipe

Court et efficace, pour un hackathon.

## Mise en route

```bash
git clone <url-du-repo>
cd edu-agent
npm install
cp .env.example .env.local   # collez votre clé API
npm run dev
```

## Workflow Git

- `main` reste toujours fonctionnelle.
- Une **branche par feature** : `git checkout -b feature/quiz-generator`
- Commits petits et fréquents.
- Ouvrez une **Pull Request** vers `main` ; un·e autre membre relit puis merge.

## Se répartir le travail

Le code est découpé pour bosser en parallèle sans se marcher dessus :

| Zone | Fichier | Pour qui |
|------|---------|----------|
| Outils de l'agent | `lib/agent/tools.ts` | Backend / logique métier |
| Comportement de l'agent | `lib/agent/system-prompt.ts` | Prompt / pédagogie |
| Boucle agentique | `lib/agent/loop.ts` | Backend (touchez avec prudence) |
| Interface | `app/page.tsx`, `app/globals.css` | Frontend |

## Conventions

- TypeScript partout, pas de `any` non justifié.
- Les outils renvoient toujours une `string` (souvent du JSON).
- Jamais de clé API committée — tout dans `.env.local`.
