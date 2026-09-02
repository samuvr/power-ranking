/**
 * Grabación del vídeo en el navegador: canvas → `MediaRecorder` → Blob.
 *
 * No hay codificación en servidor (Vercel no trae ffmpeg): el canvas se pinta
 * en tiempo real durante los 10 s y `MediaRecorder` captura su stream. Sale
 * MP4 donde el navegador lo soporta y WebM en el resto.
 */

import { getTeamAbbrs } from "@/data/teams";
import type { SceneAssets, SceneFonts } from "./scene";
import { DURATION_MS, VIDEO_FPS } from "./animation";

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export type RecordingFormat = {
  mimeType: string;
  extension: "mp4" | "webm";
};

/** Primer formato que sepa grabar el navegador, o `null` si no puede. */
export function pickRecordingFormat(): RecordingFormat | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  if (typeof HTMLCanvasElement === "undefined") return null;
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;

  for (const mimeType of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return { mimeType, extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm" };
    }
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Todo se sirve desde el propio origen para no "manchar" el canvas: un
    // canvas contaminado no se puede capturar.
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Escudo de equipo servido por nuestro proxy (mismo origen). */
export function teamLogoProxyUrl(abbr: string): string {
  return `/api/team-logo/${encodeURIComponent(abbr)}`;
}

/**
 * Carga escudos y logo. Solo se aceptan rutas del propio origen; un logo
 * externo se sustituye por el círculo con iniciales.
 */
export async function loadSceneAssets(logoUrl: string): Promise<SceneAssets> {
  const abbrs = getTeamAbbrs();
  const [logo, ...logos] = await Promise.all([
    logoUrl.startsWith("/") ? loadImage(logoUrl) : Promise.resolve(null),
    ...abbrs.map((abbr) => loadImage(teamLogoProxyUrl(abbr))),
  ]);

  const teamLogos = new Map<string, CanvasImageSource>();
  abbrs.forEach((abbr, idx) => {
    const image = logos[idx];
    if (image) teamLogos.set(abbr, image);
  });

  return { logo, teamLogos };
}

/** Tipografías de la app (next/font) para usarlas en el canvas. */
export function resolveFonts(): SceneFonts {
  const fallbackSans = "system-ui, sans-serif";
  if (typeof window === "undefined") {
    return {
      display: fallbackSans,
      subhead: fallbackSans,
      sans: fallbackSans,
      mono: "monospace",
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value ? `${value}, ${fallback}` : fallback;
  };
  return {
    display: read("--font-display", "Impact, sans-serif"),
    subhead: read("--font-subhead", fallbackSans),
    sans: read("--font-sans", fallbackSans),
    mono: read("--font-mono", "monospace"),
  };
}

/** Espera a que las tipografías estén listas: el canvas no las espera solo. */
export async function ensureFontsReady(fonts: SceneFonts): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`400 62px ${fonts.display}`),
      document.fonts.load(`400 24px ${fonts.subhead}`),
      document.fonts.load(`700 22px ${fonts.sans}`),
      document.fonts.load(`400 26px ${fonts.mono}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* si falla, el canvas usa la tipografía de reserva */
  }
}

export type RecordOptions = {
  format: RecordingFormat;
  /** Pinta el fotograma correspondiente a ese instante del vídeo. */
  drawFrame: (elapsedMs: number) => void;
  onProgress?: (progress: number) => void;
  durationMs?: number;
};

/**
 * Graba el canvas durante `durationMs` en tiempo real. El bucle usa el reloj
 * (no un contador de fotogramas) para que el vídeo dure exactamente 10 s
 * aunque el equipo pinte a menos de 30 fps.
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  { format, drawFrame, onProgress, durationMs = DURATION_MS }: RecordOptions,
): Promise<Blob> {
  const stream = canvas.captureStream(VIDEO_FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: BlobPart[] = [];
  let raf = 0;

  return new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((track) => track.stop());
      reject(new Error("El navegador ha cortado la grabación"));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: format.mimeType }));
    };

    // Primer fotograma antes de arrancar: el stream nunca sale en negro.
    drawFrame(0);
    onProgress?.(0);
    recorder.start();

    const startedAt = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= durationMs) {
        drawFrame(durationMs);
        onProgress?.(1);
        // Un respiro para que el último fotograma entre en el contenedor.
        window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 150);
        return;
      }
      drawFrame(elapsed);
      onProgress?.(elapsed / durationMs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
