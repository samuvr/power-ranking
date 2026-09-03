import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRankingsByVoting, getVoting } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { computeDeviationVsPositions } from "@/lib/ranking-deviation";
import { CURRENT_SEASON } from "@/lib/nfl-results";
import { getSeasonStandings } from "@/lib/nfl-standings";
import { findTeamByAbbr } from "@/data/teams";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";

export const dynamic = "force-dynamic";

const dateTimeFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const fmt2 = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Porcentaje al estilo NFL: .824 en vez de 0.824.
const fmtPct = (n: number) => n.toFixed(3).replace(/^0\./, ".");

/**
 * Realidad contra opinión: la clasificación real de la temporada enfrentada al
 * consensus y a cada ranking guardado.
 *
 * Es la única página que compara con algo externo a la comunidad. Mientras no
 * se haya jugado ningún partido no hay nada que comparar y se dice tal cual,
 * en vez de enseñar una tabla de ceros.
 */
export default async function RealidadPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user && !(await isAdminAuthenticated())) redirect("/");

  const [rows, standings] = await Promise.all([
    getRankingsByVoting(voting.id),
    getSeasonStandings(CURRENT_SEASON),
  ]);

  const consensusPositions =
    rows.length > 0
      ? computeGlobalRanking(rows.map((r) => r.positions)).ranking.map((e) => e.teamAbbr)
      : [];

  const hasResults = standings !== null && standings.played > 0;

  // Puesto real de cada equipo, para enfrentarlo al del consensus.
  const realPosByTeam = new Map<string, number>(
    (standings?.order ?? []).map((abbr, idx) => [abbr, idx + 1]),
  );
  const consensusPosByTeam = new Map<string, number>(
    consensusPositions.map((abbr, idx) => [abbr, idx + 1]),
  );

  // Quién va acertando: desviación media de cada ranking guardado respecto a
  // la clasificación real. Menos es mejor.
  const leaderboard = hasResults
    ? rows
        .map((r) => ({
          id: r.id,
          userId: r.user_id,
          name: r.full_name,
          isMe: user ? r.user_id === user.id : false,
          deviation: computeDeviationVsPositions(r.positions, standings.order)
            .meanAbsDeviation,
        }))
        .sort((a, b) => a.deviation - b.deviation || a.name.localeCompare(b.name))
    : [];

  // El consensus como un votante más: ¿acierta el grupo más que sus miembros?
  const consensusDeviation =
    hasResults && consensusPositions.length > 0
      ? computeDeviationVsPositions(consensusPositions, standings.order).meanAbsDeviation
      : null;
  const consensusRank =
    consensusDeviation === null
      ? null
      : leaderboard.filter((v) => v.deviation < consensusDeviation).length + 1;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Realidad
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">
            Lo que dice el campo
          </h1>
          <p className="mt-1 text-sm text-muted">
            Clasificación real de la temporada {CURRENT_SEASON}
            {standings && ` · ${standings.played} partidos jugados`}
            {standings && ` · datos de ${dateTimeFmt.format(new Date(standings.fetchedAt))}`}
          </p>
        </div>
        <Link
          href="/consenso"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Consensus
        </Link>
      </header>

      {standings === null ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No se han podido cargar los resultados ahora mismo. Se vuelven a
          intentar automáticamente; prueba a recargar en un rato.
        </p>
      ) : !hasResults ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          La temporada {CURRENT_SEASON} todavía no ha empezado: no hay ningún
          partido jugado con el que comparar vuestros rankings. Esta página se
          llena sola en cuanto ruede el balón.
        </p>
      ) : (
        <>
          <p className="mb-6 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
            La clasificación ordena por porcentaje de victorias y desempata por
            diferencia de puntos. Los datos vienen de{" "}
            <a
              href="https://github.com/nflverse/nfldata"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              nflverse
            </a>{" "}
            y se refrescan como mucho una vez por hora.
          </p>

          {leaderboard.length > 0 && (
            <section className="mb-8">
              <h2 className="font-subhead mb-1 text-[11px] uppercase tracking-wide text-muted">
                Quién va acertando
              </h2>
              <p className="mb-3 text-[11px] text-muted">
                Puestos de diferencia, de media, entre tu ranking guardado y la
                clasificación real. Menos es mejor.
              </p>
              <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {leaderboard.map((voter, idx) => (
                  <li
                    key={voter.id}
                    className={`flex items-center gap-3 px-3 py-2 text-sm ${
                      voter.isMe ? "bg-surface-2 font-semibold" : ""
                    }`}
                  >
                    <span className="w-6 text-right font-mono text-xs text-muted">
                      {idx + 1}
                    </span>
                    {voter.userId ? (
                      <Link
                        href={`/usuarios/${voter.userId}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {voter.name}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{voter.name}</span>
                    )}
                    <span className="font-mono font-bold">{fmt2(voter.deviation)}</span>
                  </li>
                ))}
              </ol>
              {consensusDeviation !== null && (
                <p className="mt-2 text-[11px] text-muted">
                  El consensus se desvía <strong>{fmt2(consensusDeviation)}</strong>{" "}
                  puestos: quedaría {consensusRank}º de {leaderboard.length + 1}.
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="font-subhead mb-1 text-[11px] uppercase tracking-wide text-muted">
              Clasificación real vs. consensus
            </h2>
            <p className="mb-3 text-[11px] text-muted">
              La flecha compara el puesto en el consensus con el que le está dando
              el campo: verde = el equipo va mejor de lo que le teníais.
            </p>
            <ol className="space-y-2">
              {standings.records.map((record, idx) => {
                const team = findTeamByAbbr(record.teamAbbr);
                const consensusPos = consensusPosByTeam.get(record.teamAbbr) ?? null;
                const realPos = realPosByTeam.get(record.teamAbbr) ?? idx + 1;
                return (
                  <li
                    key={record.teamAbbr}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div className="w-8 text-right font-mono text-lg font-bold text-muted">
                      {realPos.toString().padStart(2, "0")}
                    </div>
                    <TeamMark abbr={record.teamAbbr} size={32} />
                    <Link
                      href={`/equipos/${record.teamAbbr}`}
                      className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
                    >
                      {team ? `${team.location} ${team.name}` : record.teamAbbr}
                    </Link>
                    <span className="font-mono text-xs text-muted">
                      {record.wins}-{record.losses}
                      {record.ties > 0 ? `-${record.ties}` : ""}
                    </span>
                    <span className="hidden w-12 text-right font-mono text-xs text-muted sm:inline">
                      {fmtPct(record.winPct)}
                    </span>
                    <span className="hidden w-12 text-right font-mono text-xs text-muted sm:inline">
                      {record.pointDiff > 0 ? "+" : ""}
                      {record.pointDiff}
                    </span>
                    {consensusPos === null ? (
                      <span className="w-11 text-center font-mono text-xs text-muted">—</span>
                    ) : (
                      <EvolutionBadge
                        delta={consensusPos - realPos}
                        since={`el consensus (#${consensusPos})`}
                        size="sm"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
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
          href="/equipos"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Ver equipos
        </Link>
      </nav>
    </main>
  );
}
