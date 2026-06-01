import { describe, expect, it } from "vitest";
import { computeAnyaRanking, getAnyaByQbId } from "./anya";
import { getQbIds } from "./qbs";

describe("computeAnyaRanking", () => {
  const ranking = computeAnyaRanking();

  it("cubre a todos los QBs definidos", () => {
    for (const id of getQbIds()) {
      expect(ranking.has(id)).toBe(true);
    }
  });

  it("asigna el puesto 1 al mayor ANY/A y el último al menor", () => {
    expect(ranking.get("lamar-jackson")).toEqual({ value: 7.93, rank: 1 });
    expect(ranking.get("brock-purdy")?.rank).toBe(2);
    // 30 QBs con valor; McCarthy/Murray es el menor (4.3).
    expect(ranking.get("mccarthy-murray")?.rank).toBe(30);
    // Mendoza/Cousins no tiene dato (null) y no recibe puesto.
    expect(ranking.get("mendoza-cousins")?.rank).toBeNull();
  });

  it("usa competition ranking en los empates", () => {
    // Hurts y Mayfield empatan a 6.53.
    expect(ranking.get("jalen-hurts")?.rank).toBe(
      ranking.get("baker-mayfield")?.rank,
    );
    // Stroud y Herbert empatan a 6.43 y van justo después del puesto compartido.
    expect(ranking.get("c-j-stroud")?.rank).toBe(
      ranking.get("justin-herbert")?.rank,
    );
    // Hurts/Mayfield comparten puesto; Burrow (6.47) va entre medias antes del
    // siguiente empate (Stroud/Herbert), por lo que saltan 3 puestos.
    const tiedRank = ranking.get("jalen-hurts")!.rank!;
    expect(ranking.get("c-j-stroud")!.rank!).toBe(tiedRank + 3);
  });

  it("marca como N/D a los QBs sin datos", () => {
    expect(getAnyaByQbId("malik-willis")).toEqual({ value: null, rank: null });
  });
});
