"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { fullName: string; email: string };

export function ProfileForm({ fullName, email }: Props) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);

    const payload: Record<string, string> = {};
    if (name.trim() !== fullName) payload.fullName = name.trim();
    if (newPassword) {
      payload.newPassword = newPassword;
      payload.currentPassword = currentPassword;
    }
    if (Object.keys(payload).length === 0) {
      setError("No hay cambios que guardar");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      setOk(true);
      setCurrentPassword("");
      setNewPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="block">
        <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
          Nombre completo
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-foreground"
          autoComplete="name"
        />
        <span className="mt-1 block text-[11px] text-muted">
          Es el nombre que aparece en tus imágenes y en el histórico.
        </span>
      </label>

      <label className="block">
        <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
          Email
        </span>
        <input
          type="email"
          value={email}
          disabled
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base text-muted outline-none"
        />
        <span className="mt-1 block text-[11px] text-muted">
          El email identifica tu cuenta y no se puede cambiar.
        </span>
      </label>

      <fieldset className="rounded-xl border border-border bg-surface p-3">
        <legend className="font-subhead px-1 text-[11px] uppercase tracking-wide text-muted">
          Cambiar contraseña
        </legend>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Contraseña actual"
            autoComplete="current-password"
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base outline-none transition focus:border-foreground"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña (mínimo 8)"
            autoComplete="new-password"
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base outline-none transition focus:border-foreground"
          />
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          Cambios guardados.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="font-subhead rounded-xl bg-accent px-4 py-3 text-sm uppercase tracking-wide text-white transition active:scale-[0.98] hover:bg-accent-dark disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="font-subhead rounded-xl border border-border bg-surface px-4 py-3 text-sm uppercase tracking-wide transition hover:border-foreground"
        >
          Cerrar sesión
        </button>
      </div>
    </form>
  );
}
