import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLatestSnapshot,
  getRankingsByVoting,
  getVoting,
  listSnapshots,
} from "@/lib/db/client";
import { isUpdatedAfter, snapshotCutoff } from "@/lib/ranking-pool";
import { ScreenshotsView } from "./ScreenshotsView";

export const dynamic = "force-dynamic";

export default async function AdminScreenshotsPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const [snapshots, rows, latest] = await Promise.all([
    listSnapshots(voting.id),
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
  ]);

  const cutoff = snapshotCutoff(latest);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Histórico
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">Screenshots</h1>
        </div>
        <Link
          href="/admin"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Panel
        </Link>
      </header>

      <ScreenshotsView
        accent={voting.accent}
        lastSnapshotName={latest?.name ?? null}
        snapshots={snapshots.map((s) => ({
          id: s.id,
          name: s.name,
          createdAt: new Date(s.created_at).toISOString(),
          entryCount: s.entry_count,
        }))}
        participants={rows.map((r) => ({
          id: r.id,
          fullName: r.full_name,
          email: r.email,
          updatedAt: new Date(r.updated_at).toISOString(),
          updatedSinceLast: isUpdatedAfter(r.updated_at, cutoff),
        }))}
      />
    </main>
  );
}
