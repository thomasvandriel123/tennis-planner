# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A web app for running a local tennis club's training seasons (organiser
sets up a period → players submit preferences → organiser assigns slots →
players pay and get updates). Full product/technical spec: `SPECS.md`.
Data model reference: `docs/data-dictionary.md` (generated, see below).

## Commands

```bash
npm run dev              # dev server (Turbopack)
npm run build && npm start   # production build / run
npm run lint              # ESLint
npm test                  # unit tests (Vitest), all files
npx vitest run path/to/file.test.ts   # a single unit test file
npm run test:e2e          # Playwright e2e (spins up its own dev server)
npx playwright test e2e/home.spec.ts  # a single e2e file
npm run db:migrate        # apply Prisma migrations in dev, creates one if the schema changed
npm run db:studio         # browse the DB
npm run dictionary        # regenerate docs/data-dictionary.md from prisma/schema.prisma
```

Local Postgres: `docker compose up -d` (matches the default `DATABASE_URL`
in `.env.example`). The Prisma CLI reads `.env`; `next dev` reads
`.env.local` — copy `.env.example` to both.

## Architecture

**Locale-prefixed routing.** Every page lives under `src/app/[locale]/`
(nl/en, Dutch default, no Accept-Language auto-detection — see the comment
in `src/i18n/routing.ts` for why). `src/app/[locale]/layout.tsx` is the
actual root layout (owns `<html>`/`<body>`); there is no `src/app/layout.tsx`.
`src/proxy.ts` (Next.js 16's renamed `middleware.ts`) runs next-intl's
locale-resolution middleware on every non-API, non-asset request. Routes
that must NOT be locale-prefixed (e.g. `src/app/api/auth/...`) live outside
`[locale]`.

**Data model is schema-first.** `prisma/schema.prisma` is the single source
of truth for both the DB shape and its documentation: every model/field has
a `///` doc comment, and `npm run dictionary` renders those into
`docs/data-dictionary.md` (a generated file — edit the schema, not the
markdown). Re-run it after any schema change. Note the schema contains two
unrelated "session" concepts: `Session` (an Auth.js browser session, fixed
shape required by `@auth/prisma-adapter`) vs. `TrainingSession` (a tennis
training occurrence) — don't conflate them.

**Prisma 7 client requires a driver adapter.** The `prisma-client` generator
(see `generator client` block in the schema) outputs an ESM client to
`src/generated/prisma` (gitignored, regenerated via `postinstall`/
`db:generate`) that cannot be constructed with just a connection string —
it needs a `@prisma/adapter-pg` instance. `src/lib/db.ts` is the only place
that should construct `PrismaClient`; import `db` from there everywhere
else. It also does the `globalThis` caching trick so dev-mode module
reloads don't open a new connection pool per edit. Note `prisma migrate
dev` does not reliably regenerate the client on its own here - `db:migrate`
chains `&& prisma generate` for that reason; don't drop it.

**Auth and roles.** `src/lib/auth.ts` configures Auth.js v5 with email
magic-link sign-in (no passwords) and attaches the signed-in user's `id`
and `roles` (organiser/trainer/player — a user can hold more than one) onto
`session.user` via the `session` callback, so pages/route handlers can read
`(await auth()).user.roles` without a separate query. `src/lib/rbac.ts`
holds the `isOrganiser`/`isTrainer`/`isPlayer` helpers built on top of that.
Role checks belong server-side (page/route handler), not just in UI
conditionals.

**i18n.** Translation keys live in `messages/nl.json` and `messages/en.json`
(kept in sync manually — same key structure in both). Server components use
`getTranslations()` from `next-intl/server`; client components use
`useTranslations()`/`useLocale()` from `next-intl`. Use `Link`/`useRouter`/
`usePathname` from `src/i18n/navigation.ts` (not `next/link` or
`next/navigation`) so links keep the current locale prefix.

**Styling.** Tailwind v4 (CSS-based config, no `tailwind.config.ts`) — theme
tokens (`--color-court`, `--color-ball`, `--color-clay`, `--color-line`)
are defined via `@theme inline` in `src/app/[locale]/globals.css`. Keep the
tennis-court/ball palette as a sparingly-used accent, not the dominant look
(see `SPECS.md` design principles).
