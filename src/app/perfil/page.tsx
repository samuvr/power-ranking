import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getRankingByUser,
  getSnapshotEntriesByUser,
  getVoting,
  listSnapshots,
} from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { computeDeviationVsPositions } from "@/lib/ranking-deviation";
import {
  seasonBiggestChanges,
  seasonChanges,
  seasonTopSlices,
  type SeasonChange,
  type SeasonPoint,
} from "@/lib/ranking-season";
import { findTeamByAbbr } from "@/data/teams";
import { EVOLUTION_UP, EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [snapshots, entries, liveRanking] = await Promise.all([
    listSnapshots(voting.id),
    getSnapshotEntriesByUser(user.id, voting.id),
    getRankingByUser(user.id, voting.id),
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

  // Mi temporada: sus rankings congelados del más antiguo al más reciente
  // (getSnapshotEntriesByUser los da al revés), cerrados con lo que tiene
  // guardado ahora mismo.
  const seasonPoints: SeasonPoint[] = [...entries]
    .reverse()
    .map((entry) => ({
      id: entry.snapshot_id,
      label: entry.snapshot_name,
      positions: entry.positions,
    }));
  if (liveRanking) {
    seasonPoints.push({ id: null, label: "Ahora", positions: liveRanking.positions });
  }

  const slices = seasonTopSlices(seasonPoints, 3);
  const changes = seasonChanges(seasonPoints);
  const { risers, fallers } = seasonBiggestChanges(changes, 3);
  const firstLabel = seasonPoints[0]?.label ?? "";

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

      {slices.length > 0 && (
        <section className="mb-6">
          <h2 className="font-subhead mb-1 text-[11px] uppercase tracking-wide text-muted">
            Mi temporada
          </h2>
          <p className="mb-3 text-[11px] text-muted">
            Tu podio en cada screenshot en el que participaste. En verde quien entra,
            tachado quien se cae.
          </p>
          <ul className="space-y-2">
            {[...slices].reverse().map((slice) => (
              <li
                key={slice.id ?? "ahora"}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  {slice.id ? (
                    <Link
                      href={`/historico/${slice.id}`}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {slice.label}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-semibold">{slice.label}</span>
                  )}
                  {slice.left.length > 0 && (
                    <span className="font-mono text-[10px] text-muted line-through">
                      {slice.left.map((abbr) => findTeamByAbbr(abbr)?.name ?? abbr).join(", ")}
                    </span>
                  )}
                </div>
                <ol className="space-y-1">
                  {slice.top.map((abbr, idx) => {
                    const team = findTeamByAbbr(abbr);
                    const isNew = slice.entered.includes(abbr);
                    return (
                      <li key={abbr} className="flex items-center gap-2">
                        <span className="w-5 text-right font-mono text-xs text-muted">
                          {idx + 1}
                        </span>
                        <TeamMark abbr={abbr} size={22} />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {team ? `${team.location} ${team.name}` : abbr}
                        </span>
                        {isNew && (
                          <span
                            className="font-subhead shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
                            style={{ borderColor: EVOLUTION_UP, color: EVOLUTION_UP }}
                          >
                            Nuevo
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(risers.length > 0 || fallers.length > 0) && (
        <section className="mb-6">
          <h2 className="font-subhead mb-1 text-[11px] uppercase tracking-wide text-muted">
            En qué has cambiado de opinión
          </h2>
          <p className="mb-3 text-[11px] text-muted">
            Desde <strong>{firstLabel}</strong> hasta tu ranking de ahora.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ChangeList title="Han subido" changes={risers} />
            <ChangeList title="Han bajado" changes={fallers} />
          </div>
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

function ChangeList({ title, changes }: { title: string; changes: SeasonChange[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">{title}</p>
      {changes.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">Nadie.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {changes.map((change) => {
            const team = findTeamByAbbr(change.teamAbbr);
            return (
              <li key={change.teamAbbr} className="flex items-center gap-2">
                <TeamMark abbr={change.teamAbbr} size={22} />
                <span className="min-w-0 flex-1 truncate text-xs">
                  {team ? team.name : change.teamAbbr}
                </span>
                <EvolutionBadge delta={change.delta} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
