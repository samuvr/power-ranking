"use client";

import { useState } from "react";

type Props = {
  imageUrl: string;
  fullName: string;
  votingName: string;
};

export function ShareActions({ imageUrl, fullName, votingName }: Props) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ranking-${votingName.toLowerCase().replace(/\s+/g, "-")}-${fullName.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], "ranking.png", { type: "image/png" });
      const text = `Mi top 32 de equipos NFL 2026 · ${votingName}`;
      if (typeof navigator !== "undefined" && "share" in navigator) {
        const data: ShareData = { text, files: [file] };
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (!nav.canShare || nav.canShare(data)) {
          await navigator.share(data);
          return;
        }
      }
      await handleDownload();
    } catch {
      // user cancelled or browser blocked
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        className="font-subhead w-full rounded-xl bg-accent px-4 py-3 text-base uppercase tracking-wide text-white transition active:scale-[0.98] hover:bg-accent-dark disabled:opacity-50"
      >
        Compartir ranking
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="font-subhead w-full rounded-xl border border-border bg-surface px-4 py-3 text-base uppercase tracking-wide transition active:scale-[0.98] hover:border-foreground disabled:opacity-50"
      >
        Descargar PNG
      </button>
    </div>
  );
}
