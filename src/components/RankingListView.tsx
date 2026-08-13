import Link from "next/link";
import { findTeamByAbbr } from "@/data/teams";
import { TeamMark } from "./TeamMark";
import { EvolutionBadge } from "./EvolutionBadge";

type Props = {
  positions: string[];
  /** Puestos ganados por equipo respecto a la foto anterior. */
  deltaByTeam?: Map<string, number | null> | null;
  since?: string | null;
  /** Enlaza cada equipo con su ficha de evolución. */
  linkTeams?: boolean;
};

/** Lista 1→32 con la flecha de evolución a la derecha de cada equipo. */
export function RankingListView({
  positions,
  deltaByTeam,
  since,
  linkTeams = true,
}: Props) {
  return (
    <ol className="space-y-2">
      {positions.map((teamAbbr, idx) => {
        const team = findTeamByAbbr(teamAbbr);
        const label = team ? `${team.location} ${team.name}` : teamAbbr;
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
              {linkTeams ? (
                <Link href={`/equipos/${teamAbbr}`} className="truncate font-semibold hover:underline">
                  {label}
                </Link>
              ) : (
                <p className="truncate font-semibold">{label}</p>
              )}
              <p className="font-mono text-xs text-muted">{teamAbbr}</p>
            </div>
            <EvolutionBadge
              delta={deltaByTeam?.get(teamAbbr) ?? null}
              since={since ?? undefined}
            />
          </li>
        );
      })}
    </ol>
  );
}
