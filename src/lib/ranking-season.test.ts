import { describe, expect, it } from "vitest";
import {
  seasonBiggestChanges,
  seasonChanges,
  seasonTopSlices,
  type SeasonPoint,
} from "./ranking-season";

const point = (id: string | null, label: string, positions: string[]): SeasonPoint => ({
  id,
  label,
  positions,
});

describe("seasonTopSlices", () => {
  it("no marca entradas ni salidas en el primer punto", () => {
    const [first] = seasonTopSlices([point("s1", "Semana 1", ["A", "B", "C", "D"])], 2);
    expect(first.top).toEqual(["A", "B"]);
    expect(first.entered).toEqual([]);
    expect(first.left).toEqual([]);
  });

  it("marca quién entra y quién sale del top", () => {
    const slices = seasonTopSlices(
      [
        point("s1", "Semana 1", ["A", "B", "C", "D"]),
        point("s2", "Semana 2", ["A", "C", "B", "D"]),
      ],
      2,
    );
    expect(slices[1].top).toEqual(["A", "C"]);
    expect(slices[1].entered).toEqual(["C"]);
    expect(slices[1].left).toEqual(["B"]);
  });

  it("no marca nada cuando solo cambia el orden dentro del top", () => {
    const slices = seasonTopSlices(
      [
        point("s1", "Semana 1", ["A", "B", "C"]),
        point("s2", "Semana 2", ["B", "A", "C"]),
      ],
      2,
    );
    expect(slices[1].entered).toEqual([]);
    expect(slices[1].left).toEqual([]);
  });

  it("conserva la etiqueta y el id de cada punto", () => {
    const slices = seasonTopSlices([point(null, "Ahora", ["A", "B"])], 1);
    expect(slices[0].id).toBeNull();
    expect(slices[0].label).toBe("Ahora");
  });

  it("aguanta un top más grande que el ranking", () => {
    const [only] = seasonTopSlices([point("s1", "Semana 1", ["A"])], 5);
    expect(only.top).toEqual(["A"]);
  });

  it("no falla sin puntos", () => {
    expect(seasonTopSlices([], 5)).toEqual([]);
  });
});

describe("seasonChanges", () => {
  it("compara el primer punto con el último, ignorando los de en medio", () => {
    const changes = seasonChanges([
      point("s1", "Semana 1", ["A", "B", "C", "D"]),
      point("s2", "Semana 2", ["D", "C", "B", "A"]),
      point(null, "Ahora", ["B", "A", "C", "D"]),
    ]);

    const byTeam = new Map(changes.map((c) => [c.teamAbbr, c]));
    expect(byTeam.get("B")).toEqual({
      teamAbbr: "B",
      firstPosition: 2,
      lastPosition: 1,
      delta: 1,
    });
    expect(byTeam.get("D")?.delta).toBe(0);
  });

  it("ordena de mayor subida a mayor bajada", () => {
    const changes = seasonChanges([
      point("s1", "Semana 1", ["A", "B", "C", "D"]),
      point(null, "Ahora", ["D", "A", "B", "C"]),
    ]);
    expect(changes.map((c) => c.teamAbbr)).toEqual(["D", "A", "B", "C"]);
  });

  it("hace falta más de un punto", () => {
    expect(seasonChanges([point("s1", "Semana 1", ["A", "B"])])).toEqual([]);
    expect(seasonChanges([])).toEqual([]);
  });

  it("omite equipos que no están en los dos extremos", () => {
    const changes = seasonChanges([
      point("s1", "Semana 1", ["A", "B"]),
      point(null, "Ahora", ["A", "Z"]),
    ]);
    expect(changes.map((c) => c.teamAbbr)).toEqual(["A"]);
  });
});

describe("seasonBiggestChanges", () => {
  const changes = seasonChanges([
    point("s1", "Semana 1", ["A", "B", "C", "D", "E"]),
    point(null, "Ahora", ["E", "D", "C", "B", "A"]),
  ]);

  it("separa subidas y bajadas, las mayores primero", () => {
    const { risers, fallers } = seasonBiggestChanges(changes, 2);
    expect(risers.map((c) => c.teamAbbr)).toEqual(["E", "D"]);
    expect(fallers.map((c) => c.teamAbbr)).toEqual(["A", "B"]);
  });

  it("deja fuera a los que no se han movido", () => {
    const { risers, fallers } = seasonBiggestChanges(changes, 5);
    expect(risers.some((c) => c.teamAbbr === "C")).toBe(false);
    expect(fallers.some((c) => c.teamAbbr === "C")).toBe(false);
  });

  it("count 0 devuelve listas vacías", () => {
    expect(seasonBiggestChanges(changes, 0)).toEqual({ risers: [], fallers: [] });
  });
});
