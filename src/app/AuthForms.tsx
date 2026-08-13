"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

type Props = { publicAccess: boolean };

export function AuthForms({ publicAccess }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [votingPassword, setVotingPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister && fullName.trim().length < 2) {
      setError("Introduce tu nombre completo");
      return;
    }
    if (!email.includes("@")) {
      setError("Introduce un email válido");
      return;
    }
    if (isRegister && password.length < 8) {
      setError("La contraseña necesita al menos 8 caracteres");
      return;
    }
    if (isRegister && !publicAccess && !votingPassword) {
      setError("Introduce la contraseña de la comunidad");
      return;
    }

    setBusy(true);
    try {
      const url = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister
        ? {
            fullName: fullName.trim(),
            email: email.trim(),
            password,
            ...(publicAccess ? {} : { votingPassword }),
          }
        : { email: email.trim(), password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      router.push("/vote");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isRegister}
          onClick={() => switchMode("login")}
          className={`font-subhead px-3 py-2 text-xs uppercase tracking-wide transition ${
            !isRegister ? "bg-surface-2 text-foreground" : "text-muted"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isRegister}
          onClick={() => switchMode("register")}
          className={`font-subhead px-3 py-2 text-xs uppercase tracking-wide transition ${
            isRegister ? "bg-surface-2 text-foreground" : "text-muted"
          }`}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {isRegister && (
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
        )}

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

        <label className="block">
          <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
            Contraseña
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-foreground"
            placeholder={isRegister ? "Mínimo 8 caracteres" : "Tu contraseña"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
          />
        </label>

        {isRegister && !publicAccess && (
          <label className="block">
            <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
              Contraseña de la comunidad
            </span>
            <input
              type="password"
              value={votingPassword}
              onChange={(e) => setVotingPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-foreground"
              placeholder="La que se comparte en el grupo"
              autoComplete="off"
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
          {busy ? "Entrando…" : isRegister ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <p className="text-center text-xs text-muted">
        {isRegister ? (
          <>
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="underline underline-offset-2"
            >
              Inicia sesión
            </button>
          </>
        ) : (
          <>
            ¿Aún no tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => switchMode("register")}
              className="underline underline-offset-2"
            >
              Créala aquí
            </button>
          </>
        )}
      </p>
    </div>
  );
}
