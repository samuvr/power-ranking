import Link from "next/link";
import { notFound } from "next/navigation";
import { getVoting, listSnapshots } from "@/lib/db/client";
import { computeEvolution, topMovers } from "@/lib/ranking-evolution";
import { RankingListView } from "@/components/RankingListView";
import { findTeamByAbbr } from "@/data/teams";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";
import { CompareSelector } from "./CompareSelector";

export const dynamic = "force-dynamic";

type Search = Promise<{ a?: string; b?: string }>;

export default async function CompararPage({ searchParams }: { searchParams: Search }) {
  const { a, b } = await searchParams;

  const voting = await getVoting();
  if (!voting) notFound();

  // Más reciente primero; para los selectores da igual el orden.
  const snapshots = await listSnapshots(voting.id);
  if (snapshots.length < 2) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <h1 className="font-display text-4xl uppercase leading-tight">Comparar</h1>
        <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-sm text-muted">
          Hacen falta al menos dos screenshots para poder compararlos.
        </p>
        <Link
          href="/historico"
          className="font-subhead mt-4 inline-block rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Screenshots
        </Link>
      </main>
    );
  }

  const byId = new Map(snapshots.map((s) => [s.id, s]));
  const base = (a && byId.get(a)) || snapshots[1];
  const target = (b && byId.get(b)) || snapshots[0];

  const evolutions = computeEvolution(target.consensus, base.consensus);
  const deltaByTeam = new Map(evolutions.map((e) => [e.teamAbbr, e.delta]));
  const { risers, fallers } = topMovers(evolutions, 5);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Comparador
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">
            {base.name} → {target.name}
          </h1>
        </div>
        <Link
          href="/historico"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Screenshots
        </Link>
      </header>

      <CompareSelector
        options={snapshots.map((s) => ({ id: s.id, name: s.name }))}
        a={base.id}
        b={target.id}
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoversColumn title="Los que más suben" entries={risers} since={base.name} />
        <MoversColumn title="Los que más bajan" entries={fallers} since={base.name} />
      </section>

      <RankingListView
        positions={target.consensus}
        deltaByTeam={deltaByTeam}
        since={base.name}
      />
    </main>
  );
}

function MoversColumn({
  title,
  entries,
  since,
}: {
  title: string;
  entries: Array<{
    teamAbbr: string;
    position: number;
    previousPosition: number | null;
    delta: number | null;
  }>;
  since?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <h3 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
        {title}
      </h3>
      <ul className="space-y-2">
        {entries.map((entry) => {
          const team = findTeamByAbbr(entry.teamAbbr);
          return (
            <li key={entry.teamAbbr} className="flex items-center gap-2 text-sm">
              {team && <TeamMark abbr={team.abbr} size={28} />}
              <Link
                href={`/equipos/${entry.teamAbbr}`}
                className="min-w-0 flex-1 truncate hover:underline"
              >
                {team ? `${team.location} ${team.name}` : entry.teamAbbr}
              </Link>
              <span className="font-mono text-xs text-muted">
                #{entry.previousPosition} → #{entry.position}
              </span>
              <EvolutionBadge delta={entry.delta} since={since} size="sm" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
