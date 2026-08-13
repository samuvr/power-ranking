"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type SnapshotSummary = {
  id: string;
  name: string;
  createdAt: string;
  entryCount: number;
};

export type Participant = {
  id: string;
  fullName: string;
  email: string;
  updatedAt: string;
  updatedSinceLast: boolean;
};

type Props = {
  accent: string;
  snapshots: SnapshotSummary[];
  participants: Participant[];
  lastSnapshotName: string | null;
};

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ScreenshotsView({
  accent,
  snapshots,
  participants,
  lastSnapshotName,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [includeAll, setIncludeAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updated = participants.filter((p) => p.updatedSinceLast);
  const outdated = participants.filter((p) => !p.updatedSinceLast);
  const included = includeAll ? participants : updated;
  const excluded = includeAll ? [] : outdated;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Ponle un nombre al screenshot");
      return;
    }
    if (included.length === 0) {
      setError("No hay rankings que congelar con ese criterio");
      return;
    }
    if (
      !window.confirm(
        `Se congelarán ${included.length} rankings y el consensus en "${name.trim()}". ¿Seguimos?`,
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/screenshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), includeAll }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (snapshot: SnapshotSummary) => {
    const next = window.prompt("Nuevo nombre del screenshot", snapshot.name);
    if (!next || next.trim() === snapshot.name) return;
    const res = await fetch(`/api/admin/screenshots/${snapshot.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: next.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error ?? "No se ha podido renombrar");
      return;
    }
    router.refresh();
  };

  const handleDelete = async (snapshot: SnapshotSummary) => {
    if (
      !window.confirm(
        `Borrar "${snapshot.name}" elimina sus ${snapshot.entryCount} rankings congelados y cambia las flechas de evolución. ¿Seguro?`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/screenshots/${snapshot.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error ?? "No se ha podido borrar");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="font-subhead text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>
          Crear screenshot
        </h2>
        <p className="mt-1 text-sm text-muted">
          Congela el ranking de cada participante y el consensus del momento. Es la
          base con la que se calculan las flechas de evolución.
        </p>

        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3">
          <label className="block">
            <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
              Nombre
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Week 1, Post-Cortes Training Camp…"
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base outline-none transition focus:border-foreground"
            />
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => setIncludeAll(e.target.checked)}
              className="mt-1"
            />
            <span>
              Incluir también los rankings no actualizados
              {lastSnapshotName ? ` desde "${lastSnapshotName}"` : ""}.
              <span className="block text-[11px] text-muted">
                Sin marcar, solo entra quien haya guardado después del último screenshot.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
            <p>
              <strong className="font-mono">{included.length}</strong> de{" "}
              <strong className="font-mono">{participants.length}</strong> rankings
              entrarán en este screenshot.
            </p>
            {excluded.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-muted">
                  Ver los {excluded.length} que quedan fuera
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-muted">
                  {excluded.map((p) => (
                    <li key={p.id}>
                      {p.fullName} · {p.email}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="font-subhead rounded-xl px-4 py-3 text-sm uppercase tracking-wide text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ background: accent }}
          >
            {busy ? "Creando…" : "Crear screenshot"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-subhead mb-2 text-xs uppercase tracking-[0.2em] text-muted">
          Screenshots ({snapshots.length})
        </h2>
        {snapshots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Todavía no has creado ningún screenshot.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{snapshot.name}</p>
                  <p className="text-xs text-muted">
                    {dateFmt.format(new Date(snapshot.createdAt))} · {snapshot.entryCount}{" "}
                    rankings
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/historico/${snapshot.id}`}
                    className="font-subhead rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground"
                  >
                    Ver
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRename(snapshot)}
                    className="font-subhead rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(snapshot)}
                    className="font-subhead rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide text-accent transition hover:border-accent"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-subhead mb-1 text-xs uppercase tracking-[0.2em] text-muted">
          Participación ({updated.length}/{participants.length} al día)
        </h2>
        <p className="mb-3 text-xs text-muted">
          Quién ha actualizado su ranking
          {lastSnapshotName ? ` desde "${lastSnapshotName}"` : " todavía"}.
        </p>
        {outdated.length > 0 && (
          <p className="mb-3 break-all rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] text-muted">
            {outdated.map((p) => p.email).join(", ")}
          </p>
        )}
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.fullName}</p>
                <p className="truncate text-xs text-muted">{p.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-muted">
                  {dateFmt.format(new Date(p.updatedAt))}
                </span>
                <span
                  className="rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold"
                  style={{
                    borderColor: p.updatedSinceLast ? "#16a34a" : "var(--border)",
                    color: p.updatedSinceLast ? "#16a34a" : "var(--muted)",
                  }}
                >
                  {p.updatedSinceLast ? "AL DÍA" : "PENDIENTE"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
