# Team Power Rankings

Webapp para crear y compartir tu Power Ranking de los 32 equipos titulares de
la NFL 2026, con una votación única (NFL Alicante) protegida por contraseña y
panel de admin con el ranking global calculado mediante un algoritmo iterativo
bottom-up.

Este proyecto es un fork de [QBRankings](https://github.com/samuvr/qbrankings),
adaptado para rankear equipos en lugar de quarterbacks.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Vercel Postgres (Neon) con `@vercel/postgres`
- Generación de imagen con `next/og` (Satori)
- Generación de vídeo en el navegador (canvas + `MediaRecorder`)
- Auth admin con cookie JWT (`jose`) + `ADMIN_PASSWORD` en `.env`
- Acceso de votantes con cookie JWT + contraseña hasheada (`bcryptjs`) en BD

## Variables de entorno

Copia `.env.example` a `.env.local`:

```
POSTGRES_URL=…              # se rellena tras conectar Vercel Postgres
ADMIN_PASSWORD=changeme
SESSION_SECRET=<32+ chars random>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

En Vercel, `vercel env pull` los descarga al `.env.local` automáticamente
después de conectar la base de datos al proyecto.

## Scripts

```
npm run dev          # arranca en http://localhost:3000
npm run build        # build de producción (y el único typecheck del repo)
npm run db:migrate   # crea las tablas votings + rankings (idempotente)
                     # -- --purge-extra-votings borra votaciones antiguas
                     #    sobrantes junto con sus rankings
                     # también desde /admin/ajustes → "Ejecutar migraciones",
                     #    útil si POSTGRES_URL es sensitive y no se puede
                     #    descargar con vercel env pull
npm test             # tests: algoritmo, evolución, vídeo, rate limit y
                     #    migraciones (estas contra PGlite, sin base de datos)
npm run lint         # eslint
```

Cada pull request y cada push a `main` pasan por `.github/workflows/ci.yml`,
que ejecuta lint, tests y build en Node 22.

## Flujo

1. `/` — landing con nombre + email + contraseña de la votación. No hay que
   elegir votación: solo existe NFL Alicante.
2. `POST /api/voting/access` — valida la contraseña y deja la cookie de
   votante.
3. `/vote` — tap en un equipo para colocarlo, botones ↑/↓/✕ para reordenar,
   autosave en `localStorage`.
4. `POST /api/rankings` — upsert por `(email, voting)`.
5. `/vote/success?id=…` — muestra la imagen PNG generada por
   `/api/rankings/[id]/image` y permite generar el vídeo de 10 s con el
   movimiento respecto al ranking anterior.
6. `/admin` — login con `ADMIN_PASSWORD`; tras auth muestra el ranking global.
   `/admin/ajustes` edita nombre, colores, logo, apertura de la votación y la
   contraseña de votante.

## Vídeo de evolución (10 s)

Tanto al guardar un ranking (`/vote/success`) como en la ficha de un
screenshot (`/historico/[snapshotId]`) hay un botón que genera un vídeo
vertical 1080×1920 de 10 segundos: arranca con los equipos en sus puestos
anteriores, cada uno viaja hasta su nuevo puesto y termina en el ranking
actual con las flechas de evolución.

- El punto de partida es la versión anterior del propio ranking
  (`rankings.previous_positions`, que se guarda en cada reordenación) y, si es
  la primera, el ranking congelado del último screenshot. En un screenshot es
  el consensus del screenshot anterior.
- Se genera **en el navegador**: `src/lib/video/scene.ts` pinta cada fotograma
  en un canvas y `MediaRecorder` graba su stream durante los 10 s reales. Sale
  MP4 donde el navegador lo soporta y WebM en el resto. No hace falta ffmpeg ni
  ningún servicio externo, pero hay que dejar la pestaña visible mientras se
  graba.
- Los escudos se sirven vía `/api/team-logo/[abbr]` (proxy del mismo origen):
  un canvas con imágenes de otro dominio queda contaminado y no se puede
  capturar.
- La línea de tiempo (`src/lib/video/animation.ts`) es pura y está testeada.

## Datos de equipos

`src/data/teams.ts` contiene los 32 equipos de la NFL (abreviatura, nombre,
ciudad, colores) y `teamLogoUrl()` resuelve el logo en vivo desde ESPN.
`src/data/power-metric.ts` contiene una métrica objetiva de referencia
(diferencial de puntos) usada en el panel de admin para comparar el consenso
de la votación contra el rendimiento real de cada equipo — es una lista
provisional, actualízala con datos reales de la temporada.

## Algoritmo de ranking global

Implementado en `src/lib/ranking-algorithm.ts`. Bottom-up por bloques:

- Rondas 1–4: top 5 por puntos en los últimos 5 de cada votante (5,4,3,2,1
  pts), asignando los puestos 32→28, 27→23, 22→18, 17→13.
- Rondas 5–7: top 4 por puntos en los últimos 4 (4,3,2,1 pts) para los
  puestos 12→9, 8→5, 4→1.

Tests en `src/lib/ranking-algorithm.test.ts`.
