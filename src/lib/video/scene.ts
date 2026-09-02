/**
 * Dibujo de un fotograma del vídeo (1080×1920) sobre un canvas 2D.
 *
 * Misma paleta que las imágenes generadas con Satori (`src/lib/og/theme.ts`):
 * cabecera, columna fija de puestos 01→32 y una tarjeta por equipo que viaja
 * de su puesto anterior al nuevo. `animation.ts` decide dónde va cada una.
 */

import { findTeamByAbbr } from "@/data/teams";
import { BG, BORDER, FG, GREEN, MUTED, RED, SURFACE } from "@/lib/og/theme";
import {
  DURATION_MS,
  INTRO_MS,
  MOVE_MS,
  STAGGER_MS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  badgeOpacity,
  clamp01,
  easeInOutCubic,
  paintOrder,
  positionAt,
  timelineProgress,
  type TeamTrack,
} from "./animation";

const PAD = 48;
const HEADER_RULE_Y = 236;
const LIST_TOP = 266;
const ROW_PITCH = 47.5;
const ROW_HEIGHT = 42;
const SLOT_COL_RIGHT = 112;
const CARD_X = 128;
const CARD_WIDTH = VIDEO_WIDTH - PAD - CARD_X;
const LOGO_SIZE = 32;
/** Ancho reservado a la derecha para la flecha de evolución. */
const BADGE_COLUMN = 72;
/** Ancho reservado para la abreviatura del equipo. */
const ABBR_COLUMN = 56;
const FOOTER_Y = 1848;
const PROGRESS_Y = 1806;
const FADE_IN_MS = 400;
/** Relleno del hueco vacío de un puesto mientras su tarjeta viaja. */
const SLOT_FILL = "rgba(10, 34, 64, 0.05)";

export type SceneAssets = {
  /** Logo de la votación; `null` cae en un círculo con las iniciales. */
  logo: CanvasImageSource | null;
  /** Escudo por `abbr`; los que falten caen en un círculo con la abreviatura. */
  teamLogos: Map<string, CanvasImageSource>;
};

export type SceneCopy = {
  eyebrow: string;
  title: string;
  /** Etiqueta del ranking de partida ("Tu ranking del 12 ago", "Week 1"). */
  fromLabel: string;
  /** Etiqueta del ranking de llegada ("Ahora", "Week 2"). */
  toLabel: string;
  footerLeft: string;
  footerRight: string;
  /** Iniciales para el hueco del logo cuando no se ha podido cargar. */
  logoFallback: string;
};

export type SceneFonts = {
  display: string;
  subhead: string;
  sans: string;
  mono: string;
};

export type SceneOptions = {
  tracks: TeamTrack[];
  assets: SceneAssets;
  copy: SceneCopy;
  fonts: SceneFonts;
  /** Color de marca de la votación (sustituye al rojo por defecto). */
  accent: string;
  elapsedMs: number;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Recorta con "…" para que nunca se salga de la tarjeta. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawCircleBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  background: string,
  color: string,
  label: string,
  font: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 1);
  ctx.restore();
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
): void {
  ctx.drawImage(image, x, y, size, size);
}

