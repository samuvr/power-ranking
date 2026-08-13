import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getLatestSnapshot,
  getRankingByUser,
  getRankingsByVoting,
  getVoting,
} from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import {
  computeDeviation,
  topOverratedUnderrated,
  type DeviationEntry,
} from "@/lib/ranking-deviation";
import { computeEvolution } from "@/lib/ranking-evolution";
import { findTeamByAbbr } from "@/data/teams";
import { TeamMark } from "@/components/TeamMark";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { RankingListView } from "@/components/RankingListView";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const fmt = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Consensus en vivo: el ranking global calculado con los rankings guardados en
 * este momento (no el congelado de un screenshot), enfrentado al ranking del
 * usuario que lo mira.
 */
export default async function ConsensoPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user && !(await isAdminAuthenticated())) redirect("/");

  const [rankings, latestSnapshot, myRanking] = await Promise.all([
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
    user ? getRankingByUser(user.id, voting.id) : Promise.resolve(null),
  ]);

  const consensus =
    rankings.length > 0 ? computeGlobalRanking(rankings.map((r) => r.positions)) : null;
  const consensusPositions = consensus?.ranking.map((e) => e.teamAbbr) ?? [];

  // Flechas del consensus en vivo respecto al último screenshot congelado.
  const deltaByTeam = new Map(
    computeEvolution(consensusPositions, latestSnapshot?.consensus ?? null).map((e) => [
      e.teamAbbr,
      e.delta,
    ]),
  );

  // Comparativa con el ranking del usuario. Se compara contra el consensus que
  // se está pintando (que incluye su propio voto) para que los números de cada
  // fila y la media cuadren con lo que ve en pantalla.
  const deviation =
    consensus && myRanking ? computeDeviation(myRanking.positions, consensus.ranking) : null;
  const diffByTeam = new Map<string, DeviationEntry>(
    deviation?.perTeam.map((e) => [e.teamAbbr, e]) ?? [],
  );
  const exactHits = deviation?.perTeam.filter((e) => e.diff === 0).length ?? 0;
  const { overrated, underrated } = topOverratedUnderrated(deviation?.perTeam ?? [], 3);

  const lastUpdate = rankings.reduce<string | null>((acc, r) => {
    return !acc || new Date(r.updated_at) > new Date(acc) ? r.updated_at : acc;
  }, null);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Consensus en vivo
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">
            Power Ranking del momento
          </h1>
          <p className="mt-1 text-sm text-muted">
            {voting.name} · {rankings.length}{" "}
            {rankings.length === 1 ? "ranking" : "rankings"} contados
            {lastUpdate && ` · último voto ${dateFmt.format(new Date(lastUpdate))}`}
          </p>
        </div>
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Mi ranking
        </Link>
      </header>

      {consensus === null ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Todavía no hay ningún ranking guardado, así que aún no se puede calcular
          el consensus.
        </p>
      ) : (
        <>
          <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
            Este consensus se calcula ahora mismo con todos los rankings guardados
            (incluido el tuyo) y cambia según vota la gente. El de cada screenshot
            queda congelado en el{" "}
            <Link href="/historico" className="underline hover:text-foreground">
              histórico
            </Link>
            .
          </p>

          {deviation && (
            <section className="mb-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
                  Desviación media
                </p>
                <p className="font-mono text-2xl font-bold">
                  {fmt(deviation.meanAbsDeviation)}
                </p>
                <p className="text-[11px] text-muted">puestos frente al consensus</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
                  Clavados
                </p>
                <p className="font-mono text-2xl font-bold">{exactHits}</p>
                <p className="text-[11px] text-muted">equipos en el mismo puesto</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
                  Mayor distancia
                </p>
                <p className="font-mono text-2xl font-bold">
                  {deviation.perTeam.reduce((max, e) => Math.max(max, Math.abs(e.diff)), 0)}
                </p>
                <p className="text-[11px] text-muted">puestos en un solo equipo</p>
              </div>
            </section>
          )}

          {(overrated.length > 0 || underrated.length > 0) && (
            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DeviationColumn
                title="Donde más crees tú"
                subtitle="Los tienes muy por encima del consensus"
                entries={overrated}
                accent={voting.accent}
                variant="over"
              />
              <DeviationColumn
                title="Donde menos crees tú"
                subtitle="Los tienes muy por debajo del consensus"
                entries={underrated}
                accent={voting.accent}
                variant="under"
              />
            </section>
          )}

          <h2 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
            {deviation
              ? "Consensus 1 → 32, con tu puesto al lado"
              : "Consensus 1 → 32"}
            {latestSnapshot && ` · flechas vs ${latestSnapshot.name}`}
          </h2>

          {deviation ? (
            <ol className="space-y-2">
              {consensusPositions.map((teamAbbr, idx) => {
                const team = findTeamByAbbr(teamAbbr);
                const entry = diffByTeam.get(teamAbbr);
                return (
                  <li
                    key={teamAbbr}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div className="w-10 text-right font-mono text-lg font-bold text-muted">
                      {(idx + 1).toString().padStart(2, "0")}
                    </div>
                    {team && <TeamMark abbr={team.abbr} size={36} />}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/equipos/${teamAbbr}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {team ? `${team.location} ${team.name}` : teamAbbr}
                      </Link>
                      <p className="font-mono text-xs text-muted">
                        {entry ? `Tú #${entry.voterPos}` : teamAbbr}
                      </p>
                    </div>
                    <EvolutionBadge
                      delta={deltaByTeam.get(teamAbbr) ?? null}
                      since={latestSnapshot?.name}
                      size="sm"
                    />
                    <DiffBadge diff={entry?.diff ?? null} />
                  </li>
                );
              })}
            </ol>
          ) : (
            <RankingListView
              positions={consensusPositions}
              deltaByTeam={deltaByTeam}
              since={latestSnapshot?.name ?? null}
            />
          )}

          {user && !myRanking && (
            <p className="mt-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
              Guarda tu ranking para comparar tu Power Ranking con el consensus.
            </p>
          )}
        </>
      )}

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

