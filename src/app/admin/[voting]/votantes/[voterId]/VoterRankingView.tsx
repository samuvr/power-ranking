"use client";

import Link from "next/link";
import { findTeamByAbbr } from "@/data/teams";
import { TeamMark } from "@/components/TeamMark";
import type { VotingPublic } from "@/lib/db/client";
import type { DeviationEntry, DeviationResult } from "@/lib/ranking-deviation";
import { topOverratedUnderrated } from "@/lib/ranking-deviation";
import { ShareActions } from "@/app/vote/[voting]/success/ShareActions";

type Voter = {
  id: string;
  fullName: string;
  email: string;
  positions: string[];
  updatedAt: string;
};

type Props = {
  voting: VotingPublic;
  voter: Voter;
  deviation: DeviationResult;
};

export function VoterRankingView({ voting, voter, deviation }: Props) {
  const diffByTeam = new Map<string, DeviationEntry>();
  for (const entry of deviation.perTeam) diffByTeam.set(entry.teamAbbr, entry);

  const { overrated, underrated } = topOverratedUnderrated(deviation.perTeam, 3);

  const version = new Date(voter.updatedAt).getTime();
  const imageUrl = `/api/admin/voters/${voter.id}/image?v=${version}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Ranking del votante
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">
            {voter.fullName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {voting.name} ·{" "}
            <span
              className="cursor-help underline decoration-dotted underline-offset-2"
              title="Desviación media respecto al consenso calculado sin el voto de este votante (leave-one-out), para que su voto no se compare consigo mismo."
            >
              Desviación media
            </span>
            :{" "}
            <span className="font-mono font-bold text-foreground">
              {deviation.meanAbsDeviation.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        </div>
        <Link
          href={`/admin/${voting.slug}`}
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Volver
        </Link>
      </header>

      <ol className="space-y-2">
        {voter.positions.map((teamAbbr, idx) => {
          const team = findTeamByAbbr(teamAbbr);
          const entry = diffByTeam.get(teamAbbr);
          const diff = entry?.diff ?? 0;
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
                <p className="truncate font-semibold">
                  {team ? `${team.location} ${team.name}` : teamAbbr}
                </p>
                <p className="text-xs text-muted">{team?.abbr}</p>
              </div>
              <DiffBadge diff={diff} hasConsensus={entry !== undefined} />
            </li>
          );
        })}
      </ol>

      <ShareActions
        imageUrl={imageUrl}
        fullName={voter.fullName}
        votingName={voting.name}
      />

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DeviationColumn
          title="Más sobrevalorados"
          entries={overrated}
          emptyLabel="Sin desviaciones positivas"
          accent={voting.accent}
          variant="over"
        />
        <DeviationColumn
          title="Más infravalorados"
          entries={underrated}
          emptyLabel="Sin desviaciones negativas"
          accent={voting.accent}
          variant="under"
        />
      </section>
    </main>
  );
}

function DiffBadge({
  diff,
  hasConsensus,
}: {
  diff: number;
  hasConsensus: boolean;
}) {
  if (!hasConsensus) {
    return (
      <span className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted">
        —
      </span>
    );
  }
  if (diff === 0) {
    return (
      <span className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted">
        =
      </span>
    );
  }
  const sign = diff > 0 ? "+" : "−";
  const color = diff > 0 ? "#16a34a" : "#dc2626";
  return (
    <span
      className="rounded-md border px-2 py-1 font-mono text-[11px] font-bold"
      style={{ borderColor: color, color }}
      title={
        diff > 0
          ? `Sobrevalorado por el votante (${Math.abs(diff)} puestos por encima del consenso)`
          : `Infravalorado por el votante (${Math.abs(diff)} puestos por debajo del consenso)`
      }
    >
      {sign}
      {Math.abs(diff)}
    </span>
  );
}

function DeviationColumn({
  title,
  entries,
  emptyLabel,
  accent,
  variant,
}: {
  title: string;
  entries: DeviationEntry[];
  emptyLabel: string;
  accent: string;
  variant: "over" | "under";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <h3
        className="font-subhead mb-2 text-xs uppercase tracking-wide"
        style={{ color: accent }}
      >
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const team = findTeamByAbbr(entry.teamAbbr);
            const sign = entry.diff > 0 ? "+" : "−";
            const color = variant === "over" ? "#16a34a" : "#dc2626";
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
                    Votante #{entry.voterPos} · Consenso #{entry.consensusPos}
                  </p>
                </div>
                <span
                  className="rounded-md border px-2 py-1 font-mono text-[11px] font-bold"
                  style={{ borderColor: color, color }}
                >
                  Δ {sign}
                  {Math.abs(entry.diff)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
