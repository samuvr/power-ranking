import { describe, expect, it } from "vitest";
import { computeMetricRanking, getMetricByTeamAbbr } from "./power-metric";
import { getTeamAbbrs } from "./teams";

describe("computeMetricRanking", () => {
  const ranking = computeMetricRanking();

  it("cubre a todos los equipos definidos", () => {
    for (const abbr of getTeamAbbrs()) {
      expect(ranking.has(abbr)).toBe(true);
    }
  });

  it("asigna el puesto 1 al mayor diferencial y el último al menor", () => {
    expect(ranking.get("BUF")).toEqual({ value: 148, rank: 1 });
    expect(ranking.get("DET")?.rank).toBe(2);
    expect(ranking.get("CLE")?.rank).toBe(32);
  });

  it("usa competition ranking en los empates", () => {
    // NYJ y WAS empatan a -6.
    expect(ranking.get("NYJ")?.rank).toBe(ranking.get("WAS")?.rank);
    // NE va justo después del puesto compartido, saltando el puesto extra.
    const tiedRank = ranking.get("NYJ")!.rank!;
    expect(ranking.get("NE")!.rank!).toBe(tiedRank + 2);
  });

  it("expone el mismo dato vía getMetricByTeamAbbr", () => {
    expect(getMetricByTeamAbbr("BUF")).toEqual({ value: 148, rank: 1 });
  });
});
