import type { GlobalRankingEntry } from "./ranking-algorithm";
import { computeGlobalRanking } from "./ranking-algorithm";

export type DeviationEntry = {
  qbId: string;
  voterPos: number;
  consensusPos: number;
  diff: number;
};

export type DeviationResult = {
  meanAbsDeviation: number;
  perQb: DeviationEntry[];
};

export function computeDeviation(
  voterPositions: string[],
  consensusRanking: GlobalRankingEntry[],
): DeviationResult {
  const consensusPosByQb = new Map<string, number>();
  for (const entry of consensusRanking) {
    consensusPosByQb.set(entry.qbId, entry.finalPosition);
  }

  const perQb: DeviationEntry[] = [];
  let totalAbs = 0;
  let count = 0;
  voterPositions.forEach((qbId, idx) => {
    const consensusPos = consensusPosByQb.get(qbId);
    if (consensusPos === undefined) return;
    const voterPos = idx + 1;
    const diff = consensusPos - voterPos;
    perQb.push({ qbId, voterPos, consensusPos, diff });
    totalAbs += Math.abs(diff);
    count += 1;
  });

  return {
    meanAbsDeviation: count === 0 ? 0 : totalAbs / count,
    perQb,
  };
}

/**
 * Desviación "leave-one-out": compara el ranking de un votante contra el
 * consenso calculado SIN su propio voto. Evita el sesgo de auto-comparación
 * (un votante extremo arrastra el consenso hacia sí mismo y parecería menos
 * desviado de lo que realmente es).
 *
 * `otherRankings` son todos los rankings EXCEPTO el del votante; el llamante
 * se encarga de excluirlo. Si no hay otros votantes no existe un consenso
 * ajeno contra el que comparar, así que el votante es el único y se compara
 * consigo mismo (desviación 0).
 */
export function computeDeviationLeaveOneOut(
  voterPositions: string[],
  otherRankings: string[][],
): DeviationResult {
  const basis = otherRankings.length > 0 ? otherRankings : [voterPositions];
  const consensus = computeGlobalRanking(basis);
  return computeDeviation(voterPositions, consensus.ranking);
}

export function topOverratedUnderrated(
  perQb: DeviationEntry[],
  n = 3,
): { overrated: DeviationEntry[]; underrated: DeviationEntry[] } {
  const sortedDesc = [...perQb].sort((a, b) => b.diff - a.diff);
  const overrated = sortedDesc.filter((e) => e.diff > 0).slice(0, n);
  const underrated = sortedDesc
    .filter((e) => e.diff < 0)
    .slice(-n)
    .reverse();
  return { overrated, underrated };
}
