"use client";

import { useState } from "react";

// Lanza las migraciones desde la propia app desplegada. Las credenciales de la
// base de datos son "sensitive" en Vercel y no se pueden bajar en local, así
// que `npm run db:migrate` no siempre es una opción.
export function RunMigrationsPanel() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setLog(null);
    try {
      const res = await fetch("/api/admin/migrate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      setLog(Array.isArray(data.log) ? data.log : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Esquema de la base de datos
      </h2>
      <p className="mt-2 text-sm text-muted">
        Aplica las migraciones pendientes con las variables del despliegue. Es idempotente:
        puedes ejecutarlo las veces que quieras y solo crea lo que falte.
      </p>

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:border-muted disabled:opacity-50"
      >
        {busy ? "Migrando…" : "Ejecutar migraciones"}
      </button>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {log && !error && (
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">
          {log.join("\n")}
        </pre>
      )}
    </section>
  );
}