/** Puestos que le saca el usuario al consensus: verde arriba, rojo abajo. */
function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) {
    return (
      <span className="min-w-11 shrink-0 rounded-md border border-border px-2 py-1 text-center font-mono text-[11px] text-muted">
        —
      </span>
    );
  }
  if (diff === 0) {
    return (
      <span
        className="min-w-11 shrink-0 rounded-md border border-border px-2 py-1 text-center font-mono text-[11px] text-muted"
        title="Lo tienes en el mismo puesto que el consensus"
      >
        =
      </span>
    );
  }
  const up = diff > 0;
  const color = up ? "#16a34a" : "#dc2626";
  const puestos = Math.abs(diff) === 1 ? "puesto" : "puestos";
  const label = up
    ? `Lo tienes ${Math.abs(diff)} ${puestos} por encima del consensus`
    : `Lo tienes ${Math.abs(diff)} ${puestos} por debajo del consensus`;
  return (
    <span
      className="min-w-11 shrink-0 rounded-md border px-2 py-1 text-center font-mono text-[11px] font-bold"
      style={{ borderColor: color, color }}
      title={label}
      aria-label={label}
    >
      {up ? "+" : "−"}
      {Math.abs(diff)}
    </span>
  );
}

function DeviationColumn({
  title,
  subtitle,
  entries,
  accent,
  variant,
}: {
  title: string;
  subtitle: string;
  entries: DeviationEntry[];
  accent: string;
  variant: "over" | "under";
}) {
  if (entries.length === 0) return null;
  const color = variant === "over" ? "#16a34a" : "#dc2626";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <h3
        className="font-subhead text-xs uppercase tracking-wide"
        style={{ color: accent }}
      >
        {title}
      </h3>
      <p className="mb-2 text-[11px] text-muted">{subtitle}</p>
      <ul className="space-y-2">
        {entries.map((entry) => {
          const team = findTeamByAbbr(entry.teamAbbr);
          return (
            <li
              key={entry.teamAbbr}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-2"
            >
              {team && <TeamMark abbr={team.abbr} size={32} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {team ? `${team.location} ${team.name}` : entry.teamAbbr}
                </p>
                <p className="text-[11px] text-muted">
                  Tú #{entry.voterPos} · Consensus #{entry.consensusPos}
                </p>
              </div>
              <span
                className="shrink-0 rounded-md border px-2 py-1 font-mono text-[11px] font-bold"
                style={{ borderColor: color, color }}
              >
                Δ {entry.diff > 0 ? "+" : "−"}
                {Math.abs(entry.diff)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
