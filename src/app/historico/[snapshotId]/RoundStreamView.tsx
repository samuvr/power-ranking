"use client";

import { useState } from "react";
import { IMAGE_REVISION } from "@/lib/og/image-version";

export type RoundSummary = {
  /** Puestos que cierra la fase, [peor, mejor]. */
  positionsAssigned: [number, number];
};

type Props = {
  snapshotId: string;
  rounds: RoundSummary[];
  /** Nombre de los ficheros descargados, sin fase ni extensión. */
  fileBase: string;
  /** Aviso cuando el recálculo no reproduce el consensus congelado. */
  mismatch?: boolean;
};

/**
 * Carrusel de las fases del algoritmo para un screenshot: las mismas imágenes
 * cuadradas que exporta el admin del ranking en vivo, aquí sobre el consensus
 * congelado. Se generan bajo demanda en /api/snapshots/[id]/rounds/[n]/image.
 */
export function RoundStreamView({ snapshotId, rounds, fileBase, mismatch }: Props) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const total = rounds.length;
  const current = rounds[round];
  const [low, high] = current.positionsAssigned;
  // La revisión va en la URL: sin ella, quien ya abrió una fase seguiría
  // viendo la imagen cacheada de un dibujo anterior.
  const urlFor = (i: number) =>
    `/api/snapshots/${snapshotId}/rounds/${i}/image?v=${IMAGE_REVISION}`;
  const imageUrl = urlFor(round);

  function goTo(next: number) {
    if (next === round) return;
    setLoaded(false);
    setRound(next);
  }

  async function downloadAll() {
    setDownloading(true);
    setProgress(0);
    setError(null);
    try {
      for (let i = 0; i < total; i++) {
        const res = await fetch(urlFor(i));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${fileBase}-fase-${i + 1}-de-${total}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        setProgress(i + 1);
        if (i < total - 1) await new Promise((r) => setTimeout(r, 400));
      }
    } catch {
      setError("No se han podido descargar las imágenes. Inténtalo otra vez.");
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  }

  // Al abrirse ocupa toda la fila: dentro de un flex-wrap salta de línea y
  // deja arriba el botón de la imagen del consensus.
  return (
    <div className={open ? "w-full" : undefined}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
      >
        {open ? "Ocultar stream por fases" : "Ver stream por fases"}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-surface p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goTo(Math.max(0, round - 1))}
              disabled={round === 0}
              aria-label="Fase anterior"
              className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm font-semibold transition hover:border-foreground disabled:opacity-30"
            >
              ←
            </button>
            <div className="text-center">
              <p className="font-subhead text-[11px] uppercase tracking-[0.2em] text-muted">
                Fase {round + 1} de {total}
              </p>
              <p className="font-mono text-lg font-bold">
                Puestos {low}–{high}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo(Math.min(total - 1, round + 1))}
              disabled={round === total - 1}
              aria-label="Fase siguiente"
              className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm font-semibold transition hover:border-foreground disabled:opacity-30"
            >
              →
            </button>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
            {!loaded && (
              <p className="font-subhead absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-wide text-muted">
                Generando imagen…
              </p>
            )}
            {/* Imagen generada en el servidor (PNG 1080×1080), no optimizable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={imageUrl}
              src={imageUrl}
              alt={`Fase ${round + 1} de ${total}: puestos ${low}–${high}`}
              width={1080}
              height={1080}
              onLoad={() => setLoaded(true)}
              className={`block h-auto w-full transition-opacity ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {rounds.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir a la fase ${i + 1}`}
                aria-current={i === round}
                className={`h-1.5 w-6 rounded-full transition ${
                  i === round ? "bg-foreground" : "bg-border"
                }`}
              />
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-subhead rounded-xl border border-border bg-surface-2 px-3 py-2 text-[11px] uppercase tracking-wide transition hover:border-foreground"
              >
                Abrir esta fase
              </a>
              <button
                type="button"
                onClick={downloadAll}
                disabled={downloading}
                className="font-subhead rounded-xl border border-border bg-surface-2 px-3 py-2 text-[11px] uppercase tracking-wide transition hover:border-foreground disabled:opacity-50"
              >
                {downloading ? `${progress}/${total} imágenes…` : "Descargar todas"}
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          {mismatch && (
            <p className="mt-2 text-xs text-muted">
              Las fases se recalculan con los rankings congelados y el orden resultante
              no coincide con el consensus guardado, así que la imagen puede diferir de
              la lista de abajo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
