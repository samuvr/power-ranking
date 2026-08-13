import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPreviousSnapshot,
  getSnapshotById,
  getSnapshotEntries,
  getVoting,
} from "@/lib/db/client";
import { findTeamByAbbr } from "@/data/teams";
import { computeEvolution, topMovers } from "@/lib/ranking-evolution";
import { RankingListView } from "@/components/RankingListView";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";

export const dynamic = "force-dynamic";

type Params = Promise<{ snapshotId: string }>;

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default async function SnapshotPage({ params }: { params: Params }) {
  const { snapshotId } = await params;

  const voting = await getVoting();
  if (!voting) notFound();

  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot || snapshot.voting !== voting.id) notFound();

  const [previous, entries] = await Promise.all([
    getPreviousSnapshot(snapshot.voting, snapshot.created_at),
    getSnapshotEntries(snapshot.id),
  ]);

  const evolutions = computeEvolution(snapshot.consensus, previous?.consensus ?? null);
  const deltaByTeam = new Map(evolutions.map((e) => [e.teamAbbr, e.delta]));
  const { risers, fallers } = topMovers(evolutions, 3);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Consensus congelado
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">{snapshot.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {dateFmt.format(new Date(snapshot.created_at))} · {snapshot.entry_count}{" "}
            rankings
            {previous ? ` · evolución vs ${previous.name}` : " · primer screenshot"}
          </p>
        </div>
        <Link
          href="/historico"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Screenshots
        </Link>
      </header>

      <a
        href={`/api/snapshots/${snapshot.id}/image`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-subhead mb-6 inline-block rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
      >
        Ver imagen del consensus
      </a>

      {(risers.length > 0 || fallers.length > 0) && (
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoversColumn title="Los que más suben" entries={risers} since={previous?.name} />
          <MoversColumn title="Los que más bajan" entries={fallers} since={previous?.name} />
        </section>
      )}

      <RankingListView
        positions={snapshot.consensus}
        deltaByTeam={deltaByTeam}
        since={previous?.name ?? null}
      />

      <section className="mt-8">
        <h2 className="font-subhead mb-2 text-xs uppercase tracking-[0.2em] text-muted">
          Rankings incluidos ({entries.length})
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <p className="min-w-0 truncate text-sm font-semibold">{entry.full_name}</p>
              <Link
                href={`/historico/${snapshot.id}/${entry.id}`}
                className="font-subhead shrink-0 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground"
              >
                Ver ranking
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function MoversColumn({
  title,
  entries,
  since,
}: {
  title: string;
  entries: Array<{ teamAbbr: string; position: number; previousPosition: number | null; delta: number | null }>;
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
