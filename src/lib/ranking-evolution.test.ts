import { describe, expect, it } from "vitest";
import {
  computeEvolution,
  evolutionByTeam,
  teamPositionHistory,
  topMovers,
} from "./ranking-evolution";

describe("computeEvolution", () => {
  it("marca subidas en positivo y bajadas en negativo", () => {
    const previous = ["KC", "BUF", "SF", "DAL"];
    const current = ["SF", "KC", "DAL", "BUF"];
    const byTeam = evolutionByTeam(computeEvolution(current, previous));

    expect(byTeam.get("SF")).toMatchObject({ position: 1, previousPosition: 3, delta: 2 });
    expect(byTeam.get("KC")).toMatchObject({ position: 2, previousPosition: 1, delta: -1 });
    expect(byTeam.get("DAL")).toMatchObject({ position: 3, previousPosition: 4, delta: 1 });
    expect(byTeam.get("BUF")).toMatchObject({ position: 4, previousPosition: 2, delta: -2 });
  });

  it("devuelve delta 0 cuando el equipo se mantiene", () => {
    const evo = computeEvolution(["KC", "BUF"], ["KC", "BUF"]);
    expect(evo.map((e) => e.delta)).toEqual([0, 0]);
  });

  it("devuelve delta null si no hay foto anterior", () => {
    const evo = computeEvolution(["KC", "BUF"], null);
    expect(evo.every((e) => e.delta === null && e.previousPosition === null)).toBe(true);
  });

  it("devuelve delta null solo para los equipos que no estaban antes", () => {
    const evo = evolutionByTeam(computeEvolution(["KC", "BUF"], ["BUF"]));
    expect(evo.get("KC")?.delta).toBeNull();
    expect(evo.get("BUF")?.delta).toBe(-1);
  });
});

describe("topMovers", () => {
  const evolutions = computeEvolution(
    ["SF", "KC", "DAL", "BUF", "MIA"],
    ["MIA", "BUF", "KC", "SF", "DAL"],
  );

  it("ordena los que más suben y los que más bajan", () => {
    const { risers, fallers } = topMovers(evolutions, 2);
    expect(risers.map((e) => e.teamAbbr)).toEqual(["SF", "DAL"]);
    expect(fallers.map((e) => e.teamAbbr)).toEqual(["MIA", "BUF"]);
  });

  it("ignora los equipos sin dato anterior y los que se mantienen", () => {
    const evo = computeEvolution(["KC", "BUF", "SF"], ["KC", "SF"]);
    const { risers, fallers } = topMovers(evo);
    expect(risers.map((e) => e.teamAbbr)).toEqual([]);
    expect(fallers.map((e) => e.teamAbbr)).toEqual(["SF"]);
  });

  it("desempata por mejor puesto actual", () => {
    const evo = computeEvolution(["KC", "BUF", "SF", "DAL"], ["SF", "DAL", "KC", "BUF"]);
    const { risers } = topMovers(evo, 2);
    expect(risers.map((e) => e.teamAbbr)).toEqual(["KC", "BUF"]);
  });
});

describe("teamPositionHistory", () => {
  const snapshots = [
    { id: "1", name: "Week 1", createdAt: "2026-09-01", consensus: ["KC", "BUF", "SF"] },
    { id: "2", name: "Week 2", createdAt: "2026-09-08", consensus: ["BUF", "SF", "KC"] },
  ];

  it("devuelve el puesto del equipo en cada screenshot", () => {
    expect(teamPositionHistory(snapshots, "KC").map((p) => p.position)).toEqual([1, 3]);
    expect(teamPositionHistory(snapshots, "SF").map((p) => p.position)).toEqual([3, 2]);
  });

  it("omite los screenshots donde el equipo no aparece", () => {
    expect(teamPositionHistory(snapshots, "DAL")).toEqual([]);
  });
});
