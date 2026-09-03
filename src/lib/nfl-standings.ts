import { unstable_cache } from "next/cache";
import {
  computeStandings,
  NFLVERSE_GAMES_URL,
  parseGamesCsv,
  playedGames,
  standingsOrder,
  type TeamRecord,
} from "./nfl-results";

/**
 * Descarga y caché de los resultados reales. Lo puro (parsear y clasificar)
 * vive en `nfl-results.ts`; aquí solo está el IO.
 */

export type SeasonStandings = {
  season: number;
  records: TeamRecord[];
  /** La clasificación como lista de `abbr`, comparable con un consensus. */
  order: string[];
  /** Partidos de temporada regular ya jugados. 0 = la temporada no ha empezado. */
  played: number;
  fetchedAt: string;
};

const ONE_HOUR_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Memoria de respaldo dentro del proceso.
 *
 * `unstable_cache` ya evita recalcular, pero si algún día dejase de guardar
 * (un cambio de Next, un despliegue sin caché incremental) el fallo sería
 * mudo y carísimo: 2 MB de descarga en cada visita a `/realidad`. Esto
 * garantiza como mucho una descarga por hora y por instancia pase lo que pase.
 */
const memo = new Map<number, { at: number; value: SeasonStandings }>();

async function loadSeasonStandings(season: number): Promise<SeasonStandings | null> {
  const cached = memo.get(season);
  if (cached && Date.now() - cached.at < ONE_HOUR_SECONDS * 1000) {
    return cached.value;
  }

  try {
    // `no-store`: el CSV pasa de 2 MB y la caché de datos de Next no guarda
    // respuestas tan grandes. Lo que se cachea es el resultado ya calculado,
    // que son 32 filas (ver `getSeasonStandings`).
    const res = await fetch(NFLVERSE_GAMES_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`nflverse respondió ${res.status} al pedir los resultados`);
      return null;
    }

    const games = parseGamesCsv(await res.text());
    const records = computeStandings(games, { season });
    const value: SeasonStandings = {
      season,
      records,
      order: standingsOrder(records),
      played: playedGames(games, season),
      fetchedAt: new Date().toISOString(),
    };
    memo.set(season, { at: Date.now(), value });
    return value;
  } catch (err) {
    // Una caída de GitHub no puede tumbar la página. Si hay una copia previa,
    // aunque esté pasada de hora, es mejor que un hueco: `fetchedAt` dice al
    // usuario de cuándo son los datos.
    console.warn("No se han podido cargar los resultados de nflverse", err);
    return cached?.value ?? null;
  }
}

/**
 * Clasificación real de la temporada, recalculada como mucho una vez por hora.
 * Se cachea el resultado (32 filas), no el CSV.
 */
export const getSeasonStandings = unstable_cache(
  loadSeasonStandings,
  ["nfl-season-standings"],
  { revalidate: ONE_HOUR_SECONDS, tags: ["nfl-season-standings"] },
);
