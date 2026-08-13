import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getRankingsByVoting,
  getVoting,
  listSnapshots,
  toPublicVoting,
} from "@/lib/db/client";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { computeDeviationLeaveOneOut } from "@/lib/ranking-deviation";
import { computeEvolution } from "@/lib/ranking-evolution";
import { getAllTeams } from "@/data/teams";
import { LoginForm } from "./LoginForm";
import { AdminRankingView } from "./AdminRankingView";

type Search = Promise<{ next?: string; mode?: string; round?: string; base?: string }>;

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-10">
        <header className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Panel</p>
          <h1 className="mt-1 text-3xl font-black">Admin</h1>
          <p className="mt-2 text-sm text-muted">Introduce la contraseña para acceder.</p>
        </header>
        <LoginForm nextPath={search.next ?? "/admin"} />
      </main>
    );
  }

  const voting = await getVoting();
  if (!voting) notFound();

  const [rows, snapshots] = await Promise.all([
    getRankingsByVoting(voting.id),
    listSnapshots(voting.id),
  ]);
  const result = computeGlobalRanking(rows.map((r) => r.positions));
  const teamCount = getAllTeams().length;

  // Base de la evolución: el screenshot elegido o, por defecto, el último.
  const baseSnapshot =
    (search.base ? snapshots.find((s) => s.id === search.base) : snapshots[0]) ?? null;
  const consensusPositions = [...result.ranking]
    .sort((a, b) => a.finalPosition - b.finalPosition)
    .map((entry) => entry.teamAbbr);
  const deltas: Record<string, number | null> = {};
  for (const evolution of computeEvolution(
    consensusPositions,
    baseSnapshot?.consensus ?? null,
  )) {
    deltas[evolution.teamAbbr] = evolution.delta;
  }

  const initialMode = search.mode === "stream" ? "stream" : "list";
  const initialRound = Math.max(
    0,
    Math.min(result.rounds.length - 1, parseInt(search.round ?? "0", 10) || 0),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Ranking global
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">{voting.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {result.totalSubmissions} envíos · {teamCount} equipos en 7 rondas
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link
            href="/admin/screenshots"
            className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
          >
            Screenshots
          </Link>
          <Link
            href="/admin/usuarios"
            className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
          >
            Usuarios
          </Link>
          <Link
            href="/admin/ajustes"
            className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
          >
            Ajustes
          </Link>
        </nav>
      </header>

      {result.totalSubmissions === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Todavía no hay envíos en la votación.
        </div>
      ) : (
        <AdminRankingView
          voting={toPublicVoting(voting)}
          result={result}
          initialMode={initialMode}
          initialRound={initialRound}
          deltas={deltas}
          snapshots={snapshots.map((s) => ({ id: s.id, name: s.name }))}
          baseSnapshot={
            baseSnapshot ? { id: baseSnapshot.id, name: baseSnapshot.name } : null
          }
          voters={rows
            .map((r) => ({
              id: r.id,
              fullName: r.full_name,
              email: r.email,
              updatedAt: r.updated_at,
              meanDeviation: computeDeviationLeaveOneOut(
                r.positions,
                rows.filter((o) => o.id !== r.id).map((o) => o.positions),
              ).meanAbsDeviation,
            }))
            .sort((a, b) => a.meanDeviation - b.meanDeviation)
            .map((v, idx) => ({ ...v, rankPosition: idx + 1 }))}
        />
      )}
    </main>
  );
}
