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

This project started as a fork of
[QBRankings](https://github.com/samuvr/qbrankings), adapted so the rankable
entity is a **team** (`src/data/teams.ts`) instead of a QB. The inherited parts
(consensus algorithm, DB layer, share images, admin dashboard) still look like
the original, but everything built since — accounts, screenshots and evolution,
`/consenso`, `/usuarios`, `/equipos` and the evolution video — is specific to
this repo. Don't assume upstream behaviour: check the code here.

The product copy and most code comments are in **Spanish**; keep new
user‑facing strings and comments in Spanish to match. Code identifiers are in
English.

> History: this app used to support multiple votings (dynamic `votings` table,
> per‑voting admin passwords, admin CRUD, voting selector on the landing page).
> That was collapsed into a single voting; the `votings` table survives with
> exactly **one row**. When docs and code disagree, **the code is the source of
> truth** — and consider updating the docs.

## Stack

- **Next.js 16.2.6** (App Router) + **React 19.2.4** + **TypeScript** (strict)
- **Tailwind CSS 4** (via `@tailwindcss/postcss`, no `tailwind.config`)
- **Vercel Postgres** (Neon) through `@vercel/postgres` (tagged-template `sql`)
- **`next/og`** (Satori) for server-generated share images (PNG)
- **Canvas 2D + `MediaRecorder`** (browser-side) for the 10 s evolution video
- **`@dnd-kit`** (core + sortable) for the drag & drop ranking builder
- **`jose`** for JWT cookies; **`bcryptjs`** for user and community passwords
- **`zod` v4** for all input validation
- **Vitest 4** for unit tests (`@vitest/coverage-v8` is installed, but there is
  no `coverage` script — run `npx vitest run --coverage`)
- **PGlite** (`@electric-sql/pglite`, dev only) — Postgres compiled to WASM, so
  the migration tests run real SQL in-process with no server
- Path alias: `@/*` → `./src/*` (declared in `tsconfig.json` and mirrored in
  `vitest.config.ts`, so tested modules can import the way the app does)
- `next.config.ts` only whitelists remote images: `a.espncdn.com`
  (`/i/teamlogos/nfl/500/**`, team logos) and `pbs.twimg.com`
  (`/profile_images/**`, arbitrary logo URLs pasted in `/admin/ajustes`)

## Commands

```bash
npm run dev          # next dev — http://localhost:3000
npm run build        # production build
npm start            # serve the production build
npm run lint         # eslint (eslint-config-next: core-web-vitals + typescript)
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch
npm run db:migrate   # tsx --env-file=.env.local src/lib/db/migrate.ts (idempotent)
npx vitest run src/lib/ranking-algorithm.test.ts   # a single test file
```

Before committing, run `npm run lint` and `npm test`. There is no separate
typecheck script; `npm run build` performs type checking.

`.github/workflows/ci.yml` runs exactly those three (lint → test → build) on
every pull request and on every push to `main`, on Node 22. The build needs no
database — every page is `force-dynamic` — but it does need a `SESSION_SECRET`
of at least 16 chars, so the workflow sets placeholder values for it,
`ADMIN_PASSWORD` and `NEXT_PUBLIC_APP_URL`.

## Environment

Copy `.env.example` → `.env.local`. Key variables:

- `POSTGRES_URL` (+ the other `POSTGRES_*` Vercel vars) — DB connection.
  On Vercel, `vercel env pull` fills these in.
- `ADMIN_PASSWORD` — superadmin login password (constant-time compared).
- `SESSION_SECRET` — JWT signing secret, **min 16 chars** or auth throws.
- `NEXT_PUBLIC_APP_URL` — used for absolute share/image URLs.

The community password is **not** an env var — it lives hashed in the
`votings` table (`voter_password_hash`, editable in `/admin/ajustes`) and is
only asked for when creating an account. `.env.example` no longer lists any
`VOTING_PASSWORD_*` entry, just a comment saying where the password lives.

## Repository layout

```
src/
  app/                         # Next.js App Router (routes = folders)
    page.tsx / AuthForms.tsx   # landing: login / register tabs
    layout.tsx, globals.css
    vote/
      page.tsx                 # the ranking builder (drag & drop, preloaded)
      success/                 # share image + biggest movers
    consenso/                  # consensus en vivo vs el ranking del usuario
    realidad/                  # clasificación real de la NFL vs consensus
                               # y ranking de acierto de cada votante
    perfil/                    # account settings + participación (X/Y
                               # screenshots) y desviación media e histórica
    usuarios/                  # user picker + any user's ranking vs your own
                               # (live, or ?snapshot=<id> for a frozen one)
    historico/                 # screenshot list, detail, entries, comparador
    equipos/                   # team index + per-team evolution chart
    admin/
      page.tsx, LoginForm.tsx  # admin login + global ranking dashboard
      AdminRankingView.tsx     # dashboard UI (list / stream, PNG exports)
      screenshots/             # create / rename / delete + participation panel
      usuarios/                # accounts + manual password reset
      ajustes/                 # edit the single voting's settings +
                               # RunMigrationsPanel (POST /api/admin/migrate)
      votantes/[voterId]/      # individual voter deviation view
    api/
      auth/                    # register, login, logout, profile PATCH
      rankings/                # POST submit, GET .../[id]/image (og)
      team-logo/[abbr]/        # proxy del escudo ESPN (mismo origen, para el vídeo)
      snapshots/[id]/          # frozen consensus + entry images
      admin/                   # login, migrate, rankings (+story/round/
                               # movers images), screenshots CRUD, user
                               # password reset, voters image,
                               # voting settings PATCH
  components/                  # RankingBoard, RankingSlot, TeamMark,
                               # EvolutionBadge, RankingListView, VotingLogo,
                               # VotingSettingsForm, RankingComparison
                               # (a reference ranking with your own positions
                               #  next to it: the consensus in /consenso,
                               #  another user's in /usuarios/[userId]),
                               # RankingVideoExport (vídeo de 10 s),
                               # RunMigrationsPanel (botón de migraciones)
  data/                        # teams.ts, power-metric.ts (+ power-metric.test.ts)
  lib/
    db/client.ts               # all SQL queries + row types (+ .test.ts)
    db/migrations.ts           # schema creation + legacy migration + seeding
                               # (+ migrations.test.ts, contra PGlite)
    db/migrate.ts              # CLI entry point (npm run db:migrate)
    db/test-db.ts              # adaptador PGlite que suplanta @vercel/postgres
                               # en los tests (solo tests, nadie lo importa
                               # desde src/app)
    auth.ts                    # admin JWT cookie + ADMIN_PASSWORD check
    user-auth.ts               # user JWT cookie + getCurrentUser()
    voting-access.ts           # bcrypt hash/verify helpers
    rate-limit.ts              # cupo de intentos fallidos (+ .test.ts)
    auth-throttle.ts           # los cupos concretos de login/registro + el 429
    cookie-names.ts            # cookie names (no deps: imported by middleware)
    og/                        # fonts.ts (Google Fonts TTF + absolute URLs),
                               # theme.ts (palette + 1080×1920) y
                               # ranking-image.tsx (layout Satori compartido)
    schemas.ts                 # zod schemas for every input
    ranking-algorithm.ts       # consensus algorithm (+ .test.ts)
    ranking-deviation.ts       # voter vs consensus deviation (+ .test.ts)
    ranking-evolution.ts       # deltas vs a screenshot (+ .test.ts)
    ranking-dispersion.ts      # desacuerdo entre votantes por equipo
                               # (+ .test.ts)
    ranking-season.ts          # "mi temporada": podio y cambios de opinión
                               # de un votante (+ .test.ts)
    nfl-results.ts             # parseo del CSV de nflverse + clasificación
                               # real (puro, + .test.ts)
    nfl-standings.ts           # descarga del CSV y caché de 1 h (el IO)
    slug.ts                    # slug para nombrar ficheros (+ .test.ts)
    video/animation.ts         # línea de tiempo del vídeo (+ .test.ts)
    video/scene.ts             # dibujo de un fotograma en canvas 2D
    video/recorder.ts          # canvas → MediaRecorder → Blob (solo cliente)
  middleware.ts                # route protection
```

`public/` holds `nfl-alicante.jpg` (the seeded `logo_url` and the landing
fallback) and `vikings.png`, a leftover from the fork that nothing references.

## Route map (and the query params each one understands)

Every page below is an `async` server component with
`export const dynamic = "force-dynamic"`. "user" = user *or* admin session
(the middleware accepts both).

| Route | Who | What it renders |
| --- | --- | --- |
| `/` | anyone | login / register tabs (`AuthForms`); redirects to `/vote` with a session |
| `/vote` | user | the 32-team drag & drop board, preloaded with the saved ranking (or the default order for a new account) + a "you haven't touched it since the last screenshot" warning |
| `/vote/success?id=<rankingId>` | user | share image (`?v=<updated_at>-<snapshotId>`), top 3 risers/fallers and the evolution video |
| `/consenso` | user | live consensus (recomputed on every request) vs your ranking |
| `/realidad` | user | the real NFL standings for the season vs the consensus, plus a leaderboard of who is closest to reality |
| `/usuarios` | user | list of accounts with their last save and how many screenshots they appear in (`listUsers`) |
| `/usuarios/[userId]?snapshot=<id>` | user | that user's ranking vs yours — live, or both frozen versions from that screenshot |
| `/historico` | user | screenshot list, marking the ones you took part in |
| `/historico/[snapshotId]` | user | frozen consensus + its share image + the evolution video (anchor `#video`) |
| `/historico/[snapshotId]/[entryId]` | user | one participant's frozen ranking + its deviation from that screenshot's consensus |
| `/historico/comparar?a=<id>&b=<id>` | user | any two screenshots side by side (defaults: the two most recent) |
| `/equipos` | user | the 32 teams in live-consensus order with their arrows, plus the three most divisive and the three most agreed-on |
| `/equipos/[abbr]` | user | that team's position screenshot by screenshot, closed with the live consensus, plus how far apart the voters are on it right now (best/worst/mean/σ + histogram) |
| `/perfil` | user | participation (X/Y screenshots), mean deviation, deviation per screenshot, "mi temporada" (podium per screenshot + what you changed your mind about), name/password form |
| `/admin` | admin | login form, or the global ranking dashboard |
| `/admin/screenshots` | admin | create / rename / delete screenshots + participation panel |
| `/admin/usuarios` | admin | accounts + manual password reset |
| `/admin/votantes/[voterId]` | admin | one voter's ranking vs the **leave-one-out** consensus |
| `/admin/ajustes` | admin | voting settings + the migrations button |

The admin dashboard reads three params: `?mode=list|stream`, `?round=<n>`
(which round of the algorithm the stream view shows) and `?base=<snapshotId>`
(which screenshot the evolution arrows compare against — the most recent one by
default). It also has a client-side checkbox that overlays the
`data/power-metric.ts` ranking, and buttons that download the Story, Movers and
per-round PNGs from `/api/admin/rankings/*`.

## Core domain concepts

### The voting (`votings` table, single row)
The one voting has a UUID `id`, a `slug` (`nfl-alicante`, no longer part of any
URL — it identifies the row and names exported PNGs), display fields (`name`,
`short_name`, `description`, `accent`/`accent_dark` hex colors, `logo_url`),
a bcrypt `voter_password_hash`, a `public_access` flag (skip the password) and
an `active` flag (closes voting). `getVoting()` resolves it — canonical slug
first, oldest row as fallback — and `toPublicVoting()` strips the hash
(`VotingPublic`). Nothing in the app creates or deletes votings; `migrations.ts`
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

Each save also keeps the version it replaces in `previous_positions` /
`previous_saved_at` (only when the order actually changed): it is the starting
point of the evolution video on `/vote/success`. `getRankingWithPreviousById()`
is the only query that reads those columns.

Both queries **tolerate a database that has not been migrated yet**: if Postgres
answers `42703` (`undefined_column`, detected by `isUndefinedColumnError()`,
tested in `db/client.test.ts`) they log a warning and retry without those two
columns, so saving a ranking never fails just because the deploy is missing the
video feature. Keep that fallback in mind when adding columns: a query that uses
a brand-new column and has no fallback breaks every user until someone runs the
migration.

### Screenshots (`snapshots` + `snapshot_entries`)
A screenshot freezes the voting under a name unique per voting ("Week 1").
`snapshots.consensus` is the ordered array of `abbr`s computed at creation time
and **never recomputed**; `snapshot_entries` holds a copy of each included
user's `positions`. By default only rankings saved after the previous
screenshot are included — the admin form shows the live count and can include
everyone with a checkbox (`includeAll` in `SnapshotCreateSchema`). The
participation panel below the form lists who is up to date and who is not.
Deleting a screenshot cascades its entries and changes everyone's evolution
arrows. Every screenshot in `/admin/screenshots` links to its detail page and
to `#video` (the evolution video of that screenshot's consensus).

### Evolution (`src/lib/ranking-evolution.ts`)
Pure helpers over two ordered arrays: `delta = previousPosition - position`, so
positive = moved up. `null` means there is no earlier data and nothing is
drawn. The baseline is the most recent screenshot **in which that ranking
appears** — for a user who skipped a week that may be several screenshots back.
`topMovers()` feeds the "Movers" image and the movers columns;
`teamPositionHistory()` feeds the per-team chart.

### Dispersion (`src/lib/ranking-dispersion.ts`)
Pure helpers over the live rankings: for each team, the best and worst position
anyone gave it, the mean, the median, the spread and the population standard
deviation. It answers a question the consensus cannot — whether a team's
position is agreed on or is the average of a fight. `mostDivisive()` /
`mostAgreed()` feed the two cards on `/equipos`; `positionHistogram()` (8
buckets of 4 positions) draws the bars on `/equipos/[abbr]`. Needs at least two
rankings to say anything, so `/equipos` hides the cards below that.

### A voter's season (`src/lib/ranking-season.ts`)
The mirror image of the above, for a person instead of a team.
`seasonTopSlices()` walks a voter's frozen rankings in chronological order
(closed with their live one) and marks who entered and who dropped out of their
top N — the first point has no `entered`/`left`, since there is nothing before
it. `seasonChanges()` compares only the first and the last point, so it reads as
"since you started"; `seasonBiggestChanges()` splits it into risers and fallers.
Both feed the "Mi temporada" section of `/perfil`.

### Real results (`src/lib/nfl-results.ts` + `nfl-standings.ts`)
The only data in the app that does not come from the voters. `nfl-standings.ts`
downloads [nflverse](https://github.com/nflverse/nfldata)'s `data/games.csv`
(one row per game since 1999, empty scores until played) and `nfl-results.ts`
parses it and builds the standings — pure and unit-tested, so the CSV format is
covered by tests rather than by hope.

Four things that are easy to get wrong here:

- **nflverse calls the Rams `LA`; `teams.ts` calls them `LAR`.** That is the
  only mismatch in 2026, and `normalizeTeamAbbr()` is where it (plus the old
  `OAK`/`SD`/`STL` relocations) is handled. A team the app does not know is
  dropped, never rendered.
- **Columns are located by name, not by position.** nflverse adds columns from
  time to time and a positional parser reads the wrong field in silence.
- **The CSV is over 2 MB, above Next's data-cache limit**, so the `fetch` is
  `no-store` and what `unstable_cache` keeps (for an hour) is the computed
  32-row result. Don't "fix" this by caching the fetch — it silently stops
  caching anything. There is a second, in-process hourly memo behind
  `unstable_cache` precisely because that failure would be mute and expensive
  (a 2 MB download per page view); it also serves the last good copy when
  GitHub is down.
- **Standings order by win percentage** (a tie counts as half a win), breaking
  ties by point differential, then points for, then abbr. It is a league-wide
  ordering on purpose: it is what compares to a power ranking, not the real
  conference/division standings.

A failed download returns `null` and the page says so; zero games played is a
separate state ("the season has not started"), not a table of zeros.

### Teams (`src/data/teams.ts`)
Static list of the 32 NFL teams (`abbr`, `name`, `location`, colors),
`teamLogoUrl()` resolves the live ESPN logo. `TOTAL_TEAMS` and
`getTeamAbbrs()` drive validation. Submitted `positions` must be exactly
`TOTAL_TEAMS` unique, known team `abbr`s. `getTeamByAbbr` throws on an
unknown abbr; use `findTeamByAbbr` where the id may not (yet) be valid.

### Power metric data (`src/data/power-metric.ts`)
Static point-differential values per team `abbr` (`null` = no data), used in
the admin dashboard to compare consensus vs an objective metric. Uses
competition ranking (1,2,2,4) for ties. Rendered behind a checkbox in the admin
dashboard, never in the public UI. **The 32 values are still placeholders**
(hand-written point differentials, no real 2026 data) — update them before
using the comparison for anything serious.

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

## The evolution video (`src/lib/video/`)

A 10 s, 1080×1920 video that starts with the previous ranking and moves every
team to its new position. Offered on `/vote/success` (previous save → ranking
just saved) and on `/historico/[snapshotId]` (previous screenshot's consensus →
this screenshot's), linked from the admin screenshot list.

- **It is rendered client-side.** `RankingVideoExport` paints each frame on a
  `<canvas>` and records `canvas.captureStream()` with `MediaRecorder` for the
  10 real seconds. There is no server-side encoding (no ffmpeg on Vercel), so
  the tab has to stay visible while it records. MP4 where the browser supports
  it, WebM otherwise.
- `animation.ts` is **pure and unit-tested**: timeline constants, `buildTracks`
  (from/to positions + delta per team), easing and `positionAt`. Change the
  timings there, not in the drawing code.
- `scene.ts` draws one frame with the same palette as the Satori images
  (`lib/og/theme.ts`): header, fixed 01→32 slot column and one moving card per
  team.
- Team logos come from `/api/team-logo/[abbr]`, a same-origin proxy of the ESPN
  logo: a canvas that has drawn a cross-origin image is tainted and cannot be
  captured. Only the 32 known abbrs are proxied.

## Auth & access model

Two independent layers, both JWT cookies signed with `SESSION_SECRET`
(HS256, `httpOnly`, `secure` in prod):

1. **Admin** (`lib/auth.ts`, cookie `admin_session`, 12h): password
   `ADMIN_PASSWORD`, constant-time compared. Full access to the panel.
2. **User** (`lib/user-auth.ts`, cookie `user_session`, 30 days): `sub` is the
   user id; `getCurrentUser()` resolves it against the DB. Required to save a
   ranking and to browse the histórico.

`middleware.ts` enforces: `/vote`, `/consenso`, `/realidad`, `/historico`,
`/equipos`, `/usuarios` and `/perfil` need a user (or admin) session; `/` redirects to
`/vote` when already logged in;
everything under `/admin` and `/api/admin` requires the admin session, except
the `/admin` page itself (it renders the login form) and `/api/admin/login`.
Route handlers re-check the session as defense in depth. Cookie names live in
`lib/cookie-names.ts` because the middleware runs on Edge and must not pull in
the DB client.

Login answers with the same message for unknown email and wrong password.

`/api/auth/login`, `/api/auth/register` and `/api/admin/login` are throttled by
`lib/rate-limit.ts`, with the quotas in `lib/auth-throttle.ts`. **Only failed
attempts count**, and a success clears the key, so a normal user never hits the
limit; over quota the route answers `429` with `Retry-After` and a Spanish
message the existing forms already surface. Login is limited per email
(8 / 15 min) and per IP (25 / 15 min — deliberately loose, the community shares
wifi); registration per IP (10 / 15 min, since every wrong community password
burns a bcrypt); admin login per IP (8 / 15 min). The counters live **in the
process**, so on Vercel each instance has its own: enough to stop brute force
from one origin and to cap CPU spent on bcrypt, not a distributed limiter. A
Postgres-backed one would add a write per attempt and a migration that login
would then depend on.

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
- **Tests** live next to the code as `*.test.ts` and run under Vitest. Today
  there are 12 files / 119 tests: `ranking-algorithm`, `ranking-deviation`,
  `ranking-evolution`, `ranking-dispersion`, `ranking-season`, `nfl-results`,
  `slug`, `video/animation`, `data/power-metric`, `rate-limit`, `db/client`
  (only the pure `isUndefinedColumnError` helper) and `db/migrations`.
- **`db/migrations.test.ts` is the one test that runs SQL.** It does
  `vi.mock("@vercel/postgres", () => import("./test-db"))`, which swaps the
  driver for a PGlite-backed shim — real Postgres in WASM, in-process. So it
  still needs no `.env.local`, no server and no `POSTGRES_URL`, and it covers
  what unit tests cannot: that `runMigrations()` is idempotent, that it upgrades
  an already-created database (the PR #11 bug), that the legacy `voting_type`
  enum migration still works, and that **every query in `db/client.ts` matches
  the schema the migration leaves**. Add a column and a query that uses it →
  add it to that smoke test.

## Database migrations

`src/lib/db/migrations.ts` holds the single, **idempotent** migration
(`runMigrations()`), run either from the CLI (`npm run db:migrate`, a thin
wrapper in `migrate.ts`) or from the deployed app via `POST /api/admin/migrate`
— the button in `/admin/ajustes`. The route exists because Vercel's *sensitive*
env vars can't be pulled locally, so `vercel env pull` may leave `POSTGRES_URL`
empty. It creates the `votings`, `rankings`, `users`,
`snapshots` and `snapshot_entries` tables, adds `rankings.user_id` (linking any
pre-existing ranking to an account with the same email), adds
`rankings.previous_positions` / `previous_saved_at`, seeds
the NFL Alicante row with a random placeholder password (printed to stdout —
change it in `/admin/ajustes`), migrates pre-existing rows from the old
`voting_type` enum to the UUID FK, drops the now unused `position` /
`admin_password_hash` columns, and deletes leftover votings — silently when
they have no rankings, otherwise only with
`npm run db:migrate -- --purge-extra-votings`.

`runMigrations()` takes `{ purgeExtraVotings?, log? }` and **returns the log
lines** as `string[]`: the CLI prints them, and `/api/admin/migrate`
(`maxDuration = 60`, admin session required) sends them back so
`RunMigrationsPanel` can show them in `/admin/ajustes`. On failure the route
answers `500` with the Postgres `code` and `message`, which is what makes a
"Database error" diagnosable from the browser. There is no migration framework;
extend `runMigrations()` with `CREATE TABLE IF NOT EXISTS` / guarded `ALTER`s
and keep it re-runnable. Guarded `ALTER`s go in the `ensure*` helpers, which
run on **every** migration — never behind a "the table did not exist" branch,
or existing databases never get the new columns.

## Project state

The app is feature-complete for the 2026 season and deployed on Vercel; work
since the fork has been small, single-purpose PRs. Reading them in order is the
fastest way to see how the current shape was reached:

| PR | What it landed |
| --- | --- |
| — | `5c43788` fork of QBRankings: the ranked entity becomes a team |
| #1 | one single voting (NFL Alicante), password-gated access, no voting selector |
| #2 | user accounts, screenshots and week-to-week evolution (the current core) |
| #3 | the board starts with all 32 teams; the "available teams" column is gone |
| #4 | `/consenso`: live consensus compared with your own ranking |
| #5 | wording of the `/vote/success` button |
| #6, #7 | mean deviation computed **leave-one-out**, and limited to that metric — the rest of `/consenso` (diffs, "Clavados", over/underrated) compares against the consensus actually shown, your vote included |
| #8, #9 | `/usuarios`: browse anyone's ranking, compared with **yours** (not with the consensus) |
| #10 | the 10 s evolution video (`lib/video/`, `previous_positions`) |
| #11 | the "Database error" on save: `ensure*` helpers now run on every migration, plus the `42703` fallback and the migrations button in `/admin/ajustes` |

Known rough edges, in case a change lands near them:

- **`data/power-metric.ts` still holds invented numbers**, and is now redundant:
  `/realidad` compares the consensus against actual results. The admin
  checkbox that overlays it is the last thing using it.
- **`/realidad` has nothing to show until the season starts.** As of the 2026
  schedule nflverse publishes all 272 regular-season games with empty scores,
  so the page renders its "the season has not started" state. That path is the
  one that has been seen working; the populated one has only been exercised
  against 2025 data in a scratch script.
- **No email delivery.** Password recovery is an admin typing a temporary one in
  `/admin/usuarios`; registration is gated by the community password instead of
  by verification.
- **The `votings` table is a single-row leftover** of the multi-voting era. Don't
  build features that assume more rows; `getVoting()` is the only entry point.
- **`public/vikings.png` is unused**, left over from the fork.
- **The video only records with the tab visible** (real 10 s of `MediaRecorder`);
  there is no server-side fallback.
- **A migration that adds a column still has to be deployed *and* run.**
  `db/migrations.test.ts` now catches the schema/query mismatch before it ships
  (it runs the real migration against PGlite and then every `db/client.ts`
  query), but nothing checks that somebody actually pressed the button in
  `/admin/ajustes` on production.

## Git workflow

- Branch names follow `claude/<slug>`; open PRs into the default branch
  (history shows squash/merge of feature PRs).
- Commit messages are short, often Conventional Commits
  (`feat(admin): …`, `fix(schemas): …`, `chore: …`), in Spanish or English.
- Do **not** create a PR unless explicitly asked.
