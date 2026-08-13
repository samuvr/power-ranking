import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getPreviousSnapshotEntryByEmail,
  getRankingByUser,
  getSnapshotById,
  getSnapshotEntriesByUser,
  getSnapshotEntryByUser,
  getUserById,
  getVoting,
} from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  computeDeviationVsPositions,
  type DeviationResult,
} from "@/lib/ranking-deviation";
import { computeEvolution } from "@/lib/ranking-evolution";
import { RankingComparison } from "@/components/RankingComparison";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type Params = Promise<{ userId: string }>;
type Search = Promise<{ snapshot?: string | string[] }>;

/** Primer nombre, que es con el que se etiqueta el ranking en la comparativa. */
function shortName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * Ranking de otro usuario con la misma información que `/consenso`, pero con
 * los papeles cambiados: la lista es SU ranking y la comparativa (desviación
 * media, clavados, mayor distancia, dónde crees más o menos que él y los
 * puestos al lado de cada equipo) es contra el ranking de quien mira.
 *
 * Sin `?snapshot` se enfrentan los rankings vigentes de los dos; con él, los
 * que ambos dejaron congelados en ese screenshot.
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
  let positions: string[] = [];
  let deltaByTeam = new Map<string, number | null>();
  let since: string | null = null;
  /** Ranking de quien mira, con el que se compara el de arriba. */
  let minePositions: string[] | null = null;
  let eyebrow: string;
  let subtitle: string;
  let imageUrl: string | null = null;
  /** Aviso cuando no hay comparación posible. */
  let note: string | null = null;

  if (snapshotId) {
    const entry = entries.find((e) => e.snapshot_id === snapshotId);
    const snapshot = entry ? await getSnapshotById(snapshotId) : null;
    if (!entry || !snapshot || snapshot.voting !== voting.id) notFound();

    // Flechas: cómo movió SUS equipos respecto al screenshot anterior en el
    // que participó. La comparación es contra tu ranking de esa misma foto.
    const [previous, myEntry] = await Promise.all([
      getPreviousSnapshotEntryByEmail(entry.email, voting.id, snapshot.created_at),
      viewer ? getSnapshotEntryByUser(snapshot.id, viewer.id) : Promise.resolve(null),
    ]);

    positions = entry.positions;
    deltaByTeam = new Map(
      computeEvolution(entry.positions, previous?.positions ?? null).map((e) => [
        e.teamAbbr,
        e.delta,
      ]),
    );
    since = previous?.snapshot_name ?? null;
    minePositions = isSelf ? null : (myEntry?.positions ?? null);
    eyebrow = "Ranking congelado";
    subtitle = `${snapshot.name} · congelado el ${dateFmt.format(
      new Date(snapshot.created_at),
    )}`;
    imageUrl = `/api/snapshots/${snapshot.id}/entries/${entry.id}/image`;

    if (isSelf) {
      note = `Este es tu propio ranking en ${snapshot.name}.`;
    } else if (!viewer) {
      note = "Estás como admin, sin ranking propio con el que comparar.";
    } else if (!myEntry) {
      note = `No apareces en ${snapshot.name}, así que no hay nada con lo que comparar su ranking.`;
    }
  } else {
    const [targetRanking, myRanking] = await Promise.all([
      getRankingByUser(target.id, voting.id),
      viewer && viewer.id !== target.id
        ? getRankingByUser(viewer.id, voting.id)
        : Promise.resolve(null),
    ]);

    // Flechas: su evolución desde el último screenshot en el que aparece.
    const lastEntry = entries[0] ?? null;
    positions = targetRanking?.positions ?? [];
    deltaByTeam = new Map(
      computeEvolution(positions, lastEntry?.positions ?? null).map((e) => [
        e.teamAbbr,
        e.delta,
      ]),
    );
    since = lastEntry?.snapshot_name ?? null;
    minePositions = myRanking?.positions ?? null;
    eyebrow = "Ranking en vivo";
    subtitle = targetRanking
      ? `Último ranking guardado el ${dateFmt.format(new Date(targetRanking.updated_at))}`
      : "Todavía sin ranking guardado";
    if (targetRanking) imageUrl = `/api/rankings/${targetRanking.id}/image`;

    if (!targetRanking) {
      note = `${target.full_name} todavía no ha guardado ningún ranking.`;
    } else if (isSelf) {
      note = "Este es tu propio ranking, tal y como lo tienes guardado.";
    } else if (!viewer) {
      note = "Estás como admin, sin ranking propio con el que comparar.";
    } else if (!myRanking) {
      note = `Guarda tu ranking para compararlo con el de ${name}.`;
    }
  }

  const deviation: DeviationResult | null =
    minePositions && positions.length > 0
      ? computeDeviationVsPositions(minePositions, positions)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            {eyebrow}
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

      {note && (
        <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
          {note}
          {isSelf && !snapshotId && (
            <>
              {" "}
              Para compararlo con el consensus, pásate por{" "}
              <Link href="/consenso" className="underline hover:text-foreground">
                Ver Consensus
              </Link>
              .
            </>
          )}
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

      {positions.length > 0 && (
        <RankingComparison
          positions={positions}
          reference={{
            title: `Ranking de ${name}`,
            name,
            de: `de ${name}`,
            a: `a ${name}`,
          }}
          deltaByTeam={deltaByTeam}
          since={since}
          deviation={deviation}
          accent={voting.accent}
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