function drawHeader(ctx: CanvasRenderingContext2D, opts: SceneOptions): void {
  const { assets, copy, fonts, accent, elapsedMs } = opts;

  const logoSize = 108;
  if (assets.logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(PAD + logoSize / 2, 48 + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    drawImageContain(ctx, assets.logo, PAD, 48, logoSize);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(PAD + logoSize / 2, 48 + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = FG;
    ctx.stroke();
    ctx.restore();
  } else {
    drawCircleBadge(
      ctx,
      PAD + logoSize / 2,
      48 + logoSize / 2,
      logoSize,
      accent,
      "#fff",
      copy.logoFallback,
      `700 34px ${fonts.subhead}`,
    );
  }

  const textX = PAD + logoSize + 24;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = accent;
  ctx.font = `400 24px ${fonts.subhead}`;
  ctx.fillText(fitText(ctx, copy.eyebrow.toUpperCase(), VIDEO_WIDTH - PAD - textX), textX, 82);

  const titleMax = VIDEO_WIDTH - PAD - textX;
  const title = copy.title.toUpperCase();
  let titleSize = 62;
  ctx.font = `400 ${titleSize}px ${fonts.display}`;
  while (titleSize > 34 && ctx.measureText(title).width > titleMax) {
    titleSize -= 2;
    ctx.font = `400 ${titleSize}px ${fonts.display}`;
  }
  ctx.fillStyle = FG;
  ctx.fillText(fitText(ctx, title, titleMax), textX, 148);

  // Las dos etiquetas conviven; el foco pasa de la de partida a la de llegada
  // conforme los equipos van llegando a su nuevo puesto.
  const handover = clamp01((elapsedMs - INTRO_MS - STAGGER_MS / 2) / MOVE_MS);
  drawChip(ctx, PAD, 176, `Desde · ${copy.fromLabel}`, fonts, FG, 1 - handover * 0.65);
  const fromWidth = chipWidth(ctx, `Desde · ${copy.fromLabel}`, fonts);
  drawChip(
    ctx,
    PAD + fromWidth + 12,
    176,
    `Ahora · ${copy.toLabel}`,
    fonts,
    accent,
    0.35 + handover * 0.65,
  );

  ctx.fillStyle = accent;
  ctx.fillRect(PAD, HEADER_RULE_Y, VIDEO_WIDTH - PAD * 2, 6);
}

function chipWidth(ctx: CanvasRenderingContext2D, label: string, fonts: SceneFonts): number {
  ctx.font = `400 20px ${fonts.subhead}`;
  return ctx.measureText(label.toUpperCase()).width + 32;
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  fonts: SceneFonts,
  color: string,
  alpha: number,
): void {
  const text = label.toUpperCase();
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.font = `400 20px ${fonts.subhead}`;
  const width = ctx.measureText(text).width + 32;
  roundRect(ctx, x, y, width, 40, 12);
  ctx.fillStyle = SURFACE;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 16, y + 21);
  ctx.restore();
}

/**
 * Columna fija de puestos 01→32 con el hueco de cada uno. El hueco se ve
 * mientras la tarjeta está de viaje, así la lista nunca parece rota.
 */
function drawSlots(ctx: CanvasRenderingContext2D, count: number, fonts: SceneFonts): void {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const y = LIST_TOP + i * ROW_PITCH;
    roundRect(ctx, CARD_X, y, CARD_WIDTH, ROW_HEIGHT, 12);
    ctx.fillStyle = SLOT_FILL;
    ctx.fill();
  }
  ctx.font = `400 26px ${fonts.mono}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i < 3 ? FG : MUTED;
    ctx.fillText(
      (i + 1).toString().padStart(2, "0"),
      SLOT_COL_RIGHT,
      LIST_TOP + i * ROW_PITCH + ROW_HEIGHT / 2,
    );
  }
  ctx.restore();
}

function drawTeamCard(
  ctx: CanvasRenderingContext2D,
  track: TeamTrack,
  opts: SceneOptions,
): void {
  const { assets, fonts, elapsedMs } = opts;
  const team = findTeamByAbbr(track.teamAbbr);
  const name = team ? `${team.location} ${team.name}` : track.teamAbbr;
  const primary = team?.primaryColor ?? FG;

  const y = LIST_TOP + (positionAt(track, elapsedMs) - 1) * ROW_PITCH;
  const moveProgress = clamp01((elapsedMs - track.startMs) / MOVE_MS);
  // Brillo mientras viaja: máximo a mitad de camino, 0 al llegar.
  const travelling =
    track.fromPosition === track.toPosition
      ? 0
      : Math.sin(Math.PI * easeInOutCubic(moveProgress));
  const moveColor = (track.delta ?? 0) > 0 ? GREEN : RED;

  ctx.save();
  if (travelling > 0.02) {
    ctx.shadowColor = `rgba(10, 34, 64, ${0.28 * travelling})`;
    ctx.shadowBlur = 18 * travelling;
    ctx.shadowOffsetY = 4 * travelling;
  }
  roundRect(ctx, CARD_X, y, CARD_WIDTH, ROW_HEIGHT, 12);
  ctx.fillStyle = SURFACE;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.lineWidth = travelling > 0.02 ? 2 : 1;
  ctx.strokeStyle = travelling > 0.02 ? moveColor : BORDER;
  ctx.globalAlpha = travelling > 0.02 ? 0.35 + 0.65 * travelling : 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Franja del color del equipo pegada al borde izquierdo de la tarjeta.
  ctx.save();
  roundRect(ctx, CARD_X, y, CARD_WIDTH, ROW_HEIGHT, 12);
  ctx.clip();
  ctx.fillStyle = primary;
  ctx.fillRect(CARD_X, y, 8, ROW_HEIGHT);
  ctx.restore();

  const logo = assets.teamLogos.get(track.teamAbbr);
  const logoX = CARD_X + 24;
  const logoY = y + (ROW_HEIGHT - LOGO_SIZE) / 2;
  if (logo) {
    drawImageContain(ctx, logo, logoX, logoY, LOGO_SIZE);
  } else {
    drawCircleBadge(
      ctx,
      logoX + LOGO_SIZE / 2,
      logoY + LOGO_SIZE / 2,
      LOGO_SIZE,
      primary,
      team?.secondaryColor ?? "#fff",
      track.teamAbbr,
      `700 11px ${fonts.sans}`,
    );
  }

  // Columnas fijas: la abreviatura y la flecha no se mueven cuando esta
  // última aparece al final del vídeo.
  const nameX = logoX + LOGO_SIZE + 16;
  const badgeRight = CARD_X + CARD_WIDTH - 20;
  const abbrRight = badgeRight - BADGE_COLUMN;
  const nameMax = abbrRight - ABBR_COLUMN - nameX;
  const middleY = y + ROW_HEIGHT / 2;

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = FG;
  ctx.font = `700 22px ${fonts.sans}`;
  ctx.fillText(fitText(ctx, name, nameMax), nameX, middleY);

  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = `400 16px ${fonts.mono}`;
  ctx.fillText(track.teamAbbr, abbrRight, middleY + 1);

  const badge = deltaLabel(track.delta);
  const badgeAlpha = badgeOpacity(elapsedMs);
  if (badge && badgeAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = badgeAlpha;
    ctx.font = `400 20px ${fonts.mono}`;
    ctx.fillStyle = badge.color;
    ctx.fillText(badge.text, badgeRight, middleY + 1);
    ctx.restore();
  }

  ctx.restore();
}

function deltaLabel(delta: number | null): { text: string; color: string } | null {
  if (delta === null) return null;
  if (delta === 0) return { text: "=", color: MUTED };
  return delta > 0
    ? { text: `▲${delta}`, color: GREEN }
    : { text: `▼${Math.abs(delta)}`, color: RED };
}

function drawFooter(ctx: CanvasRenderingContext2D, opts: SceneOptions): void {
  const { copy, fonts, accent, elapsedMs } = opts;

  const barWidth = VIDEO_WIDTH - PAD * 2;
  ctx.fillStyle = BORDER;
  ctx.fillRect(PAD, PROGRESS_Y, barWidth, 5);
  ctx.fillStyle = accent;
  ctx.fillRect(PAD, PROGRESS_Y, barWidth * timelineProgress(elapsedMs), 5);

  ctx.font = `400 22px ${fonts.subhead}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.fillText(copy.footerLeft.toUpperCase(), PAD, FOOTER_Y);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText(copy.footerRight.toUpperCase(), VIDEO_WIDTH - PAD, FOOTER_Y);
}

/** Pinta el fotograma correspondiente a `elapsedMs` (0 → DURATION_MS). */
export function drawFrame(ctx: CanvasRenderingContext2D, opts: SceneOptions): void {
  const elapsedMs = Math.min(Math.max(opts.elapsedMs, 0), DURATION_MS);
  const frame: SceneOptions = { ...opts, elapsedMs };

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

  drawHeader(ctx, frame);
  drawSlots(ctx, frame.tracks.length, frame.fonts);
  for (const track of paintOrder(frame.tracks)) {
    drawTeamCard(ctx, track, frame);
  }
  drawFooter(ctx, frame);

  // Fundido de entrada: un velo del color de fondo que se retira, para no
  // tener que multiplicar la opacidad en cada pieza.
  const veil = 1 - clamp01(elapsedMs / FADE_IN_MS);
  if (veil > 0) {
    ctx.globalAlpha = veil;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  }
  ctx.restore();
}
