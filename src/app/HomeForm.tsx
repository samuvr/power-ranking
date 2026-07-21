"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VotingSelector } from "@/components/VotingSelector";
import type { VotingPublic } from "@/lib/db/client";

type Props = { votings: VotingPublic[] };

export function HomeForm({ votings }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
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
    const voting = votings.find((v) => v.id === votingId);
    if (!voting) {
      setError("Elige una votación");
      return;
    }
    try {
      sessionStorage.setItem(
        "tpr:user",
        JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
      );
    } catch {
      // ignore
    }
    router.push(`/vote/${voting.slug}`);
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

      <div>
        <span className="font-subhead mb-2 block text-[11px] uppercase tracking-wide text-muted">
          Votación
        </span>
        <VotingSelector value={votingId} onChange={setVotingId} votings={votings} />
      </div>

      {error && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="font-subhead mt-2 rounded-xl bg-accent px-4 py-3 text-base uppercase tracking-wide text-white transition active:scale-[0.98] hover:bg-accent-dark"
      >
        Empezar ranking
      </button>
    </form>
  );
}
