"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { publicAccess: boolean };

export function HomeForm({ publicAccess }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("tpr:user");
      if (stored) {
        const parsed = JSON.parse(stored) as { fullName?: string; email?: string };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.email) setEmail(parsed.email);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) {
      setError("Introduce tu nombre completo");
      return;
    }
    if (!email.includes("@")) {
      setError("Introduce un email válido");
      return;
    }
    if (!publicAccess && !password) {
      setError("Introduce la contraseña de la votación");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/voting/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(publicAccess ? {} : { password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      try {
        sessionStorage.setItem(
          "tpr:user",
          JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
        );
      } catch {
        // ignore
      }
      router.push("/vote");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <label className="block">
        <span className="font-subhead mb-1 flex items-baseline justify-between text-[11px] uppercase tracking-wide text-muted">
          <span>Nombre completo</span>
          {fullName.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums">{fullName.length}/30</span>
          )}
        </span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={30}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-foreground"
          placeholder="Tu nombre"
          autoComplete="name"
          required
        />
      </label>

      <label className="block">
        <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
          Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-foreground"
          placeholder="tu@email.com"
          autoComplete="email"
          inputMode="email"
          required
        />
      </label>

      {!publicAccess && (
        <label className="block">
          <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
            Contraseña
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-foreground"
            placeholder="Contraseña de la votación"
            autoComplete="current-password"
            required
          />
        </label>
      )}

      {error && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="font-subhead mt-2 rounded-xl bg-accent px-4 py-3 text-base uppercase tracking-wide text-white transition active:scale-[0.98] hover:bg-accent-dark disabled:opacity-50"
      >
        {busy ? "Entrando…" : "Empezar ranking"}
      </button>
    </form>
  );
}
