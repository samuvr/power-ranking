"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VotingPublic } from "@/lib/db/client";

type Props = {
  initialVotings: VotingPublic[];
  counts: Record<string, number>;
};

export function VotingsManager({ initialVotings, counts }: Props) {
  const router = useRouter();
  const [votings, setVotings] = useState(initialVotings);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // id de la votación origen cuyo panel de duplicación está abierto
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("");

  const openDuplicate = (sourceId: string) => {
    setError(null);
    setNotice(null);
    setTarget("");
    setDuplicatingId((cur) => (cur === sourceId ? null : sourceId));
  };

  const duplicate = (sourceId: string) => {
    if (!target) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/votings/${sourceId}/duplicate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetVotingId: target }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data: { copied: number; skipped: number; total: number } =
          await res.json();
        setNotice(
          `Copiados ${data.copied}, saltados ${data.skipped} de ${data.total} rankings.`,
        );
        setDuplicatingId(null);
        setTarget("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error duplicando");
      }
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= votings.length) return;
    const next = [...votings];
    [next[idx], next[j]] = [next[j], next[idx]];
    setVotings(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/votings/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderedIds: next.map((v) => v.id) }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error reordenando");
        setVotings(initialVotings);
      }
    });
  };

  const toggleActive = (v: VotingPublic) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/votings/${v.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: !v.active }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  };

  if (votings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
        No hay votaciones. Crea la primera con el botón de arriba.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </p>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {votings.map((v, idx) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap"
          >
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0 || busy}
                aria-label="Subir"
                className="rounded px-2 text-sm text-muted disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === votings.length - 1 || busy}
                aria-label="Bajar"
                className="rounded px-2 text-sm text-muted disabled:opacity-30"
              >
                ▼
              </button>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: v.accent }}
            >
              {v.short_name}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{v.name}</p>
                {!v.active && (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    inactiva
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted">
                /vote/{v.slug} · {counts[v.id] ?? 0} envíos
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/admin/${v.slug}`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-muted"
              >
                Ver ranking
              </Link>
              <Link
                href={`/admin/votings/${v.id}/edit`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-muted"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={() => toggleActive(v)}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-muted disabled:opacity-50"
              >
                {v.active ? "Desactivar" : "Activar"}
              </button>
              <button
                type="button"
                onClick={() => openDuplicate(v.id)}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-muted disabled:opacity-50"
              >
                Duplicar rankings
              </button>
            </div>
            {duplicatingId === v.id && (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
                <span className="text-xs text-muted">Copiar a:</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  disabled={busy}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
                >
                  <option value="">Elige una votación…</option>
                  {votings
                    .filter((o) => o.id !== v.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => duplicate(v.id)}
                  disabled={busy || !target}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-muted disabled:opacity-50"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicatingId(null)}
                  disabled={busy}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
                <span className="text-[11px] text-muted">
                  Los emails que ya votaron en el destino se conservan.
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
