import Link from "next/link";
import { notFound } from "next/navigation";
import { getRankingsByVoting, getVoting, listSnapshots } from "@/lib/db/client";
import { findTeamByAbbr, TOTAL_TEAMS } from "@/data/teams";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { teamPositionHistory } from "@/lib/ranking-evolution";
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

