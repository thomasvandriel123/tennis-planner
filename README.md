# Tennis Planner

A small web app for running a local tennis club's training seasons: the
organiser sets up a training period, players submit their preferences and
get assigned to a slot, and everyone stays in sync on payments and updates.

See [`SPECS.md`](./SPECS.md) for the full product/technical specification
and [`docs/data-dictionary.md`](./docs/data-dictionary.md) for what every
database field means.

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, PostgreSQL via Prisma,
Auth.js (email magic-link sign-in), next-intl (Dutch/English). See
[`SPECS.md` §8](./SPECS.md#8-technical-architecture) for the reasoning.

## Prerequisites

- Node.js 22+
- A PostgreSQL database (a `docker-compose.yml` is included for local dev)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in real values:

   ```bash
   cp .env.example .env.local  # read by `next dev`
   cp .env.example .env        # read by the Prisma CLI
   ```

   Generate `AUTH_SECRET` with `npx auth secret` or `openssl rand -base64 32`.
   `RESEND_API_KEY`/`MOLLIE_API_KEY` can stay empty for local UI work; sign-in
   emails and payments won't work without them.

3. Start a local database:

   ```bash
   docker compose up -d
   ```

4. Apply the schema:

   ```bash
   npm run db:migrate
   ```

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm run build` / `npm start` | Production build / run. |
| `npm run lint` | ESLint. |
| `npm test` | Unit tests (Vitest). |
| `npm run test:e2e` | End-to-end tests (Playwright); starts its own dev server. |
| `npm run db:migrate` | Apply Prisma migrations (dev). |
| `npm run db:studio` | Browse the database with Prisma Studio. |
| `npm run dictionary` | Regenerate `docs/data-dictionary.md` from `prisma/schema.prisma`. |

## Project structure

```
prisma/schema.prisma   Data model - the source of truth (see its header comment)
src/app/[locale]/      Pages, one route tree shared across nl/en
src/components/        Shared UI
src/i18n/              next-intl routing/config
src/lib/               Business logic, db client, auth, RBAC
scripts/               One-off/maintenance scripts (e.g. the data dictionary generator)
e2e/                   Playwright end-to-end tests
docs/                  Generated docs (data dictionary)
```

Run `npm run dictionary` after changing `prisma/schema.prisma` so the data
dictionary stays in sync - it's generated, not hand-edited.
