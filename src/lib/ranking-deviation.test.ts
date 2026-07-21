import { describe, expect, it } from "vitest";
import {
  computeDeviation,
  computeDeviationLeaveOneOut,
  topOverratedUnderrated,
} from "./ranking-deviation";
import { computeGlobalRanking } from "./ranking-algorithm";

function makeRanking(ids: number[]): string[] {
  return ids.map((n) => `team${n.toString().padStart(2, "0")}`);
}

const IDENTITY = Array.from({ length: 32 }, (_, i) => i + 1);

describe("computeDeviation", () => {
  it("returns zero deviation when voter matches consensus exactly", () => {
    const ranking = makeRanking(IDENTITY);
    const consensus = computeGlobalRanking([ranking]).ranking;
    const result = computeDeviation(ranking, consensus);

    expect(result.meanAbsDeviation).toBe(0);
    expect(result.perTeam).toHaveLength(32);
    expect(result.perTeam.every((e) => e.diff === 0)).toBe(true);
  });

  it("computes per-team diff as consensusPos - voterPos and averages the abs", () => {
    // Con un único votante identidad, el consenso coloca teamXX en la posición XX.
    const consensus = computeGlobalRanking([makeRanking(IDENTITY)]).ranking;
    // El votante intercambia team02 y team04 dentro de la lista de 32.
    const voter = makeRanking([1, 4, 3, 2, ...IDENTITY.slice(4)]);
    const result = computeDeviation(voter, consensus);

    const byTeam = new Map(result.perTeam.map((e) => [e.teamAbbr, e]));
    // team04: consenso 4, votante 2 → diff +2 (sobrevalorado)
    expect(byTeam.get("team04")?.diff).toBe(2);
    // team02: consenso 2, votante 4 → diff -2 (infravalorado)
    expect(byTeam.get("team02")?.diff).toBe(-2);
    // Solo dos equipos se desvían (±2 cada uno); el resto coincide.
    expect(result.meanAbsDeviation).toBe(4 / 32);
  });

  it("ignores voter teams absent from the consensus", () => {
    const consensus = computeGlobalRanking([makeRanking([1, 2, 3])]).ranking;
    const voter = [...makeRanking([1, 2, 3]), "team99"];
    const result = computeDeviation(voter, consensus);

    expect(result.perTeam).toHaveLength(3);
    expect(result.perTeam.some((e) => e.teamAbbr === "team99")).toBe(false);
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
    expect(loo.perTeam).toEqual(manual.perTeam);
  });

  it("falls back to self-comparison (deviation 0) when there are no other voters", () => {
    const only = makeRanking(IDENTITY);
    const result = computeDeviationLeaveOneOut(only, []);

    expect(result.meanAbsDeviation).toBe(0);
    expect(result.perTeam).toHaveLength(32);
  });
});

describe("topOverratedUnderrated", () => {
  it("splits teams by sign of diff, most extreme first", () => {
    const consensus = computeGlobalRanking([makeRanking(IDENTITY)]).ranking;
    // El votante intercambia team01 y team05 dentro de la lista de 32.
    const voter = makeRanking([5, 2, 3, 4, 1, ...IDENTITY.slice(5)]);
    const { perTeam } = computeDeviation(voter, consensus);
    const { overrated, underrated } = topOverratedUnderrated(perTeam, 3);

    // team05: consenso 5, votante 1 → diff +4 (más sobrevalorado)
    expect(overrated[0].teamAbbr).toBe("team05");
    // team01: consenso 1, votante 5 → diff -4 (más infravalorado)
    expect(underrated[0].teamAbbr).toBe("team01");
  });
});
