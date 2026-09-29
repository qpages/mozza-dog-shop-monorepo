# Mozza Dog Shop — photos

Monorepo du sous-domaine photos. Les clients récupèrent les clichés de leur shooting. Le photographe gère les fiches depuis `/admin`.

Deux apps : `web` (Astro) et `api` (Fastify).

## Prérequis

- Node.js 22.12 ou plus
- pnpm 10.15.1 (`corepack enable`)

## Démarrer

Postgres et Garage (S3 local) passent par Docker Compose, **dev uniquement** :

```bash
pnpm install
cp api/.env.example api/.env
cp web/.env.example web/.env
pnpm db:up
pnpm dev
```

`pnpm db:stop` / `pnpm db:down` pour arrêter les conteneurs. Voir `technical.md` (section Exploitation) pour la prod.

- Web : http://localhost:4321
- API : http://localhost:8787

Le compte admin local se règle dans `api/.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Ce fichier n’est pas versionné. Le seed ne tourne pas quand `NODE_ENV` vaut `production`.

## Scripts

| Commande            | Rôle                                        |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | Web et API en parallèle                     |
| `pnpm lint`         | ESLint                                      |
| `pnpm format:check` | Prettier                                    |
| `pnpm typecheck`    | `tsc --noEmit` (API) et `astro check` (web) |
| `pnpm build`        | Build des deux apps                         |
