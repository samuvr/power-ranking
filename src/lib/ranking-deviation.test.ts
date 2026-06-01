import { describe, expect, it } from "vitest";
import {
  computeDeviation,
  computeDeviationLeaveOneOut,
  topOverratedUnderrated,
} from "./ranking-deviation";
import { computeGlobalRanking } from "./ranking-algorithm";

function makeRanking(ids: number[]): string[] {
  return ids.map((n) => `qb${n.toString().padStart(2, "0")}`);
}

const IDENTITY = Array.from({ length: 32 }, (_, i) => i + 1);

describe("computeDeviation", () => {
  it("returns zero deviation when voter matches consensus exactly", () => {
    const ranking = makeRanking(IDENTITY);
    const consensus = computeGlobalRanking([ranking]).ranking;
    const result = computeDeviation(ranking, consensus);

    expect(result.meanAbsDeviation).toBe(0);
    expect(result.perQb).toHaveLength(32);
    expect(result.perQb.every((e) => e.diff === 0)).toBe(true);
  });

  it("computes per-QB diff as consensusPos - voterPos and averages the abs", () => {
    // Con un único votante identidad, el consenso coloca qbXX en la posición XX.
    const consensus = computeGlobalRanking([makeRanking(IDENTITY)]).ranking;
    // El votante intercambia qb02 y qb04 dentro de la lista de 32.
    const voter = makeRanking([1, 4, 3, 2, ...IDENTITY.slice(4)]);
    const result = computeDeviation(voter, consensus);

    const byQb = new Map(result.perQb.map((e) => [e.qbId, e]));
    // qb04: consenso 4, votante 2 → diff +2 (sobrevalorado)
    expect(byQb.get("qb04")?.diff).toBe(2);
    // qb02: consenso 2, votante 4 → diff -2 (infravalorado)
    expect(byQb.get("qb02")?.diff).toBe(-2);
    // Solo dos QBs se desvían (±2 cada uno); el resto coincide.
    expect(result.meanAbsDeviation).toBe(4 / 32);
  });

  it("ignores voter QBs absent from the consensus", () => {
    const consensus = computeGlobalRanking([makeRanking([1, 2, 3])]).ranking;
    const voter = [...makeRanking([1, 2, 3]), "qb99"];
    const result = computeDeviation(voter, consensus);

    expect(result.perQb).toHaveLength(3);
    expect(result.perQb.some((e) => e.qbId === "qb99")).toBe(false);
  });
});

describe("computeDeviationLeaveOneOut", () => {
  it("compares the voter against the consensus built without their vote", () => {
    const extreme = makeRanking([32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const others = [makeRanking(IDENTITY), makeRanking(IDENTITY), makeRanking(IDENTITY)];
    const all = [extreme, ...others];

    const loo = computeDeviationLeaveOneOut(
      extreme,
      others.map((r) => r),
    );
    const naive = computeDeviation(
      extreme,
      computeGlobalRanking(all).ranking,
    );

    // Sin su propio voto el votante extremo se desvía MÁS del consenso,
    // porque ya no arrastra el consenso hacia sí mismo.
    expect(loo.meanAbsDeviation).toBeGreaterThan(naive.meanAbsDeviation);
  });

  it("matches a manually built leave-one-out consensus", () => {
    const target = makeRanking([1, 2, 3, 4]);
    const others = [makeRanking([4, 3, 2, 1]), makeRanking([2, 1, 4, 3])];

    const loo = computeDeviationLeaveOneOut(target, others);
    const manual = computeDeviation(
      target,
      computeGlobalRanking(others).ranking,
    );

    expect(loo.meanAbsDeviation).toBe(manual.meanAbsDeviation);
    expect(loo.perQb).toEqual(manual.perQb);
  });

  it("falls back to self-comparison (deviation 0) when there are no other voters", () => {
    const only = makeRanking(IDENTITY);
    const result = computeDeviationLeaveOneOut(only, []);

    expect(result.meanAbsDeviation).toBe(0);
    expect(result.perQb).toHaveLength(32);
  });
});

describe("topOverratedUnderrated", () => {
  it("splits QBs by sign of diff, most extreme first", () => {
    const consensus = computeGlobalRanking([makeRanking(IDENTITY)]).ranking;
    // El votante intercambia qb01 y qb05 dentro de la lista de 32.
    const voter = makeRanking([5, 2, 3, 4, 1, ...IDENTITY.slice(5)]);
    const { perQb } = computeDeviation(voter, consensus);
    const { overrated, underrated } = topOverratedUnderrated(perQb, 3);

    // qb05: consenso 5, votante 1 → diff +4 (más sobrevalorado)
    expect(overrated[0].qbId).toBe("qb05");
    // qb01: consenso 1, votante 5 → diff -4 (más infravalorado)
    expect(underrated[0].qbId).toBe("qb01");
  });
});
