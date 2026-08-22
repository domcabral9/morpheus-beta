# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Morpheus is an educational/portfolio project (not production software, not a commercial product):
a full-stack risk-homologation platform for company-adopted software and the vendors behind it, from
a weighted risk questionnaire through a configurable approval workflow to a deterministic PDF
technical opinion. Built solo, entirely through AI pair-programming with Claude Code.

## Canonical docs (read before non-trivial work, don't duplicate their content elsewhere)

- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) - stack, monorepo layout, every command, the full
  PR/merge workflow (including two easy-to-miss rules: merge the oldest open PR first regardless of
  which CI finishes sooner, and never stack a PR on another unmerged PR's branch without retargeting
  it to `main` before deleting that base branch - GitHub silently closes it unmerged otherwise), and
  known dev-environment gotchas (the API dev server can die silently between sessions; a stale
  Turbopack cache can 404 a route that really exists).
- [`docs/security.md`](./docs/security.md) - SSDLC process, weekly Dependabot review cadence, and a
  checklist for a real recurring risk pattern in this project: a dependency's CLI output promoting an
  unrelated third-party product (potential supply-chain prompt injection aimed at an AI agent reading
  the terminal, not a human).
- [`docs/style-guide.md`](./docs/style-guide.md) - writing conventions for all project text (code
  comments, commit messages, PR bodies, UI copy, docs). The em-dash ban in particular is a hard rule,
  not a preference: never use the em-dash character in anything this project produces, in any
  language.
- [`docs/portfolio.md`](./docs/portfolio.md) - when a UX change justifies updating the curated
  README screenshots, separate from the technical docs above since it is about external presentation.
- [`docs/demo-data-checklist.md`](./docs/demo-data-checklist.md) - checklist for any sample data
  added to the `demo` tenant (always via the real API, never `seed.ts`/direct SQL).

**Never merge without the user's explicit go-ahead, even with green CI** - this project has no
second human reviewer; merge confirmation is verbal, and `docs/DEVELOPMENT.md`'s "Fluxo de PR"
section is the full rhythm this repo runs on. Backlog/roadmap state lives on a Trello board, not in
this repo (no `TODO`/backlog file to trust as current) - if backlog status matters, ask rather than
inferring it from code or old plan files.

## Commands

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres only, for local dev with hot-reload
pnpm db:migrate                                   # apply migrations
pnpm db:seed                                      # seed demo tenant/RBAC/questionnaire/risk matrix
pnpm dev                                          # apps/api (:3001) + apps/web (:3000) via Turborepo

pnpm lint / pnpm typecheck / pnpm test / pnpm build   # across every package (Turborepo)
pnpm --filter @morpheus/api lint                      # scoped to one package; same for web/database
pnpm --filter @morpheus/api test -- vendors.service.spec   # a single test file (Jest, apps/api only)
pnpm --filter @morpheus/api test:e2e                  # e2e, needs a seeded local Postgres already up
```

`apps/web` has no configured test runner - verification there is `typecheck`/`build` plus disposable
Playwright scripts written inside `apps/web/` (ESM resolution needs them in-workspace) and deleted
after use, never committed.

## Architecture

- **Monorepo**: pnpm workspaces + Turborepo. `apps/api` (NestJS 11), `apps/web` (Next.js 16 App
  Router), `packages/database` (Prisma schema/client/migrations, consumed as `@morpheus/database`),
  `packages/config` (shared `tsconfig`).
- **Multi-tenant with no enforcement middleware**: every table carries `tenantId`, but there is no
  Prisma extension/middleware that scopes queries automatically - each repository method takes
  `tenantId` explicitly and includes it in its own `where` clause. A new query that forgets it is a
  real cross-tenant data leak, not a style nit; this is the single most important convention to carry
  into any new backend code.
- **Global request pipeline** (`apps/api/src/app.module.ts`): `ThrottlerGuard` -> `JwtAuthGuard` ->
  `PermissionsGuard`, plus a global `AuditInterceptor` and `AllExceptionsFilter`. A route opts out of
  auth with `@Public()` and gates by permission with `@RequirePermissions(...)` against the
  `PERMISSIONS` constants (`apps/api/src/common/constants`) - RBAC is enforced entirely through this
  decorator/guard pair, never as an ad hoc check inside a service.
- **`apps/api/src/modules/`** is organized by domain (`assessments`, `inventory`, `vendors`,
  `workflow`, `notifications`, `platform-policy`, ...), each typically
  `*.controller.ts`/`*.service.ts`/`*.repository.ts`/`dto/`. `workflow/` holds the configurable
  multi-step approval engine that both `assessments/` (software homologation) and the manual
  inventory-approval flow are built on top of - read it before touching either.
- **`apps/web` routes** live under `apps/web/src/app/[locale]/(app)/`; everything in that group
  shares the authenticated app shell/sidebar. `[locale]` drives `next-intl` (`pt-BR`/`en`, messages
  in `apps/web/src/messages/`) - any new user-visible string needs both language files updated in
  the same change, never just one.
