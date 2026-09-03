import Link from "next/link";
import { notFound } from "next/navigation";
import { getLatestSnapshot, getRankingsByVoting, getVoting } from "@/lib/db/client";
import { findTeamByAbbr, getAllTeams } from "@/data/teams";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { computeEvolution } from "@/lib/ranking-evolution";
import {
  computeDispersion,
  mostAgreed,
  mostDivisive,
  type TeamDispersion,
} from "@/lib/ranking-dispersion";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";

export const dynamic = "force-dynamic";

export default async function EquiposPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const [rows, latest] = await Promise.all([
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
  ]);

  const positions =
    rows.length > 0
      ? [...computeGlobalRanking(rows.map((r) => r.positions)).ranking]
          .sort((a, b) => a.finalPosition - b.finalPosition)
          .map((e) => e.teamAbbr)
      : getAllTeams().map((t) => t.abbr);

  const deltaByTeam = new Map(
    computeEvolution(positions, latest?.consensus ?? null).map((e) => [e.teamAbbr, e.delta]),
  );

  // Con un solo ranking guardado no hay desacuerdo que enseñar: todo saldría
  // con dispersión 0 y la sección no diría nada.
  const dispersion = rows.length > 1 ? computeDispersion(rows.map((r) => r.positions)) : [];
  const divisive = mostDivisive(dispersion, 3);
  const agreed = mostAgreed(dispersion, 3);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            {rows.length > 0 ? "Consensus actual" : "Equipos"}
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">Equipos</h1>
          <p className="mt-1 text-sm text-muted">
            Entra en cualquier equipo para ver su evolución screenshot a screenshot.
          </p>
        </div>
        <Link
          href="/historico"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Screenshots
        </Link>
      </header>

      {divisive.length > 0 && (
        <section className="mb-8 grid gap-3 sm:grid-cols-2">
          <DispersionCard
            title="Los más polémicos"
            hint="Los que más os separan: mucha distancia entre el que más y el que menos cree en ellos."
            teams={divisive}
            accent={voting.accent}
          />
          <DispersionCard
            title="En los que estáis de acuerdo"
            hint="Casi todos los colocáis en el mismo sitio."
            teams={agreed}
            accent={voting.accent}
          />
        </section>
      )}

      <ol className="space-y-2">
        {positions.map((abbr, idx) => {
          const team = findTeamByAbbr(abbr);
          return (
            <li
              key={abbr}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
            >
              <div className="w-10 text-right font-mono text-lg font-bold text-muted">
                {(idx + 1).toString().padStart(2, "0")}
              </div>
              {team && <TeamMark abbr={team.abbr} size={36} />}
              <Link href={`/equipos/${abbr}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                {team ? `${team.location} ${team.name}` : abbr}
              </Link>
              <EvolutionBadge delta={deltaByTeam.get(abbr) ?? null} since={latest?.name} />
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/**
 * Los extremos del desacuerdo. Se enseña el recorrido (del mejor al peor
 * puesto que ha recibido) porque se lee de un vistazo mucho mejor que la
 * desviación típica, que es lo que en realidad ordena la lista.
 */
function DispersionCard({
  title,
  hint,
  teams,
  accent,
}: {
  title: string;
  hint: string;
  teams: TeamDispersion[];
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p
        className="font-subhead text-[11px] uppercase tracking-wide"
        style={{ color: accent }}
      >
        {title}
      </p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
      <ul className="mt-3 space-y-2">
        {teams.map((t) => {
          const team = findTeamByAbbr(t.teamAbbr);
          return (
            <li key={t.teamAbbr} className="flex items-center gap-2">
              <TeamMark abbr={t.teamAbbr} size={24} />
              <Link
                href={`/equipos/${t.teamAbbr}`}
                className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
              >
                {team ? team.name : t.teamAbbr}
              </Link>
              <span className="font-mono text-xs text-muted">
                #{t.best}–#{t.worst}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
