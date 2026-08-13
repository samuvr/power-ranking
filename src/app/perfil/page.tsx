import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getSnapshotEntriesByUser,
  getVoting,
  listSnapshots,
} from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { computeDeviationVsPositions } from "@/lib/ranking-deviation";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [snapshots, entries] = await Promise.all([
    listSnapshots(voting.id),
    getSnapshotEntriesByUser(user.id, voting.id),
  ]);

  const consensusById = new Map(snapshots.map((s) => [s.id, s.consensus]));

  // Desviación media histórica: cómo de lejos ha estado del consenso en cada
  // screenshot en el que participó.
  const deviations = entries
    .map((entry) => {
      const consensus = consensusById.get(entry.snapshot_id);
      if (!consensus) return null;
      return {
        snapshotId: entry.snapshot_id,
        name: entry.snapshot_name,
        value: computeDeviationVsPositions(entry.positions, consensus).meanAbsDeviation,
      };
    })
    .filter((d): d is { snapshotId: string; name: string; value: number } => d !== null);

  const meanDeviation =
    deviations.length > 0
      ? deviations.reduce((acc, d) => acc + d.value, 0) / deviations.length
      : null;

  const fmt = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <header className="mb-6">
        <p
          className="font-subhead text-xs uppercase tracking-[0.25em]"
          style={{ color: voting.accent }}
        >
          Mi cuenta
        </p>
        <h1 className="font-display text-4xl uppercase leading-tight">{user.full_name}</h1>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
            Participación
          </p>
          <p className="font-mono text-2xl font-bold">
            {entries.length}/{snapshots.length}
          </p>
          <p className="text-[11px] text-muted">screenshots con tu ranking</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
            Desviación media
          </p>
          <p className="font-mono text-2xl font-bold">
            {meanDeviation === null ? "—" : fmt(meanDeviation)}
          </p>
          <p className="text-[11px] text-muted">puestos frente al consenso</p>
        </div>
      </section>

      {deviations.length > 0 && (
        <section className="mb-6">
          <h2 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
            Tu desviación screenshot a screenshot
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {deviations.map((d) => (
              <li key={d.snapshotId} className="flex items-center justify-between px-3 py-2 text-sm">
                <Link href={`/historico/${d.snapshotId}`} className="truncate hover:underline">
                  {d.name}
                </Link>
                <span className="font-mono font-bold">{fmt(d.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProfileForm fullName={user.full_name} email={user.email} />

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Mi ranking
        </Link>
        <Link
          href="/historico"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Revisar Screenshots
        </Link>
      </nav>
    </main>
  );
}
