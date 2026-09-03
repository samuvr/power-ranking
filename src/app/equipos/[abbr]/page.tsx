import Link from "next/link";
import { notFound } from "next/navigation";
import { getRankingsByVoting, getVoting, listSnapshots } from "@/lib/db/client";
import { findTeamByAbbr, TOTAL_TEAMS } from "@/data/teams";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { teamPositionHistory } from "@/lib/ranking-evolution";
import {
  computeDispersion,
  dispersionByTeam,
  positionHistogram,
  type TeamDispersion,
} from "@/lib/ranking-dispersion";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";

export const dynamic = "force-dynamic";

type Params = Promise<{ abbr: string }>;

type Point = { label: string; position: number; href: string | null };

export default async function TeamPage({ params }: { params: Params }) {
  const { abbr } = await params;
  const teamAbbr = abbr.toUpperCase();
  const team = findTeamByAbbr(teamAbbr);
  if (!team) notFound();

  const voting = await getVoting();
  if (!voting) notFound();

  const [snapshots, rows] = await Promise.all([
    listSnapshots(voting.id),
    getRankingsByVoting(voting.id),
  ]);

  // listSnapshots viene del más reciente al más antiguo: la serie se dibuja al revés.
  const chronological = [...snapshots].reverse().map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: new Date(s.created_at).toISOString(),
    consensus: s.consensus,
  }));

  const history = teamPositionHistory(chronological, teamAbbr);
  const points: Point[] = history.map((h) => ({
    label: h.name,
    position: h.position,
    href: `/historico/${h.id}`,
  }));

  // Cuánto os separa AHORA sobre este equipo: no es la historia del consensus,
  // es el desacuerdo entre los votos guardados en este momento.
  const allPositions = rows.map((r) => r.positions);
  const dispersion: TeamDispersion | null =
    rows.length > 0
      ? (dispersionByTeam(computeDispersion(allPositions)).get(teamAbbr) ?? null)
      : null;
  const histogram = rows.length > 0 ? positionHistogram(allPositions, teamAbbr) : [];

  // Puesto en el consensus vivo, para cerrar la serie con el "ahora".
  let currentPosition: number | null = null;
  if (rows.length > 0) {
    const { ranking } = computeGlobalRanking(rows.map((r) => r.positions));
    currentPosition =
      ranking.find((entry) => entry.teamAbbr === teamAbbr)?.finalPosition ?? null;
    if (currentPosition !== null) {
      points.push({ label: "Ahora", position: currentPosition, href: null });
    }
  }

  const best = points.length > 0 ? Math.min(...points.map((p) => p.position)) : null;
  const worst = points.length > 0 ? Math.max(...points.map((p) => p.position)) : null;
  const delta =
    points.length >= 2
      ? points[points.length - 2].position - points[points.length - 1].position
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamMark abbr={team.abbr} size={56} />
          <div>
            <p
              className="font-subhead text-xs uppercase tracking-[0.25em]"
              style={{ color: voting.accent }}
            >
              Evolución en el consensus
            </p>
            <h1 className="font-display text-4xl uppercase leading-tight">
              {team.location} {team.name}
            </h1>
          </div>
        </div>
        <Link
          href="/historico"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Screenshots
        </Link>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ahora" value={currentPosition === null ? "—" : `#${currentPosition}`} />
        <Stat label="Mejor puesto" value={best === null ? "—" : `#${best}`} />
        <Stat label="Peor puesto" value={worst === null ? "—" : `#${worst}`} />
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
            Último cambio
          </p>
          <div className="mt-1">
            {delta === null ? (
              <span className="font-mono text-2xl font-bold">—</span>
            ) : (
              <EvolutionBadge delta={delta} />
            )}
          </div>
        </div>
      </section>

      {points.length < 2 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Todavía no hay suficientes screenshots para dibujar la evolución de este
          equipo.
        </p>
      ) : (
        <PositionChart points={points} accent={voting.accent} />
      )}

      {dispersion && (
        <section className="mt-8">
          <h2 className="font-subhead mb-1 text-[11px] uppercase tracking-wide text-muted">
            Cuánto os separa ahora mismo
          </h2>
          <p className="mb-3 text-[11px] text-muted">
            Dónde coloca cada uno a este equipo en su ranking guardado. Dos equipos
            pueden acabar en el mismo puesto del consensus siendo uno indiscutible
            y el otro una pelea.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Puesto más alto" value={`#${dispersion.best}`} />
            <Stat label="Puesto más bajo" value={`#${dispersion.worst}`} />
            <Stat label="Media" value={fmtNumber(dispersion.mean)} />
            <Stat label="Dispersión" value={fmtNumber(dispersion.stdDev)} />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {dispersion.spread === 0
              ? `Los ${dispersion.votes} votos lo ponen exactamente en el mismo puesto.`
              : `${dispersion.spread} ${
                  dispersion.spread === 1 ? "puesto separa" : "puestos separan"
                } al más y al menos entusiasta, sobre ${dispersion.votes} ${
                  dispersion.votes === 1 ? "voto" : "votos"
                }.`}
          </p>
          <DispersionHistogram bins={histogram} accent={voting.accent} />
        </section>
      )}

      {points.length > 0 && (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {[...points].reverse().map((point, idx) => (
            <li
              key={`${point.label}-${idx}`}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              {point.href ? (
                <Link href={point.href} className="truncate hover:underline">
                  {point.label}
                </Link>
              ) : (
                <span className="truncate font-semibold">{point.label}</span>
              )}
              <span className="font-mono font-bold">#{point.position}</span>
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-8">
        <Link
          href="/equipos"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Ver todos los equipos
        </Link>
      </nav>
    </main>
  );
}

const fmtNumber = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}

/**
 * Línea del puesto a lo largo del tiempo. Eje Y invertido: el puesto 1 arriba.
 * SVG plano, sin dependencias de gráficas.
 */
function PositionChart({ points, accent }: { points: Point[]; accent: string }) {
  const W = 640;
  const H = 260;
  const PAD_X = 34;
  const PAD_Y = 24;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const x = (i: number) =>
    points.length === 1 ? W / 2 : PAD_X + (innerW * i) / (points.length - 1);
  const y = (pos: number) => PAD_Y + (innerH * (pos - 1)) / (TOTAL_TEAMS - 1);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.position)}`).join(" ");

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[420px]"
        role="img"
        aria-label="Evolución del puesto en el consensus"
      >
        {[1, 8, 16, 24, 32].map((pos) => (
          <g key={pos}>
            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y(pos)}
              y2={y(pos)}
              stroke="currentColor"
              strokeOpacity={0.12}
            />
            <text x={4} y={y(pos) + 4} fontSize={11} fill="currentColor" fillOpacity={0.5}>
              {pos}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke={accent} strokeWidth={3} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <circle cx={x(i)} cy={y(p.position)} r={5} fill={accent} />
            <text
              x={x(i)}
              y={H - 4}
              fontSize={11}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.6}
            >
              {p.label.length > 10 ? `${p.label.slice(0, 9)}…` : p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}


/**
 * Reparto de los votos por tramos de puestos. Barras proporcionales al tramo
 * más votado; sin escala numérica, solo la forma (¿una punta o dos?).
 */
function DispersionHistogram({
  bins,
  accent,
}: {
  bins: Array<{ from: number; to: number; count: number }>;
  accent: string;
}) {
  const max = Math.max(...bins.map((b) => b.count), 0);
  if (max === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface p-3">
      <div className="flex h-28 items-end gap-1">
        {bins.map((bin) => (
          <div key={bin.from} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[10px] text-muted">
              {bin.count > 0 ? bin.count : ""}
            </span>
            <div
              className="w-full rounded-t"
              style={{
                // Un voto solo nunca queda como una raya invisible.
                height: `${Math.max(4, (bin.count / max) * 100)}%`,
                backgroundColor: bin.count > 0 ? accent : "transparent",
                opacity: bin.count > 0 ? 1 : 0.15,
                border: bin.count > 0 ? "none" : "1px dashed currentColor",
              }}
            />
            <span className="font-mono text-[9px] text-muted">
              {bin.from}-{bin.to}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-muted">
        Votos por tramo de puesto
      </p>
    </div>
  );
}
