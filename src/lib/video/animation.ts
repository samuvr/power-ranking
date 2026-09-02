/**
 * Línea de tiempo del vídeo de 10 s que anima el paso de un ranking a otro.
 *
 * Puro, sin DOM: recibe dos listas ordenadas de `abbr` (posición 1 = mejor) y
 * devuelve, para cada instante, la posición (fraccionaria) en la que hay que
 * pintar cada equipo. `src/lib/video/scene.ts` se encarga de dibujarlo y
 * `RankingVideoExport` de grabarlo.
 *
 * Fases:
 *   0 ──── intro ────┬──── movimiento ────┬──── final ──── 10 s
 *   (ranking previo) │ (cada equipo viaja)│ (ranking nuevo + flechas)
 */

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

/** Duración total del vídeo. */
export const DURATION_MS = 10_000;
/** Se ve el ranking de partida quieto. */
export const INTRO_MS = 1_600;
/** Lo que tarda un equipo concreto en viajar a su nuevo puesto. */
export const MOVE_MS = 4_000;
/** Reparto del arranque entre el primer y el último equipo. */
export const STAGGER_MS = 1_200;
/** Instante en el que todos los equipos han llegado. */
export const HOLD_START_MS = INTRO_MS + STAGGER_MS + MOVE_MS;
/** Entrada de las flechas de evolución, ya en el ranking final. */
export const BADGE_FADE_MS = 600;

export type Phase = "intro" | "move" | "hold";

export type TeamTrack = {
  teamAbbr: string;
  /** Puesto de partida (1-based). Un equipo nuevo arranca en su puesto final. */
  fromPosition: number;
  /** Puesto de llegada (1-based). */
  toPosition: number;
  /** Puestos ganados (positivo = sube). `null` si no estaba en el ranking de partida. */
  delta: number | null;
  /** Milisegundo en el que arranca su viaje. */
  startMs: number;
};

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Arranque y frenada suaves: el movimiento no empieza ni acaba de golpe. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Un carril por equipo del ranking final. Los equipos salen escalonados por
 * su puesto de partida (arriba primero), así el movimiento se lee de un
 * vistazo en lugar de arrancar todo a la vez.
 */
export function buildTracks(from: string[], to: string[]): TeamTrack[] {
  const fromPosByTeam = new Map<string, number>();
  from.forEach((teamAbbr, idx) => fromPosByTeam.set(teamAbbr, idx + 1));

  const tracks = to.map((teamAbbr, idx) => {
    const toPosition = idx + 1;
    const previous = fromPosByTeam.get(teamAbbr) ?? null;
    return {
      teamAbbr,
      fromPosition: previous ?? toPosition,
      toPosition,
      delta: previous === null ? null : previous - toPosition,
      startMs: INTRO_MS,
    } satisfies TeamTrack;
  });

  const order = [...tracks].sort((a, b) => a.fromPosition - b.fromPosition);
  const last = order.length - 1;
  order.forEach((track, idx) => {
    track.startMs = INTRO_MS + (last <= 0 ? 0 : (idx / last) * STAGGER_MS);
  });

  return tracks;
}

/** Puesto fraccionario (1-based) en el que pintar el equipo en ese instante. */
export function positionAt(track: TeamTrack, elapsedMs: number): number {
  const progress = easeInOutCubic((elapsedMs - track.startMs) / MOVE_MS);
  return track.fromPosition + (track.toPosition - track.fromPosition) * progress;
}

export function phaseAt(elapsedMs: number): Phase {
  if (elapsedMs < INTRO_MS) return "intro";
  if (elapsedMs < HOLD_START_MS) return "move";
  return "hold";
}

/** Opacidad de las flechas de evolución: entran al llegar todos a su puesto. */
export function badgeOpacity(elapsedMs: number): number {
  return clamp01((elapsedMs - HOLD_START_MS) / BADGE_FADE_MS);
}

/** Progreso 0→1 de la barra inferior. */
export function timelineProgress(elapsedMs: number): number {
  return clamp01(elapsedMs / DURATION_MS);
}

/**
 * Orden de pintado: los que menos se mueven al fondo y los que más viajan
 * encima, para que al cruzarse se vea siempre el protagonista.
 */
export function paintOrder(tracks: TeamTrack[]): TeamTrack[] {
  return [...tracks].sort(
    (a, b) =>
      Math.abs(a.toPosition - a.fromPosition) - Math.abs(b.toPosition - b.fromPosition),
  );
}
