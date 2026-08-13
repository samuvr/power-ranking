"use client";

import { useState } from "react";

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  rankingUpdatedAt: string | null;
  snapshotCount: number;
};

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// Contraseña temporal legible, para dictarla por WhatsApp sin errores.
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function UsersView({ users }: { users: AdminUser[] }) {
  const [reset, setReset] = useState<{ id: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleReset = async (user: AdminUser) => {
    const password = generatePassword();
    if (
      !window.confirm(
        `Se cambiará la contraseña de ${user.fullName} por una temporal. ¿Seguimos?`,
      )
    ) {
      return;
    }
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      setReset({ id: user.id, password });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  if (users.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
        Todavía no hay cuentas registradas.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {users.map((user) => (
        <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="text-[11px] text-muted">
              {user.rankingUpdatedAt
                ? `Ranking actualizado el ${dateFmt.format(new Date(user.rankingUpdatedAt))}`
                : "Sin ranking guardado"}{" "}
              · {user.snapshotCount} screenshots
            </p>
            {reset?.id === user.id && (
              <p className="mt-1 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-xs">
                Contraseña temporal: <strong>{reset.password}</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleReset(user)}
            disabled={busyId === user.id}
            className="font-subhead shrink-0 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground disabled:opacity-50"
          >
            {busyId === user.id ? "Generando…" : "Resetear contraseña"}
          </button>
        </li>
      ))}
    </ul>
  );
}
