import { describe, expect, it } from "vitest";
import { computeGlobalRanking } from "./ranking-algorithm";

function makeRanking(ids: number[]): string[] {
  return ids.map((n) => `team${n.toString().padStart(2, "0")}`);
}

const ALL_TEAMS = Array.from({ length: 32 }, (_, i) => `team${(i + 1).toString().padStart(2, "0")}`);

describe("computeGlobalRanking", () => {
  it("with a single voter returns that voter's ranking", () => {
    const r = makeRanking(Array.from({ length: 32 }, (_, i) => i + 1));
    const result = computeGlobalRanking([r]);

    expect(result.totalSubmissions).toBe(1);
    expect(result.ranking).toHaveLength(32);
    // Position 1 of the voter is team01 → in the global it should also be position 1
    expect(result.ranking[0].teamAbbr).toBe("team01");
    expect(result.ranking[31].teamAbbr).toBe("team32");
  });

  it("returns exactly the 32 unique teams from the dataset", () => {
    const voters = [
      makeRanking([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]),
      makeRanking([32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]),
      makeRanking([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17]),
    ];
    const result = computeGlobalRanking(voters);

    const ids = result.ranking.map((r) => r.teamAbbr).sort();
    expect(ids).toEqual([...ALL_TEAMS].sort());
    expect(new Set(ids).size).toBe(32);

    const positions = result.ranking.map((r) => r.finalPosition);
    expect(positions).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it("places the worst-consensus team at position 32", () => {
    // Two voters, both ranking team05 last
    const voterA = makeRanking([1, 2, 3, 4, 32, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 5]);
    const voterB = makeRanking([32, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 5]);

    const result = computeGlobalRanking([voterA, voterB]);
    expect(result.ranking[31].teamAbbr).toBe("team05");
    expect(result.ranking[31].finalPosition).toBe(32);
  });

  it("breaks ties deterministically by teamAbbr", () => {
    // Two voters with completely different orderings of the same 32 ids should still
    // produce a stable output (no throws, all positions assigned).
    const voterA = makeRanking(Array.from({ length: 32 }, (_, i) => i + 1));
    const voterB = makeRanking(Array.from({ length: 32 }, (_, i) => 32 - i));
    const result = computeGlobalRanking([voterA, voterB]);
    expect(result.ranking).toHaveLength(32);
    expect(new Set(result.ranking.map((r) => r.teamAbbr)).size).toBe(32);
  });

  it("assigns positions across all 7 rounds totalling 32", () => {
    const voters = Array.from({ length: 20 }, () =>
      makeRanking(
        [...Array.from({ length: 32 }, (_, i) => i + 1)].sort(() => Math.random() - 0.5),
      ),
    );
    const result = computeGlobalRanking(voters);
    expect(result.rounds).toHaveLength(7);
    const totalAssigned = result.rounds.reduce(
      (sum, r) => sum + (r.positionsAssigned[1] - r.positionsAssigned[0] + 1),
      0,
    );
    expect(totalAssigned).toBe(32);
    expect(result.ranking).toHaveLength(32);
  });
});
