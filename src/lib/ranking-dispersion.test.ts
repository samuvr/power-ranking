import { describe, expect, it } from "vitest";
import {
  computeDispersion,
  dispersionByTeam,
  mostAgreed,
  mostDivisive,
  positionHistogram,
} from "./ranking-dispersion";

// Rankings cortos: las funciones no exigen los 32 equipos.
const AGREED = ["A", "B", "C", "D"];

describe("computeDispersion", () => {
  it("da dispersión cero cuando todos votan igual", () => {
    const [first] = computeDispersion([AGREED, AGREED, AGREED]);
    expect(first.stdDev).toBe(0);
    expect(first.spread).toBe(0);
  });

  it("resume los puestos que ha recibido cada equipo", () => {
    const stats = dispersionByTeam(
      computeDispersion([
        ["A", "B", "C", "D"],
        ["D", "C", "B", "A"],
        ["A", "C", "B", "D"],
      ]),
    );

    const a = stats.get("A")!;
    expect(a.votes).toBe(3);
    expect(a.best).toBe(1);
    expect(a.worst).toBe(4);
    expect(a.spread).toBe(3);
    expect(a.mean).toBeCloseTo((1 + 4 + 1) / 3);
    expect(a.median).toBe(1);

    // B siempre entre el 2º y el 3º: mucho más tranquilo que A.
    const b = stats.get("B")!;
    expect(b.spread).toBe(1);
    expect(b.stdDev).toBeLessThan(a.stdDev);
  });

  it("calcula la mediana con un número par de votos", () => {
    const [a] = computeDispersion([
      ["A", "B"],
      ["B", "A"],
    ]);
    expect(a.median).toBe(1.5);
  });

  it("ignora los equipos que nadie ha votado", () => {
    const stats = computeDispersion([["A", "B"]]);
    expect(stats.map((s) => s.teamAbbr).sort()).toEqual(["A", "B"]);
  });

  it("no falla sin rankings", () => {
    expect(computeDispersion([])).toEqual([]);
  });

  it("ordena de más a menos discutido", () => {
    // C oscila entre el 1º y el 3º; A y B se mantienen en su sitio.
    const order = computeDispersion([
      ["C", "A", "B"],
      ["A", "B", "C"],
      ["A", "B", "C"],
    ]).map((s) => s.teamAbbr);
    expect(order[0]).toBe("C");
  });

  it("desempata por abbr para que el orden sea estable", () => {
    // Dos equipos con exactamente la misma dispersión.
    const order = computeDispersion([
      ["B", "A"],
      ["A", "B"],
    ]).map((s) => s.teamAbbr);
    expect(order).toEqual(["A", "B"]);
  });
});

describe("mostDivisive / mostAgreed", () => {
  const rankings = [
    ["A", "B", "C", "D"],
    ["D", "B", "C", "A"],
    ["A", "B", "C", "D"],
  ];

  it("saca los extremos de la misma lista", () => {
    const stats = computeDispersion(rankings);
    // B y C nunca se mueven; A y D saltan del primero al último.
    expect(mostDivisive(stats, 2).map((s) => s.teamAbbr).sort()).toEqual(["A", "D"]);
    expect(mostAgreed(stats, 2).map((s) => s.teamAbbr).sort()).toEqual(["B", "C"]);
  });

  it("no devuelve más de los que hay ni peta con count 0", () => {
    const stats = computeDispersion(rankings);
    expect(mostDivisive(stats, 99)).toHaveLength(4);
    expect(mostDivisive(stats, 0)).toEqual([]);
    expect(mostAgreed(stats, -1)).toEqual([]);
  });
});

describe("positionHistogram", () => {
  it("reparte los puestos en tramos de cuatro", () => {
    const teams = Array.from({ length: 32 }, (_, i) => `T${i + 1}`);
    const bins = positionHistogram([teams, teams], "T1");
    expect(bins).toHaveLength(8);
    expect(bins[0]).toEqual({ from: 1, to: 4, count: 2 });
    expect(bins.slice(1).every((b) => b.count === 0)).toBe(true);
  });

  it("coloca cada puesto en su tramo", () => {
    const teams = Array.from({ length: 32 }, (_, i) => `T${i + 1}`);
    const reversed = [...teams].reverse();
    // T1 es 1º en un ranking y 32º en el otro.
    const bins = positionHistogram([teams, reversed], "T1");
    expect(bins[0].count).toBe(1);
    expect(bins[7]).toEqual({ from: 29, to: 32, count: 1 });
  });

  it("ignora los rankings que no incluyen al equipo", () => {
    const bins = positionHistogram([["A", "B"], ["B", "A"]], "Z");
    expect(bins.every((b) => b.count === 0)).toBe(true);
  });
});
