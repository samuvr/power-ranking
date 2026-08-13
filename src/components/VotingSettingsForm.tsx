"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VotingPublic } from "@/lib/db/client";

type Props = { voting: VotingPublic };

// Ajustes de la única votación de la app: identidad visual, acceso de
// votantes y contraseña. No permite crear ni borrar votaciones.
export function VotingSettingsForm({ voting }: Props) {
  const router = useRouter();

  const [name, setName] = useState(voting.name);
  const [shortName, setShortName] = useState(voting.short_name);
  const [description, setDescription] = useState(voting.description);
  const [accent, setAccent] = useState(voting.accent);
  const [accentDark, setAccentDark] = useState(voting.accent_dark);
  const [logoUrl, setLogoUrl] = useState(voting.logo_url);
  const [voterPassword, setVoterPassword] = useState("");
  const [active, setActive] = useState(voting.active);
  const [publicAccess, setPublicAccess] = useState(voting.public_access);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        shortName: shortName.trim(),
        description: description.trim(),
        accent,
        accentDark,
        logoUrl: logoUrl.trim(),
        active,
        publicAccess,
      };
      if (voterPassword) body.voterPassword = voterPassword;

      const res = await fetch("/api/admin/voting", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      setVoterPassword("");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nombre">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          minLength={2}
          required
          className={inputCls}
          placeholder="NFL Alicante"
        />
      </Field>

      <Field label="Abreviatura (2-8 chars)">
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          maxLength={8}
          minLength={2}
          required
          className={inputCls}
          placeholder="NFLA"
        />
      </Field>

      <Field label="Descripción">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={140}
          minLength={2}
          required
          className={inputCls}
          placeholder="Comunidad NFL de Alicante"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Color principal">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface"
          />
        </Field>
        <Field label="Color oscuro">
          <input
            type="color"
            value={accentDark}
            onChange={(e) => setAccentDark(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface"
          />
        </Field>
      </div>

      <Field label="URL del logo">
        <input
          type="text"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          maxLength={500}
          required
          className={inputCls}
          placeholder="/nfl-alicante.jpg o https://example.com/logo.png"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Votación abierta (se puede votar)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={publicAccess}
          onChange={(e) => setPublicAccess(e.target.checked)}
        />
        Acceso público (sin contraseña de votante)
      </label>

      {!publicAccess && (
        <Field label="Contraseña de votante" hint="Déjala vacía para no cambiarla">
          <input
            type="text"
            value={voterPassword}
            onChange={(e) => setVoterPassword(e.target.value)}
            minLength={4}
            className={inputCls}
            placeholder="••••••••"
            autoComplete="off"
          />
        </Field>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          Ajustes guardados.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-foreground px-4 py-3 text-base font-bold text-background transition disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:border-muted"
        >
          Volver
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-foreground";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted">
        <span>{label}</span>
        {hint && <span className="font-normal normal-case tracking-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
