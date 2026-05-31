// Valores ANY/A (Adjusted Net Yards per Attempt) por QB para la temporada en curso.
// Mapeados al `id` de cada QB en `src/data/qbs.ts`.
// null = sin datos suficientes para evaluar (N/D).
export const ANYA_BY_QB: Record<string, number | null> = {
  "lamar-jackson": 7.93,
  "brock-purdy": 7.77,
  "jared-goff": 7.53,
  "jordan-love": 7.2,
  "matthew-stafford": 7.17,
  "josh-allen": 7.1,
  "drake-maye": 6.7,
  "dak-prescott": 6.67,
  "penix-tua": 6.6,
  "jalen-hurts": 6.53,
  "baker-mayfield": 6.53,
  "joe-burrow": 6.47,
  "c-j-stroud": 6.43,
  "justin-herbert": 6.43,
  "sam-darnold": 6.4,
  "jayden-daniels": 6.3,
  "trevor-lawrence": 6.2,
  "patrick-mahomes": 6.17,
  "aaron-rodgers": 6.1,
  "bo-nix": 6.05,
  "daniel-jones": 6.0,
  "caleb-williams": 5.95,
  "jaxson-dart": 5.9,
  "tyler-shough": 5.9,
  "geno-smith": 5.57,
  "mccarthy-murray": 4.3,
  "jacoby-brisset": 4.95,
  "bryce-young": 4.77,
  "cam-ward": 4.6,
  "cle-qb-room": 4.5,
  "mendoza-cousins": null,
  "malik-willis": null,
};

export type AnyaInfo = {
  value: number | null;
  // Puesto en el ranking de ANY/A (1 = mejor). null si no hay valor.
  rank: number | null;
};

// Calcula el ranking de ANY/A con competition ranking (1, 2, 2, 4):
// mayor ANY/A = mejor puesto, los empates comparten puesto y el siguiente salta.
// Los QBs sin valor (null) reciben rank null.
function buildAnyaRanking(): Map<string, AnyaInfo> {
  const map = new Map<string, AnyaInfo>();

  const valued = Object.entries(ANYA_BY_QB)
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .sort((a, b) => b[1] - a[1]);

  let lastValue: number | null = null;
  let lastRank = 0;
  valued.forEach(([qbId, value], index) => {
    const rank = value === lastValue ? lastRank : index + 1;
    map.set(qbId, { value, rank });
    lastValue = value;
    lastRank = rank;
  });

  for (const [qbId, value] of Object.entries(ANYA_BY_QB)) {
    if (value === null) map.set(qbId, { value: null, rank: null });
  }

  return map;
}

const ANYA_RANKING = buildAnyaRanking();

export function computeAnyaRanking(): Map<string, AnyaInfo> {
  return ANYA_RANKING;
}

export function getAnyaByQbId(id: string): AnyaInfo | undefined {
  return ANYA_RANKING.get(id);
}
