# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this is

**Team Power Rankings** is a Next.js web app where users build and share their
personal Power Ranking of the 32 NFL 2026 teams. It supports **multiple
independent votings** (e.g. "NFL Alicante", "El Capologist"), each
password‑gated, and an admin panel that computes a **global consensus
ranking** from all submissions using an iterative bottom‑up algorithm.

This project is a fork of [QBRankings](https://github.com/samuvr/qbrankings),
adapted so the rankable entity is a **team** (`src/data/teams.ts`) instead of
a QB. Most of the app (voting flow, algorithm, DB layer, share images, admin
dashboard) is unchanged from the original — only the entity being ranked and
its rendering differ.

The product copy and most code comments are in **Spanish**; keep new
user‑facing strings and comments in Spanish to match. Code identifiers are in
English.

> Note: `README.md` is partly out of date. It describes a fixed two‑voting setup
> backed by a Postgres enum. The codebase has since moved to a dynamic
> `votings` table (UUID PKs, per‑voting passwords, admin CRUD). When README and
> code disagree, **the code is the source of truth** — and consider updating the
> README.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 4** (via `@tailwindcss/postcss`, no `tailwind.config`)
- **Vercel Postgres** (Neon) through `@vercel/postgres` (tagged-template `sql`)
- **`next/og`** (Satori) for server-generated share images (PNG)
- **`jose`** for JWT cookies; **`bcryptjs`** for per-voting password hashes
- **`zod` v4** for all input validation
- **`@dnd-kit`** for drag-and-drop reordering (admin votings manager)
- **Vitest** for unit tests
- Path alias: `@/*` → `./src/*`

## Commands

```bash
npm run dev          # next dev — http://localhost:3000
npm run build        # production build
npm start            # serve the production build
npm run lint         # eslint (eslint-config-next: core-web-vitals + typescript)
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch
npm run db:migrate   # tsx --env-file=.env.local src/lib/db/migrate.ts (idempotent)
```

Before committing, run `npm run lint` and `npm test`. There is no separate
typecheck script; `npm run build` performs type checking.

## Environment

Copy `.env.example` → `.env.local`. Key variables:

- `POSTGRES_URL` (+ the other `POSTGRES_*` Vercel vars) — DB connection.
  On Vercel, `vercel env pull` fills these in.
- `ADMIN_PASSWORD` — superadmin login password (constant-time compared).
- `SESSION_SECRET` — JWT signing secret, **min 16 chars** or auth throws.
- `NEXT_PUBLIC_APP_URL` — used for absolute share/image URLs.

Per-voting passwords are **not** env vars anymore — they live hashed in the
`votings` table. The `VOTING_PASSWORD_*` entries in `.env.example` are legacy.

## Repository layout

```
src/
  app/                         # Next.js App Router (routes = folders)
    page.tsx / HomeForm.tsx    # landing: name + email + voting selector
    layout.tsx, globals.css
    vote/[voting]/
      access/                  # per-voting voter password gate
      page.tsx                 # the ranking builder (tap team → slot, reorder)
      success/                 # shows generated share image
    admin/
      page.tsx, LoginForm.tsx  # superadmin login
      [voting]/                # global ranking dashboard for a voting
        access/                # per-voting admin password gate
        votantes/[voterId]/    # individual voter deviation view
      votings/new, votings/[id]/edit   # voting CRUD (superadmin only)
    api/
      rankings/                # POST submit, GET .../[id]/image (og)
      voting/[slug]/access/    # voter password check → sets cookie
      admin/                   # login, rankings, voters image, votings CRUD/reorder
  components/                  # TeamCard, RankingBoard, RankingSlot, TeamMark,
                               # VotingForm, VotingSelector, VotingsManager
  data/                        # teams.ts, power-metric.ts (+ power-metric.test.ts)
  lib/
    db/client.ts               # all SQL queries + row types
    db/migrate.ts              # schema creation + legacy migration + seeding
    auth.ts                    # superadmin JWT cookie + ADMIN_PASSWORD check
    voting-access.ts           # per-voting voter / voting_admin JWT cookies
    schemas.ts                 # zod schemas for every input
    ranking-algorithm.ts       # consensus algorithm (+ .test.ts)
    ranking-deviation.ts       # voter vs consensus deviation
  middleware.ts                # route protection + cookie hygiene
public/                        # static voting logos
```

## Core domain concepts

### Votings (`votings` table)
Each voting has a UUID `id`, a URL `slug`, display fields (`name`,
`short_name`, `description`, `accent`/`accent_dark` hex colors, `logo_url`),
two bcrypt hashes (`voter_password_hash`, `admin_password_hash`), a `position`
for ordering, and an `active` flag. Public reads go through helpers that strip
the password hashes (`VotingPublic` / `stripSecrets`).

### Rankings (`rankings` table)
One row per `(email, voting)` (unique constraint → upsert on submit). Stores
`positions` as a JSONB array of team `abbr`s, ordered position 1 (best) … N
(worst). `voting` is a UUID FK → `votings(id)`.

### Teams (`src/data/teams.ts`)
Static list of the 32 NFL teams (`abbr`, `name`, `location`, colors),
`teamLogoUrl()` resolves the live ESPN logo. `TOTAL_TEAMS` and
`getTeamAbbrs()` drive validation. Submitted `positions` must be exactly
`TOTAL_TEAMS` unique, known team `abbr`s. `getTeamByAbbr` throws on an
unknown abbr; use `findTeamByAbbr` where the id may not (yet) be valid.

### Power metric data (`src/data/power-metric.ts`)
Static point-differential values per team `abbr` (`null` = no data), used in
the admin dashboard to compare consensus vs an objective metric. Uses
competition ranking (1,2,2,4) for ties. Provisional/placeholder values —
update with real season data.

## The consensus algorithm (`src/lib/ranking-algorithm.ts`)

`computeGlobalRanking(allRankings: string[][])` assigns final positions
**bottom-up** over 7 rounds:

- Rounds 1–4: each voter's bottom **5** un-placed teams score `5,4,3,2,1`
  (worst gets 5). Fills final positions 32→28, 27→23, 22→18, 17→13.
- Rounds 5–7: bottom **4** score `4,3,2,1`. Fills 12→9, 8→5, 4→1.

Each round, the top scorers are locked into the lowest remaining positions and
removed from subsequent rounds. Ties broken by `compareTie`: worst single
position received → how often → second-worst → how often → total position sum
(`ROUNDS` defines the schedule). It returns the ranking plus per-round
`RoundBreakdown` score history for the admin "stream" view.

The algorithm is **pure and fully unit-tested** — if you change scoring,
rounds, or tie-breaking, update `ranking-algorithm.test.ts` accordingly.

## Auth & access model

Three independent layers, all JWT cookies signed with `SESSION_SECRET`
(HS256, 12h expiry, `httpOnly`, `secure` in prod):

1. **Superadmin** (`lib/auth.ts`, cookie `admin_session`): password
   `ADMIN_PASSWORD`, constant-time compared. Full access to everything
   incl. voting CRUD.
2. **Voter** (`lib/voting-access.ts`, cookie `voter_access_<votingId>`):
   per-voting `voter_password`. Required to submit a ranking.
3. **Voting admin** (cookie `voting_admin_<votingId>`): per-voting
   `admin_password`. Can view that voting's dashboard but not manage votings.

`middleware.ts` enforces: `/admin/votings*` and most `/api/admin/votings*`
require superadmin; login/access routes are exempt; granular per-voting auth
for `/admin/[slug]` is delegated to the server component (superadmin OR that
voting's admin). On every visit to `/`, the middleware **deletes all
`voter_access_*` / `voting_admin_*` cookies** so each flow re-prompts for the
password.

## Conventions to follow

- **Server Components by default.** Pages are `async` server components that
  read params via `const { x } = await params` (params/searchParams are
  Promises in Next 16). Mark interactive pieces with `"use client"` and keep
  them small (`*Form.tsx`, `*View.tsx`, `ShareActions.tsx`).
- **All DB access goes through `src/lib/db/client.ts`.** Don't scatter raw
  `sql` queries in routes/components. Use the tagged-template `sql` (it
  parameterizes — never string-concatenate user input). Add a typed helper +
  row type there.
- **Validate every external input with a zod schema** from `lib/schemas.ts`.
  API routes parse the body, return `400` with `err.issues` on `ZodError`,
  and use `export const runtime = "nodejs"` (needed for bcrypt/jose). Note
  voting ids use `z.guid()` (accepts non-RFC UUIDs — see commit history).
- **Force dynamic** for pages/routes that read the DB per request
  (`export const dynamic = "force-dynamic"` or `runtime = "nodejs"`).
- **Never expose password hashes** — return `VotingPublic`, not `VotingRow`.
- **Keep the algorithm pure**: no DB/IO in `ranking-algorithm.ts` /
  `ranking-deviation.ts`; feed them plain arrays.
- **Share images** (`api/**/image/route.tsx`) use `next/og` + Satori. Satori
  can't load WOFF2; fonts are fetched as TTF. Image URLs are cache-busted by
  `updated_at`.
- **Tests** live next to the code as `*.test.ts` and run under Vitest.

## Database migrations

`src/lib/db/migrate.ts` is the single, **idempotent** migration entry point
(`npm run db:migrate`). It creates the `votings` and `rankings` tables, seeds
the two legacy votings with random placeholder passwords (printed to stdout —
change them), and migrates pre-existing rows from the old `voting_type` enum to
the new UUID FK. There is no migration framework; extend this script with
`CREATE TABLE IF NOT EXISTS` / guarded `ALTER`s and keep it re-runnable.

## Git workflow

- Branch names follow `claude/<slug>`; open PRs into the default branch
  (history shows squash/merge of feature PRs).
- Commit messages are short, often Conventional Commits
  (`feat(admin): …`, `fix(schemas): …`, `chore: …`), in Spanish or English.
- Do **not** create a PR unless explicitly asked.
