import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPreviousSnapshotEntryByEmail,
  getSnapshotById,
  getSnapshotEntryById,
  getVoting,
} from "@/lib/db/client";
import { computeEvolution } from "@/lib/ranking-evolution";
import { computeDeviationVsPositions } from "@/lib/ranking-deviation";
import { RankingListView } from "@/components/RankingListView";

export const dynamic = "force-dynamic";

type Params = Promise<{ snapshotId: string; entryId: string }>;

export default async function SnapshotEntryPage({ params }: { params: Params }) {
  const { snapshotId, entryId } = await params;

  const voting = await getVoting();
  if (!voting) notFound();

  const [snapshot, entry] = await Promise.all([
    getSnapshotById(snapshotId),
    getSnapshotEntryById(entryId),
  ]);
  if (!snapshot || snapshot.voting !== voting.id) notFound();
  if (!entry || entry.snapshot_id !== snapshot.id) notFound();

  const previous = await getPreviousSnapshotEntryByEmail(
    entry.email,
    snapshot.voting,
    snapshot.created_at,
  );
  const deltaByTeam = new Map(
    computeEvolution(entry.positions, previous?.positions ?? null).map((e) => [
      e.teamAbbr,
      e.delta,
    ]),
  );

  const deviation = computeDeviationVsPositions(entry.positions, snapshot.consensus);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            {snapshot.name}
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">{entry.full_name}</h1>
          <p className="mt-1 text-sm text-muted">
            Desviación frente al consensus de este screenshot:{" "}
            <span className="font-mono font-bold text-foreground">
              {deviation.meanAbsDeviation.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {previous ? ` · evolución vs ${previous.snapshot_name}` : " · primera participación"}
          </p>
        </div>
        <Link
          href={`/historico/${snapshot.id}`}
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← {snapshot.name}
        </Link>
      </header>

      <a
        href={`/api/snapshots/${snapshot.id}/entries/${entry.id}/image`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-subhead mb-6 inline-block rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
      >
        Ver imagen
      </a>

      <RankingListView
        positions={entry.positions}
        deltaByTeam={deltaByTeam}
        since={previous?.snapshot_name ?? null}
      />
    </main>
  );
}
