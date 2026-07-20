# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1) builder: usa `turbo prune` para extrair apenas o subgrafo de pacotes de
#    que @morpheus/api depende (evita copiar apps/web para dentro da imagem).
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@^2 prune @morpheus/api --docker

# ---------------------------------------------------------------------------
# 2) installer: instala dependências a partir do lockfile podado (camada
#    cacheável) e então builda o pacote de database (gera o Prisma Client)
#    e a API.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN corepack enable

COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm --filter @morpheus/database build
RUN pnpm --filter @morpheus/api build

# ---------------------------------------------------------------------------
# 3) runner: imagem final enxuta, roda como usuário não-root.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 morpheus

COPY --from=installer --chown=morpheus:nodejs /app .

USER morpheus
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
