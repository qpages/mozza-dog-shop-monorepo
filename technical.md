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

## Authentification

### Espace client (owner)

Quiconque connaît l'email du participant peut lister ses shootings non archivés et obtenir des URLs présignées vers les fichiers.

C'est **assumé et voulu** pour ce produit : simplicité côté client au détriment d'une authentification forte. Ce n'est ni un oubli de sécurité ni une compromission du backoffice.

### Espace admin

- Session JWT (cookie), mot de passe, routes `/admin/*` protégées. C'est l'accès fort réservé au photographe et à la gestion métier.

## Exploitation (prod)

Variables API validées au démarrage dans `api/src/app.ts` :

- **`JWT_SECRET`** (obligatoire, ≥ 16 caractères) : secret de signature des cookies admin. En prod, utiliser une valeur longue et aléatoire (générateur de mots de passe ou `openssl rand -base64 32`), jamais la valeur d'exemple de `api/.env.example`.
- **`WEB_ORIGIN`** (défaut dev : `http://localhost:4321`) : origines CORS exactes autorisées pour l'API, séparées par des virgules. En dev (`NODE_ENV` ≠ `production`), les origines LAN / Docker (`192.168.x`, `10.x`, `127.x`, `172.16–31.x`) sont aussi acceptées.
- **`DATABASE_URL`** : Postgres managé côté hébergeur (Coolify, etc.), pas le conteneur du `docker-compose.yml`. Le boot API et `pnpm db:migrate` passent par le même runner (`api/src/migrate.ts`) sur `api/drizzle/`. Échec migrate → exit non-zéro. Seed admin manuel (`node dist/admin/seed.js`).
- **`SLACK_WEBHOOK_URL`** (optionnel) : incoming webhook Slack. Un événement owner nouvellement enregistré poste un message. Les erreurs HTTP des routes connues (4xx et 5xx) aussi, ainsi qu'un ZIP ou un enregistrement d'événement qui échoue après la réponse. La même route et le même message repartent au plus une fois par minute. Vide en local : l'API démarre et n'envoie rien.
- **Stockage objet** : Cloudflare R2 (`R2_ACCOUNT_ID`, clés, bucket). Laisser `R2_ENDPOINT` vide en prod ; l'API ne modifie jamais la configuration du bucket R2. La policy CORS versionnée dans `deploy/r2-cors.json` doit être appliquée dans R2 → bucket → Settings → CORS Policy. Le wildcard `https://*.quentinpages.dev` couvre les previews sur le domaine maîtrisé. L'origine Coolify `sslip.io` est temporaire et doit rester exacte ; mettre à jour la policy si elle change. Garage est réservé au dev local et sa policy CORS est restaurée automatiquement quand `R2_ENDPOINT` est défini.

### Docker Compose

`docker-compose.yml` sert **uniquement au dev local** (`pnpm db:up`). Postgres et Garage y ont des identifiants factices versionnés ; les ports sont publiés sur `127.0.0.1` pour que l'API sur l'hôte puisse s'y connecter sans les exposer sur l'interface publique du serveur.

Ne pas déployer ce fichier sur un VPS : en prod, pas de Postgres/Garage dans Compose ; services managés + secrets dans l'environnement Coolify (ou équivalent).
