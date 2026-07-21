export type Round = { count: number; points: number[] };

export const ROUNDS: Round[] = [
  { count: 5, points: [5, 4, 3, 2, 1] }, // posiciones 32 → 28
  { count: 5, points: [5, 4, 3, 2, 1] }, // 27 → 23
  { count: 5, points: [5, 4, 3, 2, 1] }, // 22 → 18
  { count: 5, points: [5, 4, 3, 2, 1] }, // 17 → 13
  { count: 4, points: [4, 3, 2, 1] }, //   12 → 9
  { count: 4, points: [4, 3, 2, 1] }, //   8 → 5
  { count: 4, points: [4, 3, 2, 1] }, //   4 → 1
];

export type GlobalRankingEntry = {
  teamAbbr: string;
  finalPosition: number;
  pointsInRound: number;
  roundIndex: number;
};

export type RoundBreakdown = {
  roundIndex: number;
  positionsAssigned: [number, number];
  scores: Array<{ teamAbbr: string; points: number; assigned: boolean }>;
};

export type GlobalRankingResult = {
  ranking: GlobalRankingEntry[];
  totalSubmissions: number;
  rounds: RoundBreakdown[];
};

type TeamStats = {
  positionCounts: Map<number, number>;
  sortedUniqueDesc: number[];
  sum: number;
};

function buildTeamStats(allRankings: string[][]): Map<string, TeamStats> {
  const stats = new Map<string, TeamStats>();
  for (const ranking of allRankings) {
    ranking.forEach((teamAbbr, idx) => {
      const pos = idx + 1;
      let s = stats.get(teamAbbr);
      if (!s) {
        s = { positionCounts: new Map(), sortedUniqueDesc: [], sum: 0 };
        stats.set(teamAbbr, s);
      }
      s.positionCounts.set(pos, (s.positionCounts.get(pos) ?? 0) + 1);
      s.sum += pos;
    });
  }
  for (const s of stats.values()) {
    s.sortedUniqueDesc = [...s.positionCounts.keys()].sort((a, b) => b - a);
  }
  return stats;
}

// Devuelve negativo si `aId` debe ir antes en `sortedScores` (peor → recibe
// peor posición final). Cadena de 5 criterios: peor única, veces que la recibe,
// segunda peor única, veces que la recibe y, en último lugar, suma total.
function compareTie(aId: string, bId: string, stats: Map<string, TeamStats>): number {
  const a = stats.get(aId);
  const b = stats.get(bId);
  if (!a || !b) return 0;

  const aWorst = a.sortedUniqueDesc[0] ?? 0;
  const bWorst = b.sortedUniqueDesc[0] ?? 0;
  if (aWorst !== bWorst) return bWorst - aWorst;

  const aWorstCount = a.positionCounts.get(aWorst) ?? 0;
  const bWorstCount = b.positionCounts.get(bWorst) ?? 0;
  if (aWorstCount !== bWorstCount) return bWorstCount - aWorstCount;

  const aSecond = a.sortedUniqueDesc[1] ?? 0;
  const bSecond = b.sortedUniqueDesc[1] ?? 0;
  if (aSecond !== bSecond) return bSecond - aSecond;

  const aSecondCount = a.positionCounts.get(aSecond) ?? 0;
  const bSecondCount = b.positionCounts.get(bSecond) ?? 0;
  if (aSecondCount !== bSecondCount) return bSecondCount - aSecondCount;

  return b.sum - a.sum;
}

/**
 * Computes the global ranking using the iterative bottom-up algorithm.
 * `allRankings` is an array of user rankings, each being an ordered array
 * of team ids from position 1 (best) to position N (worst).
 */
export function computeGlobalRanking(allRankings: string[][]): GlobalRankingResult {
  const orderedWorstFirst: GlobalRankingEntry[] = [];
  const orderedSet = new Set<string>();
  const breakdowns: RoundBreakdown[] = [];
  const teamStats = buildTeamStats(allRankings);

  for (let roundIdx = 0; roundIdx < ROUNDS.length; roundIdx++) {
    const round = ROUNDS[roundIdx];
    const scores = new Map<string, number>();

    for (const ranking of allRankings) {
      const unranked = ranking.filter((team) => !orderedSet.has(team));
      const bottomN = unranked.slice(-round.count);
      // bottomN[bottomN.length - 1] = peor del votante → recibe points[0]
      for (let i = 0; i < bottomN.length; i++) {
        const team = bottomN[bottomN.length - 1 - i];
        scores.set(team, (scores.get(team) ?? 0) + round.points[i]);
      }
    }

    const sortedScores = [...scores.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return compareTie(a[0], b[0], teamStats);
    });

    const startPos = 32 - orderedWorstFirst.length;
    const taken = sortedScores.slice(0, round.count);

    for (let i = 0; i < taken.length; i++) {
      const [teamAbbr, points] = taken[i];
      const finalPosition = startPos - i;
      orderedWorstFirst.push({ teamAbbr, finalPosition, pointsInRound: points, roundIndex: roundIdx });
      orderedSet.add(teamAbbr);
    }

    breakdowns.push({
      roundIndex: roundIdx,
      positionsAssigned: [startPos - taken.length + 1, startPos],
      scores: sortedScores.map(([teamAbbr, points]) => ({
        teamAbbr,
        points,
        assigned: orderedSet.has(teamAbbr),
      })),
    });
  }

  const ranking = [...orderedWorstFirst].sort((a, b) => a.finalPosition - b.finalPosition);

  return {
    ranking,
    totalSubmissions: allRankings.length,
    rounds: breakdowns,
  };
}
