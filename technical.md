## Brief

Mozza Dog Shop, shop et café

Cette app monorepo est le sous-domaine photos.mozzadog.com.

Elle sert à récupérer les photos des shootings clients avec leurs chiens. Les clients retrouvent leurs clichés. Le photographe crée les fiches maîtres et uploade les photos depuis le backoffice.

La landing du shop existe déjà ailleurs.

## Technical requirements

monorepo pnpm

- Astro (https://docs.astro.build/en/getting-started/)
- Fastify (https://fastify.dev/docs/latest/Guides/Getting-Started/)
- Tailwindcss (https://tailwindcss.com/docs/installation/using-vite)
- Shadcn (https://ui.shadcn.com/docs/installation/astro)

prettier, eslint, conventional commits

lint and format before commit

latest dependencies + security updates

## Domain

Deux modules, pas plus.

- `shooting` est l'agrégat. Le chien et la photo en font partie. Pas de dossier `dog/` ni `photo/`.
- `admin` est l'accès (session, mot de passe, seed). Il n'est pas le métier.
- Le schéma de l'agrégat tient dans un fichier. Pas de couche repository ni use-case : les routes Fastify du module parlent à Drizzle.
- `db.ts` et `storage.ts` restent hors des modules. Le stockage objet n'est pas nommé d'après le fournisseur dans le domaine.
- Le web nomme les écrans métier (`owner-photos`). `pages/` suit les URLs. `components/ui/` reste le kit.
- Le texte visible n'utilise ni le point (`.`), ni le point médian (`·`), ni le tiret (`-`, `–`, `—`) comme séparateur. Relier avec des mots : « Archivé le 26 septembre 2026 ».
