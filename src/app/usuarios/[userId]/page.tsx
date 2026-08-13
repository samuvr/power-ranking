import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getLatestSnapshot,
  getPreviousSnapshot,
  getRankingByUser,
  getRankingsByVoting,
  getSnapshotById,
  getSnapshotEntriesByUser,
  getUserById,
  getVoting,
} from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import {
  computeDeviation,
  computeDeviationLeaveOneOut,
  computeDeviationVsPositions,
  type DeviationResult,
} from "@/lib/ranking-deviation";
import { computeEvolution } from "@/lib/ranking-evolution";
import { ConsensusComparison } from "@/components/ConsensusComparison";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type Params = Promise<{ userId: string }>;
type Search = Promise<{ snapshot?: string | string[] }>;

/** Primer nombre, que es con el que se etiquetan los puestos en la lista. */
function shortName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * Ranking de otro usuario enfrentado al consensus, con la misma información
 * que `/consenso`: o su último ranking guardado contra el consensus en vivo,
 * o el que dejó congelado en un screenshot contra el consensus de ese
 * screenshot (`?snapshot=<id>`).
 */
export default async function UsuarioPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const voting = await getVoting();
  if (!voting) notFound();

  const viewer = await getCurrentUser();
  if (!viewer && !(await isAdminAuthenticated())) redirect("/");

  const { userId } = await params;
  const { snapshot: snapshotParam } = await searchParams;
  const snapshotId = Array.isArray(snapshotParam) ? snapshotParam[0] : snapshotParam;

  const [target, entries] = await Promise.all([
    getUserById(userId),
    getSnapshotEntriesByUser(userId, voting.id),
  ]);
  if (!target) notFound();

  const name = shortName(target.full_name);
  const isSelf = viewer?.id === target.id;

  // Lo que cambia entre "último guardado" y un screenshot concreto.
  let consensusPositions: string[] = [];
  let deltaByTeam = new Map<string, number | null>();
  let since: string | null = null;
  let deviation: DeviationResult | null = null;
  let meanDeviation: number | null = null;
  let subtitle: string;
  let imageUrl: string | null = null;
  /** Aviso cuando no hay nada que comparar. */
  let emptyNote: string | null = null;

  if (snapshotId) {
    const entry = entries.find((e) => e.snapshot_id === snapshotId);
    const snapshot = entry ? await getSnapshotById(snapshotId) : null;
    if (!entry || !snapshot || snapshot.voting !== voting.id) notFound();

    const previous = await getPreviousSnapshot(voting.id, snapshot.created_at);
    consensusPositions = snapshot.consensus;
    deltaByTeam = new Map(
      computeEvolution(snapshot.consensus, previous?.consensus ?? null).map((e) => [
        e.teamAbbr,
        e.delta,
      ]),
    );
    since = previous?.name ?? null;
    deviation = computeDeviationVsPositions(entry.positions, snapshot.consensus);
    subtitle = `${snapshot.name} · congelado el ${dateFmt.format(
      new Date(snapshot.created_at),
    )}`;
    imageUrl = `/api/snapshots/${snapshot.id}/entries/${entry.id}/image`;
  } else {
    const [rankings, latestSnapshot, targetRanking] = await Promise.all([
      getRankingsByVoting(voting.id),
      getLatestSnapshot(voting.id),
      getRankingByUser(target.id, voting.id),
    ]);

    const consensus =
      rankings.length > 0 ? computeGlobalRanking(rankings.map((r) => r.positions)) : null;
    consensusPositions = consensus?.ranking.map((e) => e.teamAbbr) ?? [];
    deltaByTeam = new Map(
      computeEvolution(consensusPositions, latestSnapshot?.consensus ?? null).map((e) => [
        e.teamAbbr,
        e.delta,
      ]),
    );
    since = latestSnapshot?.name ?? null;

    if (consensus && targetRanking) {
      deviation = computeDeviation(targetRanking.positions, consensus.ranking);
      // Igual que en /consenso, la desviación media va "leave one out": el
      // consensus de referencia se calcula sin el voto de este usuario.
      meanDeviation = computeDeviationLeaveOneOut(
        targetRanking.positions,
        rankings.filter((r) => r.id !== targetRanking.id).map((r) => r.positions),
      ).meanAbsDeviation;
      imageUrl = `/api/rankings/${targetRanking.id}/image`;
    }

    subtitle = targetRanking
      ? `Último ranking guardado el ${dateFmt.format(new Date(targetRanking.updated_at))}`
      : "Todavía sin ranking guardado";

    if (consensus === null) {
      emptyNote =
        "Todavía no hay ningún ranking guardado, así que aún no se puede calcular el consensus.";
    } else if (!targetRanking) {
      emptyNote = `${target.full_name} todavía no ha guardado ningún ranking, así que abajo solo está el consensus en vivo.`;
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            {snapshotId ? "Ranking congelado" : "Consensus en vivo"}
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">
            {target.full_name}
          </h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <Link
          href="/usuarios"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Otros usuarios
        </Link>
      </header>

      <nav
        aria-label="Rankings de este usuario"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <SelectorChip
          href={`/usuarios/${target.id}`}
          label="Último guardado"
          active={!snapshotId}
          accent={voting.accent}
        />
        {entries.map((entry) => (
          <SelectorChip
            key={entry.snapshot_id}
            href={`/usuarios/${target.id}?snapshot=${entry.snapshot_id}`}
            label={entry.snapshot_name}
            active={snapshotId === entry.snapshot_id}
            accent={voting.accent}
          />
        ))}
        {entries.length === 0 && (
          <span className="text-xs text-muted">
            Sin rankings guardados en ningún screenshot.
          </span>
        )}
      </nav>

      {emptyNote && (
        <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
          {emptyNote}
        </p>
      )}

      {imageUrl && (
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-subhead mb-4 inline-block rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Ver imagen
        </a>
      )}

      {consensusPositions.length > 0 && (
        <ConsensusComparison
          consensusPositions={consensusPositions}
          deltaByTeam={deltaByTeam}
          since={since}
          deviation={deviation}
          meanDeviation={meanDeviation}
          accent={voting.accent}
          subject={{ self: isSelf, name }}
        />
      )}

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/usuarios"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Otros usuarios
        </Link>
        <Link
          href="/consenso"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Ver Consensus
        </Link>
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Mi ranking
        </Link>
      </nav>
    </main>
  );
}

function SelectorChip({
  href,
  label,
  active,
  accent,
}: {
  href: string;
  label: string;
  active: boolean;
  accent: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`font-subhead rounded-lg border bg-surface px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground ${
        active ? "font-bold" : "border-border"
      }`}
      style={active ? { borderColor: accent, color: accent } : undefined}
    >
      {label}
    </Link>
  );
}
