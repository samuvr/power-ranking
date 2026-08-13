import Link from "next/link";
import { notFound } from "next/navigation";
import { getLatestSnapshot, getRankingsByVoting, getVoting } from "@/lib/db/client";
import { findTeamByAbbr, getAllTeams } from "@/data/teams";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { computeEvolution } from "@/lib/ranking-evolution";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";

export const dynamic = "force-dynamic";

export default async function EquiposPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const [rows, latest] = await Promise.all([
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
  ]);

  const positions =
    rows.length > 0
      ? [...computeGlobalRanking(rows.map((r) => r.positions)).ranking]
          .sort((a, b) => a.finalPosition - b.finalPosition)
          .map((e) => e.teamAbbr)
      : getAllTeams().map((t) => t.abbr);

  const deltaByTeam = new Map(
    computeEvolution(positions, latest?.consensus ?? null).map((e) => [e.teamAbbr, e.delta]),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            {rows.length > 0 ? "Consensus actual" : "Equipos"}
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">Equipos</h1>
          <p className="mt-1 text-sm text-muted">
            Entra en cualquier equipo para ver su evolución screenshot a screenshot.
          </p>
        </div>
        <Link
          href="/historico"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Screenshots
        </Link>
      </header>

      <ol className="space-y-2">
        {positions.map((abbr, idx) => {
          const team = findTeamByAbbr(abbr);
          return (
            <li
              key={abbr}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
            >
              <div className="w-10 text-right font-mono text-lg font-bold text-muted">
                {(idx + 1).toString().padStart(2, "0")}
              </div>
              {team && <TeamMark abbr={team.abbr} size={36} />}
              <Link href={`/equipos/${abbr}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                {team ? `${team.location} ${team.name}` : abbr}
              </Link>
              <EvolutionBadge delta={deltaByTeam.get(abbr) ?? null} since={latest?.name} />
            </li>
          );
        })}
      </ol>
    </main>
  );
}
