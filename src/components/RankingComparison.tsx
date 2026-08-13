import Link from "next/link";
import { findTeamByAbbr } from "@/data/teams";
import {
  topOverratedUnderrated,
  type DeviationEntry,
  type DeviationResult,
} from "@/lib/ranking-deviation";
import { TeamMark } from "./TeamMark";
import { EvolutionBadge } from "./EvolutionBadge";
import { RankingListView } from "./RankingListView";

const fmt = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Cómo se nombra el ranking que se pinta en la lista. Se pasa ya redactado
 * porque en español cambia la preposición: "del consensus" pero "de Marcos".
 */
export type ComparisonReference = {
  /** Encabezado de la lista: "Consensus", "Ranking de Marcos". */
  title: string;
  /** Nombre corto junto a cada puesto: "Consensus #12", "Marcos #12". */
  name: string;
  /** Completa "por encima …": "del consensus", "de Marcos". */
  de: string;
  /** Completa "puestos frente …": "al consensus", "a Marcos". */
  a: string;
};

type Props = {
  /** Ranking de referencia, de la posición 1 a la 32: el que se pinta. */
  positions: string[];
  reference: ComparisonReference;
  /** Puestos que gana cada equipo en ese ranking respecto a la foto anterior. */
  deltaByTeam: Map<string, number | null>;
  /** Nombre de la foto con la que se comparan las flechas. */
  since: string | null;
  /** Tu ranking frente al de referencia; null si no hay con qué comparar. */
  deviation: DeviationResult | null;
  /**
   * Desviación media a destacar. En el consensus en vivo se pasa la versión
   * "leave one out"; si no se pasa nada se usa la de `deviation`.
   */
  meanDeviation?: number | null;
  accent: string;
};

/**
 * Un ranking 1 → 32 con tus puestos al lado: desviación media, clavados,
 * mayor distancia, los equipos en los que más te separas y la lista completa
 * con flechas de evolución. Lo comparten `/consenso` (donde la referencia es
 * el consensus) y `/usuarios/[userId]` (donde es el ranking de otro usuario).
 */
export function RankingComparison({
  positions,
  reference,
  deltaByTeam,
  since,
  deviation,
  meanDeviation,
  accent,
}: Props) {
  const exactHits = deviation?.perTeam.filter((e) => e.diff === 0).length ?? 0;
  const { overrated, underrated } = topOverratedUnderrated(deviation?.perTeam ?? [], 3);
  const diffByTeam = new Map<string, DeviationEntry>(
    deviation?.perTeam.map((e) => [e.teamAbbr, e]) ?? [],
  );

  return (
    <>
      {deviation && (
        <section className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
              Desviación media
            </p>
            <p className="font-mono text-2xl font-bold">
              {fmt(meanDeviation ?? deviation.meanAbsDeviation)}
            </p>
            <p className="text-[11px] text-muted">puestos frente {reference.a}</p>
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
            subtitle={`Los tienes muy por encima ${reference.de}`}
            entries={overrated}
            accent={accent}
            variant="over"
            reference={reference}
          />
          <DeviationColumn
            title="Donde menos crees tú"
            subtitle={`Los tienes muy por debajo ${reference.de}`}
            entries={underrated}
            accent={accent}
            variant="under"
            reference={reference}
          />
        </section>
      )}

      <h2 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
        {reference.title} 1 → 32
        {deviation && ", con tu puesto al lado"}
        {since && ` · flechas vs ${since}`}
      </h2>

      {deviation ? (
        <ol className="space-y-2">
          {positions.map((teamAbbr, idx) => {
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
                  since={since ?? undefined}
                  size="sm"
                />
                <DiffBadge diff={entry?.diff ?? null} reference={reference} />
              </li>
            );
          })}
        </ol>
      ) : (
        <RankingListView positions={positions} deltaByTeam={deltaByTeam} since={since} />
      )}
    </>
  );
}

/** Puestos que le sacas al ranking de referencia: verde arriba, rojo abajo. */
function DiffBadge({
  diff,
  reference,
}: {
  diff: number | null;
  reference: ComparisonReference;
}) {
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
        title={`Lo tienes en el mismo puesto ${reference.de}`}
      >
        =
      </span>
    );
  }
  const up = diff > 0;
  const color = up ? "#16a34a" : "#dc2626";
  const puestos = Math.abs(diff) === 1 ? "puesto" : "puestos";
  const label = up
    ? `Lo tienes ${Math.abs(diff)} ${puestos} por encima ${reference.de}`
    : `Lo tienes ${Math.abs(diff)} ${puestos} por debajo ${reference.de}`;
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
  reference,
}: {
  title: string;
  subtitle: string;
  entries: DeviationEntry[];
  accent: string;
  variant: "over" | "under";
  reference: ComparisonReference;
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
                  Tú #{entry.voterPos} · {reference.name} #{entry.consensusPos}
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
