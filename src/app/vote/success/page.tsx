import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLatestSnapshotEntryByEmail,
  getRankingWithPreviousById,
  getVoting,
} from "@/lib/db/client";
import { findTeamByAbbr } from "@/data/teams";
import { computeEvolution, topMovers } from "@/lib/ranking-evolution";
import { EvolutionBadge } from "@/components/EvolutionBadge";
import { TeamMark } from "@/components/TeamMark";
import { RankingVideoExport } from "@/components/RankingVideoExport";
import { ShareActions } from "./ShareActions";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const shortDateFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });

type Search = Promise<{ id?: string }>;

export default async function SuccessPage({ searchParams }: { searchParams: Search }) {
  const { id } = await searchParams;
  if (!id) notFound();
  const voting = await getVoting();
  if (!voting) notFound();
  const ranking = await getRankingWithPreviousById(id);
  if (!ranking || ranking.voting !== voting.id) notFound();

  const previous = await getLatestSnapshotEntryByEmail(ranking.email, ranking.voting);
  const evolutions = computeEvolution(ranking.positions, previous?.positions ?? null);
  const { risers, fallers } = topMovers(evolutions, 3);

  // La imagen cambia al reenviar el ranking y también al crear un screenshot
  // nuevo (cambian las flechas): ambas cosas entran en la URL.
  const version = `${new Date(ranking.updated_at).getTime()}-${previous?.snapshot_id ?? "0"}`;
  const imageUrl = `/api/rankings/${id}/image?v=${version}`;

  // Punto de partida del vídeo: la versión anterior de su propio ranking y,
  // si es la primera vez que lo reordena, su ranking del último screenshot.
  const videoFrom = ranking.previous_positions ?? previous?.positions ?? null;
  const videoFromLabel = ranking.previous_positions
    ? `Tu ranking del ${shortDateFmt.format(
        new Date(ranking.previous_saved_at ?? ranking.created_at),
      )}`
    : previous
      ? previous.snapshot_name
      : "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-5 py-10">
      <header className="mb-6 text-center">
        <p
          className="font-subhead text-xs uppercase tracking-[0.25em]"
          style={{ color: voting.accent }}
        >
          Ranking guardado
        </p>
        <h1 className="font-display mt-2 text-4xl uppercase leading-tight">
          ¡Listo, {ranking.full_name.split(" ")[0]}!
        </h1>
        <p className="mt-2 text-sm text-muted">
          {previous
            ? `Tu top 32 está guardado. Las flechas comparan con ${previous.snapshot_name}.`
            : "Tu top 32 está guardado. Descarga la imagen y compártela."}
        </p>
      </header>

      {(risers.length > 0 || fallers.length > 0) && (
        <section className="mb-6 w-full rounded-2xl border border-border bg-surface p-3">
          <h2 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
            Tus mayores movimientos
          </h2>
          <ul className="space-y-2">
            {[...risers, ...fallers].map((evolution) => {
              const team = findTeamByAbbr(evolution.teamAbbr);
              return (
                <li key={evolution.teamAbbr} className="flex items-center gap-2 text-sm">
                  {team && <TeamMark abbr={team.abbr} size={28} />}
                  <span className="min-w-0 flex-1 truncate">
                    {team ? `${team.location} ${team.name}` : evolution.teamAbbr}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    #{evolution.previousPosition} → #{evolution.position}
                  </span>
                  <EvolutionBadge
                    delta={evolution.delta}
                    since={previous?.snapshot_name}
                    size="sm"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="w-full overflow-hidden rounded-2xl border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`Ranking de ${ranking.full_name}`}
          className="block w-full"
          loading="eager"
        />
      </div>

      <ShareActions imageUrl={imageUrl} fullName={ranking.full_name} votingName={voting.name} />

      {videoFrom && (
        <RankingVideoExport
          fromPositions={videoFrom}
          toPositions={ranking.positions}
          accent={voting.accent}
          logoUrl={voting.logo_url}
          copy={{
            eyebrow: `${voting.name} · 2026`,
            title: `Ranking de ${ranking.full_name}`,
            fromLabel: videoFromLabel,
            toLabel: shortDateFmt.format(new Date(ranking.updated_at)),
            footerLeft: `Evolución vs ${videoFromLabel}`,
            footerRight: voting.name,
            logoFallback: voting.short_name,
          }}
          fileBase={`video-${voting.slug}-${slugify(ranking.full_name)}`}
          shareText={`Cómo ha cambiado mi top 32 de la NFL 2026 · ${voting.name}`}
        />
      )}

      <nav className="mt-8 flex flex-wrap justify-center gap-2">
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Volver a la página principal
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
