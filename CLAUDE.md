# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this is

**Team Power Rankings** is a Next.js web app where users build and share their
personal Power Ranking of the 32 NFL 2026 teams. There is exactly **one
voting** ("NFL Alicante"): people create an **account** (name + email +
password, gated by the community password) on `/`, and from then on they log
in, reorder their saved ranking by drag & drop and save it again. An admin
panel computes a **global consensus ranking** from all submissions using an
iterative bottom‑up algorithm.

The admin freezes the state of the voting into named **screenshots** ("Week 1",
"Post‑Cortes Training Camp"). Each screenshot stores every included user's
ranking plus the consensus computed at that moment, and becomes the baseline
for the **evolution arrows** (▲ green / ▼ red / `=` grey) shown next to every
team in the web UI and in the generated share images.

This project is a fork of [QBRankings](https://github.com/samuvr/qbrankings),
adapted so the rankable entity is a **team** (`src/data/teams.ts`) instead of
a QB. Most of the app (voting flow, algorithm, DB layer, share images, admin
dashboard) is unchanged from the original — only the entity being ranked and
its rendering differ.

The product copy and most code comments are in **Spanish**; keep new
user‑facing strings and comments in Spanish to match. Code identifiers are in
English.

> History: this app used to support multiple votings (dynamic `votings` table,
> per‑voting admin passwords, admin CRUD, voting selector on the landing page).
> That was collapsed into a single voting; the `votings` table survives with
> exactly **one row**. When docs and code disagree, **the code is the source of
> truth** — and consider updating the docs.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 4** (via `@tailwindcss/postcss`, no `tailwind.config`)
- **Vercel Postgres** (Neon) through `@vercel/postgres` (tagged-template `sql`)
- **`next/og`** (Satori) for server-generated share images (PNG)
- **`@dnd-kit`** (core + sortable) for the drag & drop ranking builder
- **`jose`** for JWT cookies; **`bcryptjs`** for user and community passwords
- **`zod` v4** for all input validation
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

The community password is **not** an env var — it lives hashed in the
`votings` table (`voter_password_hash`, editable in `/admin/ajustes`) and is
only asked for when creating an account. The `VOTING_PASSWORD_*` entries in
`.env.example` are legacy.

## Repository layout

```
src/
  app/                         # Next.js App Router (routes = folders)
    page.tsx / AuthForms.tsx   # landing: login / register tabs
    layout.tsx, globals.css
    vote/
      page.tsx                 # the ranking builder (drag & drop, preloaded)
      success/                 # share image + biggest movers
    perfil/                    # account settings, streak, mean deviation
    historico/                 # screenshot list, detail, entries, comparador
    equipos/                   # team index + per-team evolution chart
    admin/
      page.tsx, LoginForm.tsx  # admin login + global ranking dashboard
      AdminRankingView.tsx     # dashboard UI (list / stream, PNG exports)
      screenshots/             # create / rename / delete + participation panel
      usuarios/                # accounts + manual password reset
      ajustes/                 # edit the single voting's settings
      votantes/[voterId]/      # individual voter deviation view
    api/
      auth/                    # register, login, logout, profile PATCH
      rankings/                # POST submit, GET .../[id]/image (og)
      snapshots/[id]/          # frozen consensus + entry images
      admin/                   # login, rankings (+story/round/movers images),
                               # screenshots CRUD, user password reset,
                               # voters image, voting settings PATCH
  components/                  # RankingBoard, RankingSlot, TeamMark,
                               # EvolutionBadge, RankingListView, VotingLogo,
                               # VotingSettingsForm
  data/                        # teams.ts, power-metric.ts (+ power-metric.test.ts)
  lib/
    db/client.ts               # all SQL queries + row types
    db/migrate.ts              # schema creation + legacy migration + seeding
    auth.ts                    # admin JWT cookie + ADMIN_PASSWORD check
    user-auth.ts               # user JWT cookie + getCurrentUser()
    voting-access.ts           # bcrypt hash/verify helpers
    cookie-names.ts            # cookie names (no deps: imported by middleware)
    og/                        # shared fonts, palette and 1080×1920 layout
    schemas.ts                 # zod schemas for every input
    ranking-algorithm.ts       # consensus algorithm (+ .test.ts)
    ranking-deviation.ts       # voter vs consensus deviation
    ranking-evolution.ts       # deltas vs a screenshot (+ .test.ts)
  middleware.ts                # route protection
public/                        # static voting logo
```

## Core domain concepts

### The voting (`votings` table, single row)
The one voting has a UUID `id`, a `slug` (`nfl-alicante`, no longer part of any
URL — it identifies the row and names exported PNGs), display fields (`name`,
`short_name`, `description`, `accent`/`accent_dark` hex colors, `logo_url`),
a bcrypt `voter_password_hash`, a `public_access` flag (skip the password) and
an `active` flag (closes voting). `getVoting()` resolves it — canonical slug
first, oldest row as fallback — and `toPublicVoting()` strips the hash
(`VotingPublic`). Nothing in the app creates or deletes votings; `migrate.ts`
seeds the row and removes leftovers.

### Users (`users` table)
`full_name`, unique lowercase `email`, bcrypt `password_hash`. Registration
(`/api/auth/register`) requires the voting's community password unless
`public_access`. Email is the identity and is **not** editable; the name is,
and `updateUserName()` propagates it to the user's ranking (it shows in the
share image). There is no email delivery, so password recovery is manual:
`/admin/usuarios` sets a temporary password.

