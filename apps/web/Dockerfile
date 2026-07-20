# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@^2 prune @morpheus/web --docker

FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable

COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @morpheus/web build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 morpheus

COPY --from=installer --chown=morpheus:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=morpheus:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=morpheus:nodejs /app/apps/web/public ./apps/web/public

USER morpheus
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
