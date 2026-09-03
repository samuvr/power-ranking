import { TOTAL_TEAMS } from "@/data/teams";

/**
 * Cuánto se separan los votantes entre sí sobre un mismo equipo.
 *
 * El consensus dice en qué puesto acaba cada equipo; esto dice si ese puesto
 * es una opinión compartida o la media de una pelea. Un equipo que todo el
 * mundo pone 5º y otro que la mitad pone 1º y la otra mitad 12º pueden salir
 * en el mismo sitio del ranking global.
 *
 * Puro: recibe arrays de posiciones, no toca la base de datos.
 */

export type TeamDispersion = {
  teamAbbr: string;
  /** Cuántos rankings incluyen al equipo. */
  votes: number;
  /** Mejor puesto que le ha dado alguien (el número más bajo). */
  best: number;
  /** Peor puesto que le ha dado alguien. */
  worst: number;
  mean: number;
  median: number;
  /** `worst - best`: cuántos puestos separan al más y al menos entusiasta. */
  spread: number;
  /** Desviación típica poblacional de los puestos recibidos. */
  stdDev: number;
};

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Estadísticos de dispersión de cada equipo, ordenados de más a menos
 * discutido. Los equipos que no aparecen en ningún ranking se omiten.
 */
export function computeDispersion(allRankings: readonly (readonly string[])[]): TeamDispersion[] {
  const positionsByTeam = new Map<string, number[]>();

  for (const ranking of allRankings) {
    ranking.forEach((teamAbbr, idx) => {
      const list = positionsByTeam.get(teamAbbr);
      if (list) list.push(idx + 1);
      else positionsByTeam.set(teamAbbr, [idx + 1]);
    });
  }

  const result: TeamDispersion[] = [];
  for (const [teamAbbr, positions] of positionsByTeam) {
    const sorted = [...positions].sort((a, b) => a - b);
    const mean = positions.reduce((acc, p) => acc + p, 0) / positions.length;
    const variance =
      positions.reduce((acc, p) => acc + (p - mean) ** 2, 0) / positions.length;
    result.push({
      teamAbbr,
      votes: positions.length,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      mean,
      median: median(sorted),
      spread: sorted[sorted.length - 1] - sorted[0],
      stdDev: Math.sqrt(variance),
    });
  }

  return result.sort(compareDispersion);
}

// Más discutido primero. Desempata por recorrido y luego por abbr, para que
// el orden no dependa de cómo se recorrió el Map.
function compareDispersion(a: TeamDispersion, b: TeamDispersion): number {
  if (b.stdDev !== a.stdDev) return b.stdDev - a.stdDev;
  if (b.spread !== a.spread) return b.spread - a.spread;
  return a.teamAbbr.localeCompare(b.teamAbbr);
}

export function dispersionByTeam(list: readonly TeamDispersion[]): Map<string, TeamDispersion> {
  return new Map(list.map((d) => [d.teamAbbr, d]));
}

/** Los `count` equipos con más desacuerdo. */
export function mostDivisive(list: readonly TeamDispersion[], count: number): TeamDispersion[] {
  return [...list].sort(compareDispersion).slice(0, Math.max(0, count));
}

/** Los `count` equipos en los que más de acuerdo estáis. */
export function mostAgreed(list: readonly TeamDispersion[], count: number): TeamDispersion[] {
  return [...list].sort((a, b) => -compareDispersion(a, b)).slice(0, Math.max(0, count));
}

/**
 * Reparte los puestos recibidos en tramos para dibujar un histograma. Con 32
 * equipos y 8 tramos cada barra son 4 puestos.
 */
export function positionHistogram(
  allRankings: readonly (readonly string[])[],
  teamAbbr: string,
  buckets = 8,
): Array<{ from: number; to: number; count: number }> {
  const size = Math.ceil(TOTAL_TEAMS / buckets);
  const bins = Array.from({ length: buckets }, (_, i) => ({
    from: i * size + 1,
    to: Math.min((i + 1) * size, TOTAL_TEAMS),
    count: 0,
  }));

  for (const ranking of allRankings) {
    const idx = ranking.indexOf(teamAbbr);
    if (idx === -1) continue;
    // El último tramo absorbe cualquier puesto por encima de TOTAL_TEAMS.
    const bin = Math.min(Math.floor(idx / size), buckets - 1);
    bins[bin].count++;
  }

  return bins;
}