### Rankings (`rankings` table)
One row per `(email, voting)` (unique constraint → upsert on save) plus a
`user_id` FK. Stores `positions` as a JSONB array of team `abbr`s, ordered
position 1 (best) … N (worst). `voting` is a UUID FK → `votings(id)`; the API
fills `voting`, `user_id`, `full_name` and `email` from the session — clients
only send `positions`. Each user keeps exactly **one live ranking** that they
edit over time; the history lives in the screenshots.

Rows predating accounts have `user_id = NULL` and still count towards the
consensus; registering with that email adopts them (`adoptDataByEmail`).

### Screenshots (`snapshots` + `snapshot_entries`)
A screenshot freezes the voting under a name unique per voting ("Week 1").
`snapshots.consensus` is the ordered array of `abbr`s computed at creation time
and **never recomputed**; `snapshot_entries` holds a copy of each included
user's `positions`. By default only rankings saved after the previous
screenshot are included — the admin form shows the live count and can include
everyone with a checkbox. Deleting a screenshot cascades its entries and
changes everyone's evolution arrows.

### Evolution (`src/lib/ranking-evolution.ts`)
Pure helpers over two ordered arrays: `delta = previousPosition - position`, so
positive = moved up. `null` means there is no earlier data and nothing is
drawn. The baseline is the most recent screenshot **in which that ranking
appears** — for a user who skipped a week that may be several screenshots back.
`topMovers()` feeds the "Movers" image and the movers columns;
`teamPositionHistory()` feeds the per-team chart.

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

Two independent layers, both JWT cookies signed with `SESSION_SECRET`
(HS256, `httpOnly`, `secure` in prod):

1. **Admin** (`lib/auth.ts`, cookie `admin_session`, 12h): password
   `ADMIN_PASSWORD`, constant-time compared. Full access to the panel.
2. **User** (`lib/user-auth.ts`, cookie `user_session`, 30 days): `sub` is the
   user id; `getCurrentUser()` resolves it against the DB. Required to save a
   ranking and to browse the histórico.

`middleware.ts` enforces: `/vote`, `/historico`, `/equipos` and `/perfil` need
a user (or admin) session; `/` redirects to `/vote` when already logged in;
everything under `/admin` and `/api/admin` requires the admin session, except
the `/admin` page itself (it renders the login form) and `/api/admin/login`.
Route handlers re-check the session as defense in depth. Cookie names live in
`lib/cookie-names.ts` because the middleware runs on Edge and must not pull in
the DB client.

Login answers with the same message for unknown email and wrong password.

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
  and use `export const runtime = "nodejs"` (needed for bcrypt/jose).
- **Force dynamic** for pages/routes that read the DB per request
  (`export const dynamic = "force-dynamic"` or `runtime = "nodejs"`).
- **Never expose the password hash** — return `VotingPublic`, not `VotingRow`.
- **Keep the algorithm pure**: no DB/IO in `ranking-algorithm.ts` /
  `ranking-deviation.ts`; feed them plain arrays.
- **Share images** (`api/**/image/route.tsx`) use `next/og` + Satori. Satori
  can't load WOFF2; fonts are fetched as TTF. Image URLs are cache-busted by
  `updated_at`.
- **Tests** live next to the code as `*.test.ts` and run under Vitest.

## Database migrations

`src/lib/db/migrate.ts` is the single, **idempotent** migration entry point
(`npm run db:migrate`). It creates the `votings`, `rankings`, `users`,
`snapshots` and `snapshot_entries` tables, adds `rankings.user_id` (linking any
pre-existing ranking to an account with the same email), seeds
the NFL Alicante row with a random placeholder password (printed to stdout —
change it in `/admin/ajustes`), migrates pre-existing rows from the old
`voting_type` enum to the UUID FK, drops the now unused `position` /
`admin_password_hash` columns, and deletes leftover votings — silently when
they have no rankings, otherwise only with
`npm run db:migrate -- --purge-extra-votings`. There is no migration framework;
extend this script with `CREATE TABLE IF NOT EXISTS` / guarded `ALTER`s and
keep it re-runnable.

## Git workflow

- Branch names follow `claude/<slug>`; open PRs into the default branch
  (history shows squash/merge of feature PRs).
- Commit messages are short, often Conventional Commits
  (`feat(admin): …`, `fix(schemas): …`, `chore: …`), in Spanish or English.
- Do **not** create a PR unless explicitly asked.
