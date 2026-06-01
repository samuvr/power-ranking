"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VotingPublic } from "@/lib/db/client";

type Props =
  | { mode: "create"; voting?: undefined }
  | { mode: "edit"; voting: VotingPublic };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function VotingForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.voting : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugDirty, setSlugDirty] = useState(false);
  const [shortName, setShortName] = useState(initial?.short_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [accent, setAccent] = useState(initial?.accent ?? "#D81E2C");
  const [accentDark, setAccentDark] = useState(initial?.accent_dark ?? "#8C0F1A");
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [voterPassword, setVoterPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [active, setActive] = useState(initial?.active ?? true);
  const [publicAccess, setPublicAccess] = useState(initial?.public_access ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugDirty) setSlug(slugify(v));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim(),
        shortName: shortName.trim(),
        description: description.trim(),
        accent,
        accentDark,
        logoUrl: logoUrl.trim(),
        publicAccess,
      };
      if (voterPassword) body.voterPassword = voterPassword;
      if (adminPassword) body.adminPassword = adminPassword;
      if (props.mode === "edit") body.active = active;

      if (props.mode === "create") {
        if (!publicAccess && !voterPassword) {
          throw new Error("La contraseña de votante es obligatoria en votaciones no públicas");
        }
        if (!adminPassword) {
          throw new Error("La contraseña de administrador es obligatoria al crear");
        }
      }

      const url = props.mode === "create"
        ? "/api/admin/votings"
        : `/api/admin/votings/${props.voting.id}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nombre">
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          maxLength={60}
          required
          className={inputCls}
          placeholder="Mi Votación 2026"
        />
      </Field>

      <Field label="Slug (URL)" hint={`/vote/${slug || "..."}`}>
        <input
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value.toLowerCase());
            setSlugDirty(true);
          }}
          maxLength={40}
          required
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          className={inputCls}
          placeholder="mi-votacion-2026"
        />
      </Field>

      <Field label="Abreviatura (3-5 chars)">
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          maxLength={8}
          minLength={2}
          required
          className={inputCls}
          placeholder="MV26"
        />
      </Field>

      <Field label="Descripción">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={140}
          required
          className={inputCls}
          placeholder="Comunidad / podcast / liga…"
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
          placeholder="/logo.png o https://example.com/logo.png"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={publicAccess}
          onChange={(e) => setPublicAccess(e.target.checked)}
        />
        Acceso público (sin contraseña de votante)
      </label>

      {!publicAccess && (
        <Field
          label="Contraseña de votante"
          hint={props.mode === "edit" ? "Déjala vacía para no cambiarla" : undefined}
        >
          <input
            type="text"
            value={voterPassword}
            onChange={(e) => setVoterPassword(e.target.value)}
            minLength={props.mode === "create" ? 4 : 0}
            required={props.mode === "create" && !publicAccess}
            className={inputCls}
            placeholder="••••••••"
            autoComplete="off"
          />
        </Field>
      )}

      <Field
        label="Contraseña de admin de votación"
        hint={props.mode === "edit" ? "Déjala vacía para no cambiarla" : undefined}
      >
        <input
          type="text"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          minLength={props.mode === "create" ? 4 : 0}
          required={props.mode === "create"}
          className={inputCls}
          placeholder="••••••••"
          autoComplete="off"
        />
      </Field>

      {props.mode === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Activa (visible en la home)
        </label>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-foreground px-4 py-3 text-base font-bold text-background transition disabled:opacity-50"
        >
          {busy ? "Guardando…" : props.mode === "create" ? "Crear votación" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:border-muted"
        >
          Cancelar
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
