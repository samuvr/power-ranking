import { describe, expect, it } from "vitest";
import {
  BADGE_FADE_MS,
  DURATION_MS,
  HOLD_START_MS,
  INTRO_MS,
  MOVE_MS,
  STAGGER_MS,
  badgeOpacity,
  buildTracks,
  easeInOutCubic,
  paintOrder,
  phaseAt,
  positionAt,
  timelineProgress,
} from "./animation";

const FROM = ["KC", "BUF", "SF", "DAL"];
const TO = ["SF", "KC", "DAL", "BUF"];

describe("easeInOutCubic", () => {
  it("va de 0 a 1 y satura fuera de rango", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(9)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });

  it("es monótona creciente", () => {
    for (let t = 0; t < 1; t += 0.05) {
      expect(easeInOutCubic(t + 0.05)).toBeGreaterThan(easeInOutCubic(t));
    }
  });
});

describe("buildTracks", () => {
  it("mapea puestos de salida, de llegada y delta", () => {
    const tracks = buildTracks(FROM, TO);
    expect(tracks.map((t) => t.teamAbbr)).toEqual(TO);

    const sf = tracks.find((t) => t.teamAbbr === "SF")!;
    expect(sf.fromPosition).toBe(3);
    expect(sf.toPosition).toBe(1);
    expect(sf.delta).toBe(2);

    const buf = tracks.find((t) => t.teamAbbr === "BUF")!;
    expect(buf.fromPosition).toBe(2);
    expect(buf.toPosition).toBe(4);
    expect(buf.delta).toBe(-2);
  });

  it("arranca un equipo nuevo en su propio puesto y sin delta", () => {
    const tracks = buildTracks(["KC"], ["KC", "LV"]);
    const lv = tracks.find((t) => t.teamAbbr === "LV")!;
    expect(lv.fromPosition).toBe(2);
    expect(lv.toPosition).toBe(2);
    expect(lv.delta).toBeNull();
  });

  it("sin ranking previo nadie se mueve", () => {
    const tracks = buildTracks([], TO);
    expect(tracks.every((t) => t.fromPosition === t.toPosition)).toBe(true);
    expect(tracks.every((t) => t.delta === null)).toBe(true);
  });

  it("escalona la salida por puesto de partida, dentro de la ventana prevista", () => {
    const tracks = buildTracks(FROM, TO);
    const byFrom = [...tracks].sort((a, b) => a.fromPosition - b.fromPosition);
    expect(byFrom[0].startMs).toBe(INTRO_MS);
    expect(byFrom[byFrom.length - 1].startMs).toBe(INTRO_MS + STAGGER_MS);
    for (let i = 1; i < byFrom.length; i++) {
      expect(byFrom[i].startMs).toBeGreaterThan(byFrom[i - 1].startMs);
    }
  });

  it("un solo equipo no divide por cero", () => {
    const tracks = buildTracks(["KC"], ["KC"]);
    expect(tracks[0].startMs).toBe(INTRO_MS);
  });
});

describe("positionAt", () => {
  const tracks = buildTracks(FROM, TO);
  const sf = tracks.find((t) => t.teamAbbr === "SF")!;

  it("mantiene el puesto de partida durante la intro", () => {
    expect(positionAt(sf, 0)).toBe(sf.fromPosition);
    expect(positionAt(sf, INTRO_MS - 1)).toBe(sf.fromPosition);
  });

  it("llega justo al puesto final y se queda", () => {
    expect(positionAt(sf, sf.startMs + MOVE_MS)).toBe(sf.toPosition);
    expect(positionAt(sf, DURATION_MS)).toBe(sf.toPosition);
  });

  it("interpola de forma monótona entre los dos puestos", () => {
    let last = positionAt(sf, sf.startMs);
    for (let ms = sf.startMs; ms <= sf.startMs + MOVE_MS; ms += 100) {
      const current = positionAt(sf, ms);
      expect(current).toBeLessThanOrEqual(last + 1e-9);
      expect(current).toBeGreaterThanOrEqual(sf.toPosition - 1e-9);
      expect(current).toBeLessThanOrEqual(sf.fromPosition + 1e-9);
      last = current;
    }
  });

  it("todos han llegado cuando empieza el plano final", () => {
    for (const track of tracks) {
      expect(positionAt(track, HOLD_START_MS)).toBe(track.toPosition);
    }
  });
});

describe("fases", () => {
  it("reparte intro, movimiento y plano final", () => {
    expect(phaseAt(0)).toBe("intro");
    expect(phaseAt(INTRO_MS - 1)).toBe("intro");
    expect(phaseAt(INTRO_MS)).toBe("move");
    expect(phaseAt(HOLD_START_MS - 1)).toBe("move");
    expect(phaseAt(HOLD_START_MS)).toBe("hold");
    expect(phaseAt(DURATION_MS)).toBe("hold");
  });

  it("deja plano final suficiente dentro de los 10 s", () => {
    expect(HOLD_START_MS).toBeLessThan(DURATION_MS);
    expect(DURATION_MS - HOLD_START_MS).toBeGreaterThanOrEqual(BADGE_FADE_MS);
  });
});

describe("badgeOpacity", () => {
  it("aparece al terminar el movimiento", () => {
    expect(badgeOpacity(0)).toBe(0);
    expect(badgeOpacity(HOLD_START_MS)).toBe(0);
    expect(badgeOpacity(HOLD_START_MS + BADGE_FADE_MS / 2)).toBeCloseTo(0.5, 5);
    expect(badgeOpacity(HOLD_START_MS + BADGE_FADE_MS)).toBe(1);
    expect(badgeOpacity(DURATION_MS)).toBe(1);
  });
});

describe("timelineProgress", () => {
  it("va de 0 a 1 a lo largo del vídeo", () => {
    expect(timelineProgress(0)).toBe(0);
    expect(timelineProgress(DURATION_MS / 2)).toBeCloseTo(0.5, 5);
    expect(timelineProgress(DURATION_MS * 2)).toBe(1);
  });
});

describe("paintOrder", () => {
  it("pinta al final los que más se mueven", () => {
    const ordered = paintOrder(buildTracks(FROM, TO));
    const jumps = ordered.map((t) => Math.abs(t.toPosition - t.fromPosition));
    expect(jumps).toEqual([...jumps].sort((a, b) => a - b));
    expect(ordered).toHaveLength(TO.length);
  });
});
