import { findTeamByAbbr } from "@/data/teams";

/**
 * Resultados reales de la NFL a partir del CSV de nflverse.
 *
 * Puro, sin IO: recibe el texto del CSV ya descargado. La descarga y su
 * caché viven en `nfl-standings.ts`.
 *
 * Fuente: https://github.com/nflverse/nfldata — `data/games.csv`, una fila por
 * partido desde 1999, con el marcador vacío mientras no se haya jugado.
 */

export const NFLVERSE_GAMES_URL =
  "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

/** La temporada que se está votando. */
export const CURRENT_SEASON = 2026;

/**
 * nflverse llama `LA` a los Rams y `teams.ts` los llama `LAR`; es la única
 * diferencia en 2026. Las demás son reubicaciones antiguas: no aparecen
 * filtrando por temporada actual, pero cuestan cero y dejan escrita la trampa.
 */
const ABBR_OVERRIDES: Record<string, string> = {
  LA: "LAR",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
};

export function normalizeTeamAbbr(abbr: string): string {
  return ABBR_OVERRIDES[abbr] ?? abbr;
}

export type GameRow = {
  season: number;
  gameType: string;
  week: number;
  awayTeam: string;
  homeTeam: string;
  /** `null` mientras el partido no se ha jugado. */
  awayScore: number | null;
  homeScore: number | null;
};

export type TeamRecord = {
  teamAbbr: string;
  wins: number;
  losses: number;
  ties: number;
  played: number;
  /** Empate = media victoria, como en la clasificación oficial. */
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

/**
 * Parte una línea de CSV respetando las comillas. Hoy ningún campo entre
 * comillas de `games.csv` contiene comas, pero varios son texto libre (estadio,
 * entrenador), así que partir por comas a secas es una bomba de relojería.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        // Dos comillas seguidas dentro de un campo entrecomillado = una comilla.
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee el CSV entero. Las columnas se localizan **por nombre**, no por posición:
 * nflverse añade columnas de vez en cuando y por posición eso se rompe en
 * silencio, leyendo el campo equivocado.
 */
export function parseGamesCsv(text: string): GameRow[] {
  const lines = text.split("\n");
  const header = lines[0];
  if (!header) return [];

  const columns = splitCsvLine(header).map((c) => c.trim());
  const idx = (name: string) => columns.indexOf(name);
  const iSeason = idx("season");
  const iType = idx("game_type");
  const iWeek = idx("week");
  const iAway = idx("away_team");
  const iAwayScore = idx("away_score");
  const iHome = idx("home_team");
  const iHomeScore = idx("home_score");

  // Sin las columnas que nos importan no hay nada que interpretar: mejor una
  // lista vacía (y la página en su estado "sin datos") que filas basura.
  if ([iSeason, iType, iWeek, iAway, iAwayScore, iHome, iHomeScore].includes(-1)) {
    return [];
  }

  const games: GameRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const fields = splitCsvLine(line);
    const season = toNumberOrNull(fields[iSeason]);
    const week = toNumberOrNull(fields[iWeek]);
    if (season === null || week === null) continue;

    games.push({
      season,
      gameType: (fields[iType] ?? "").trim(),
      week,
      awayTeam: normalizeTeamAbbr((fields[iAway] ?? "").trim()),
      homeTeam: normalizeTeamAbbr((fields[iHome] ?? "").trim()),
      awayScore: toNumberOrNull(fields[iAwayScore]),
      homeScore: toNumberOrNull(fields[iHomeScore]),
    });
  }
  return games;
}

type StandingsOptions = {
  season: number;
  /** Por defecto solo temporada regular. */
  gameTypes?: readonly string[];
};

/**
 * Clasificación de la temporada: victorias, derrotas, empates y puntos de cada
 * equipo, contando solo los partidos ya jugados. Los equipos que no conoce
 * `teams.ts` se descartan, para que un cambio de nomenclatura en el origen no
 * meta filas fantasma en la web.
 */
export function computeStandings(
  games: readonly GameRow[],
  { season, gameTypes = ["REG"] }: StandingsOptions,
): TeamRecord[] {
  const types = new Set(gameTypes);
  const byTeam = new Map<string, TeamRecord>();

  const record = (teamAbbr: string): TeamRecord | null => {
    if (!findTeamByAbbr(teamAbbr)) return null;
    let r = byTeam.get(teamAbbr);
    if (!r) {
      r = {
        teamAbbr,
        wins: 0,
        losses: 0,
        ties: 0,
        played: 0,
        winPct: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      };
      byTeam.set(teamAbbr, r);
    }
    return r;
  };

  for (const game of games) {
    if (game.season !== season) continue;
    if (!types.has(game.gameType)) continue;
    // Sin marcador el partido no se ha jugado (o no se ha cargado todavía).
    if (game.homeScore === null || game.awayScore === null) continue;

    const home = record(game.homeTeam);
    const away = record(game.awayTeam);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.pointsFor += game.homeScore;
    home.pointsAgainst += game.awayScore;
    away.pointsFor += game.awayScore;
    away.pointsAgainst += game.homeScore;

    if (game.homeScore > game.awayScore) {
      home.wins++;
      away.losses++;
    } else if (game.homeScore < game.awayScore) {
      away.wins++;
      home.losses++;
    } else {
      home.ties++;
      away.ties++;
    }
  }

  for (const r of byTeam.values()) {
    r.pointDiff = r.pointsFor - r.pointsAgainst;
    r.winPct = r.played === 0 ? 0 : (r.wins + r.ties / 2) / r.played;
  }

  return [...byTeam.values()].sort(compareRecords);
}

/**
 * Mejor primero. Desempata por diferencia de puntos y luego por puntos a
 * favor; el `abbr` cierra para que el orden sea estable y no dependa de en qué
 * orden se recorrieron los partidos.
 */
function compareRecords(a: TeamRecord, b: TeamRecord): number {
  if (b.winPct !== a.winPct) return b.winPct - a.winPct;
  if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  return a.teamAbbr.localeCompare(b.teamAbbr);
}

/** La clasificación como lista ordenada de `abbr`, igual que un consensus. */
export function standingsOrder(records: readonly TeamRecord[]): string[] {
  return records.map((r) => r.teamAbbr);
}

/** Partidos ya jugados en la temporada, para saber si hay algo que enseñar. */
export function playedGames(games: readonly GameRow[], season: number): number {
  return games.filter(
    (g) =>
      g.season === season &&
      g.gameType === "REG" &&
      g.homeScore !== null &&
      g.awayScore !== null,
  ).length;
}
