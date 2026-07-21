// Valores de diferencial de puntos (puntos anotados - puntos recibidos) por
// equipo para la temporada en curso. Mapeados al `abbr` de cada equipo en
// `src/data/teams.ts`. Lista provisional: actualizar con datos reales cuando
// estén disponibles.
export const METRIC_BY_TEAM: Record<string, number | null> = {
  BUF: 148,
  DET: 132,
  BAL: 121,
  PHI: 118,
  KC: 104,
  SF: 98,
  LAR: 91,
  MIN: 87,
  GB: 82,
  DEN: 76,
  TB: 71,
  PIT: 65,
  LAC: 58,
  HOU: 52,
  SEA: 47,
  IND: 41,
  CIN: 33,
  ATL: 28,
  ARI: 22,
  DAL: 15,
  CHI: 9,
  MIA: 3,
  NYJ: -6,
  WAS: -6,
  NE: -14,
  JAX: -21,
  NO: -29,
  CAR: -38,
  LV: -47,
  NYG: -58,
  TEN: -71,
  CLE: -89,
};

export type MetricInfo = {
  value: number | null;
  // Puesto en el ranking de diferencial de puntos (1 = mejor). null si no hay valor.
  rank: number | null;
};

// Calcula el ranking de diferencial de puntos con competition ranking (1, 2, 2, 4):
// mayor diferencial = mejor puesto, los empates comparten puesto y el siguiente salta.
// Los equipos sin valor (null) reciben rank null.
function buildMetricRanking(): Map<string, MetricInfo> {
  const map = new Map<string, MetricInfo>();

  const valued = Object.entries(METRIC_BY_TEAM)
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .sort((a, b) => b[1] - a[1]);

  let lastValue: number | null = null;
  let lastRank = 0;
  valued.forEach(([abbr, value], index) => {
    const rank = value === lastValue ? lastRank : index + 1;
    map.set(abbr, { value, rank });
    lastValue = value;
    lastRank = rank;
  });

  for (const [abbr, value] of Object.entries(METRIC_BY_TEAM)) {
    if (value === null) map.set(abbr, { value: null, rank: null });
  }

  return map;
}

const METRIC_RANKING = buildMetricRanking();

export function computeMetricRanking(): Map<string, MetricInfo> {
  return METRIC_RANKING;
}

export function getMetricByTeamAbbr(abbr: string): MetricInfo | undefined {
  return METRIC_RANKING.get(abbr);
}
