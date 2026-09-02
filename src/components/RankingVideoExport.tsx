"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DURATION_MS, VIDEO_HEIGHT, VIDEO_WIDTH, buildTracks } from "@/lib/video/animation";
import { drawFrame, type SceneAssets, type SceneCopy } from "@/lib/video/scene";
import {
  ensureFontsReady,
  loadSceneAssets,
  pickRecordingFormat,
  recordCanvas,
  resolveFonts,
  type RecordingFormat,
} from "@/lib/video/recorder";

type Props = {
  /** Ranking de partida (último guardado o screenshot anterior). */
  fromPositions: string[];
  /** Ranking de llegada (el que se acaba de guardar o congelar). */
  toPositions: string[];
  copy: SceneCopy;
  accent: string;
  logoUrl: string;
  /** Nombre del fichero, sin extensión. */
  fileBase: string;
  /** Texto que acompaña al vídeo al compartirlo. */
  shareText: string;
};

type Status = "idle" | "preparing" | "recording" | "ready" | "error";

const SECONDS = Math.round(DURATION_MS / 1000);

/**
 * Botón que genera un vídeo vertical de 10 s con los equipos viajando desde
 * sus puestos anteriores a los nuevos. Se graba en el propio navegador
 * (canvas + MediaRecorder), así que hay que dejar la pestaña visible mientras
 * dura.
 */
export function RankingVideoExport({
  fromPositions,
  toPositions,
  copy,
  accent,
  logoUrl,
  fileBase,
  shareText,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetsRef = useRef<SceneAssets | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  const [format, setFormat] = useState<RecordingFormat | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const releaseUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => releaseUrl, [releaseUrl]);

  const handleRecord = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // El soporte se mira al pulsar: así el servidor y el cliente pintan lo
    // mismo y no hace falta adivinar el navegador antes de tiempo.
    const picked = format ?? pickRecordingFormat();
    if (!picked) {
      setError(
        "Tu navegador no puede grabar vídeo desde la web. Prueba con Chrome, Edge, Firefox o Safari actualizado.",
      );
      setStatus("error");
      return;
    }
    setFormat(picked);

    setError(null);
    setProgress(0);
    releaseUrl();
    setVideoUrl(null);
    setStatus("preparing");

    try {
      const fonts = resolveFonts();
      await ensureFontsReady(fonts);
      if (!assetsRef.current) {
        assetsRef.current = await loadSceneAssets(logoUrl);
      }
      const assets = assetsRef.current;
      const tracks = buildTracks(fromPositions, toPositions);

      setStatus("recording");
      const blob = await recordCanvas(canvas, {
        format: picked,
        onProgress: setProgress,
        drawFrame: (elapsedMs) =>
          drawFrame(ctx, { tracks, assets, copy, fonts, accent, elapsedMs }),
      });

      blobRef.current = blob;
      urlRef.current = URL.createObjectURL(blob);
      setVideoUrl(urlRef.current);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to record ranking video", err);
      setError(err instanceof Error ? err.message : "No se ha podido grabar el vídeo");
      setStatus("error");
    }
  };

  const fileName = `${fileBase}.${format?.extension ?? "webm"}`;

  const handleDownload = () => {
    if (!urlRef.current) return;
    const link = document.createElement("a");
    link.href = urlRef.current;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleShare = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    try {
      const file = new File([blob], fileName, { type: blob.type.split(";")[0] });
      const data: ShareData = { text: shareText, files: [file] };
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if ("share" in navigator && (!nav.canShare || nav.canShare(data))) {
        await navigator.share(data);
        return;
      }
      handleDownload();
    } catch {
      // compartir cancelado o bloqueado por el navegador
    }
  };

  const busy = status === "preparing" || status === "recording";

  return (
    <section className="mt-5 w-full rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-subhead text-[11px] uppercase tracking-[0.2em]" style={{ color: accent }}>
        Vídeo de la evolución
      </h2>
      <p className="mt-1 text-sm text-muted">
        {SECONDS} segundos en vertical: cada equipo sale de su puesto en «{copy.fromLabel}» y
        viaja hasta el que ocupa en «{copy.toLabel}».
      </p>

      {/*
        El canvas se ve mientras graba (es la vista previa) y el resto del
        tiempo queda fuera de la vista, pero nunca en `display:none`: un canvas
        sin renderizar puede dejar de emitir fotogramas al stream.
      */}
      <canvas
        ref={canvasRef}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        className={
          status === "recording"
            ? "mt-3 w-full rounded-xl border border-border"
            : "sr-only"
        }
      />

      {videoUrl && status === "ready" && (
        <video
          src={videoUrl}
          className="mt-3 w-full rounded-xl border border-border"
          controls
          loop
          playsInline
        />
      )}

      {busy && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-100"
              style={{ width: `${Math.round(progress * 100)}%`, background: accent }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {status === "preparing"
              ? "Preparando escudos y tipografías…"
              : `Grabando… ${Math.round(progress * 100)}%. No cierres ni cambies de pestaña.`}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleRecord}
          disabled={busy}
          className="font-subhead w-full rounded-xl px-4 py-3 text-base uppercase tracking-wide text-white transition active:scale-[0.98] disabled:opacity-50"
          style={{ background: accent }}
        >
          {status === "ready" || status === "error"
            ? "Volver a generar"
            : busy
              ? "Generando…"
              : `Generar vídeo (${SECONDS} s)`}
        </button>

        {status === "ready" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="font-subhead flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm uppercase tracking-wide transition active:scale-[0.98] hover:border-foreground"
            >
              Compartir
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="font-subhead flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm uppercase tracking-wide transition active:scale-[0.98] hover:border-foreground"
            >
              Descargar {format?.extension.toUpperCase() ?? "vídeo"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
