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
npm run build        # build de producción
npm run db:migrate   # crea las tablas votings + rankings (idempotente)
                     # -- --purge-extra-votings borra votaciones antiguas
                     #    sobrantes junto con sus rankings
npm test             # tests del algoritmo (vitest)
npm run lint         # eslint
```

## Flujo

1. `/` — landing con nombre + email + contraseña de la votación. No hay que
   elegir votación: solo existe NFL Alicante.
2. `POST /api/voting/access` — valida la contraseña y deja la cookie de
   votante.
3. `/vote` — tap en un equipo para colocarlo, botones ↑/↓/✕ para reordenar,
   autosave en `localStorage`.
4. `POST /api/rankings` — upsert por `(email, voting)`.
5. `/vote/success?id=…` — muestra la imagen PNG generada por
   `/api/rankings/[id]/image`.
6. `/admin` — login con `ADMIN_PASSWORD`; tras auth muestra el ranking global.
   `/admin/ajustes` edita nombre, colores, logo, apertura de la votación y la
   contraseña de votante.

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
