import { describe, expect, it } from "vitest";
import { isUpdatedAfter, rankingsUpdatedAfter, snapshotCutoff } from "./ranking-pool";

const row = (id: string, updated_at: string) => ({ id, updated_at });

describe("snapshotCutoff", () => {
  it("devuelve null sin screenshot", () => {
    expect(snapshotCutoff(null)).toBeNull();
    expect(snapshotCutoff(undefined)).toBeNull();
  });

  it("lee la fecha del screenshot, como string o como Date", () => {
    const iso = "2026-09-01T10:00:00.000Z";
    expect(snapshotCutoff({ created_at: iso })).toBe(Date.parse(iso));
    expect(snapshotCutoff({ created_at: new Date(iso) })).toBe(Date.parse(iso));
  });

  it("trata una fecha ilegible como si no hubiera screenshot", () => {
    expect(snapshotCutoff({ created_at: "no es una fecha" })).toBeNull();
  });
});

describe("isUpdatedAfter", () => {
  const cutoff = Date.parse("2026-09-01T10:00:00.000Z");

  it("sin corte, todo cuenta como actualizado", () => {
    expect(isUpdatedAfter("2020-01-01T00:00:00.000Z", null)).toBe(true);
  });

  it("solo después del corte, nunca justo en el corte", () => {
    expect(isUpdatedAfter("2026-09-01T10:00:01.000Z", cutoff)).toBe(true);
    expect(isUpdatedAfter("2026-09-01T10:00:00.000Z", cutoff)).toBe(false);
    expect(isUpdatedAfter("2026-08-31T23:59:59.000Z", cutoff)).toBe(false);
  });

  it("una fecha ilegible no se da por actualizada", () => {
    expect(isUpdatedAfter("cualquier cosa", cutoff)).toBe(false);
  });
});

describe("rankingsUpdatedAfter", () => {
  const rows = [
    row("vieja", "2026-08-20T09:00:00.000Z"),
    row("nueva", "2026-09-05T09:00:00.000Z"),
    row("justa", "2026-09-01T10:00:00.000Z"),
  ];

  it("sin corte devuelve la lista entera", () => {
    expect(rankingsUpdatedAfter(rows, null)).toBe(rows);
  });

  it("deja fuera las guardadas antes del screenshot", () => {
    const cutoff = Date.parse("2026-09-01T10:00:00.000Z");
    expect(rankingsUpdatedAfter(rows, cutoff).map((r) => r.id)).toEqual(["nueva"]);
  });

  it("puede quedarse sin ninguna", () => {
    const cutoff = Date.parse("2027-01-01T00:00:00.000Z");
    expect(rankingsUpdatedAfter(rows, cutoff)).toEqual([]);
  });
});
