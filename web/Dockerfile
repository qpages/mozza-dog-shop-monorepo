# Build from monorepo root:
#   docker build -f web/Dockerfile --build-arg PUBLIC_API_URL=https://api.example.com -t mozza-web .
#
# Coolify: Base Directory = / (repo root), Dockerfile = web/Dockerfile
# Set build arg PUBLIC_API_URL to the public API URL (baked at build time).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app
ENV HUSKY=0
ENV CI=true

FROM base AS build
ARG PUBLIC_API_URL=http://localhost:8787
ENV PUBLIC_API_URL=$PUBLIC_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile --filter web...
COPY web ./web
RUN pnpm --filter web build

FROM nginx:1.27-alpine AS runner
COPY deploy/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
