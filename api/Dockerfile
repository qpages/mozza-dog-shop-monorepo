# Build from monorepo root:
#   docker build -f api/Dockerfile -t mozza-api .
#
# Coolify: Base Directory = / (repo root), Dockerfile = api/Dockerfile
# Runtime: DATABASE_URL is injected by Coolify. Entry point applies pending
# Drizzle SQL migrations then execs the API. Seed stays manual
# (node dist/admin/seed.js). Thumbnails for photos already stored stay manual
# (node dist/shooting/backfill-thumbnails.js).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app
ENV HUSKY=0
ENV CI=true

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile --filter api...
COPY api ./api
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /out

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

RUN addgroup -S mozza && adduser -S mozza -G mozza
COPY --from=build --chown=mozza:mozza /out ./
COPY --from=build --chown=mozza:mozza /app/api/drizzle ./drizzle
COPY --from=build --chmod=755 --chown=mozza:mozza /app/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN node --input-type=module -e "await import('sharp')"

USER mozza
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
