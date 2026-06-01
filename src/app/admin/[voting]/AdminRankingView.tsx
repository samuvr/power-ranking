"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getQbById } from "@/data/qbs";
import { getTeamByAbbr } from "@/data/teams";
import { computeAnyaRanking } from "@/data/anya";
import { TeamMark } from "@/components/TeamMark";
import type { VotingPublic } from "@/lib/db/client";
import type { GlobalRankingResult } from "@/lib/ranking-algorithm";

type Mode = "list" | "stream";

type Voter = {
  id: string;
  fullName: string;
  email: string;
  updatedAt: string;
  meanDeviation: number;
  rankPosition: number;
};

type Props = {
  voting: VotingPublic;
  result: GlobalRankingResult;
  initialMode: Mode;
  initialRound: number;
  voters: Voter[];
};

export function AdminRankingView({
  voting,
  result,
  initialMode,
  initialRound,
  voters,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [round, setRound] = useState(initialRound);
  const [showAnya, setShowAnya] = useState(false);

  const totalRounds = result.rounds.length;

  const syncUrl = useCallback(
    (m: Mode, r: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (m === "stream") {
        params.set("mode", "stream");
        params.set("round", String(r));
      } else {
        params.delete("mode");
        params.delete("round");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setModeAndSync = (m: Mode) => {
    setMode(m);
    syncUrl(m, round);
  };
  const setRoundAndSync = (r: number) => {
    setRound(r);
    syncUrl(mode, r);
  };

  // Teclado: flechas izquierda/derecha en modo stream
  useEffect(() => {
    if (mode !== "stream") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && round > 0) setRoundAndSync(round - 1);
      if (e.key === "ArrowRight" && round < totalRounds - 1) setRoundAndSync(round + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, round, totalRounds]);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "list"}
          onClick={() => setModeAndSync("list")}
          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
            mode === "list" ? "bg-surface-2 text-foreground" : "text-muted"
          }`}
        >
          Lista completa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "stream"}
          onClick={() => setModeAndSync("stream")}
          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
            mode === "stream" ? "bg-surface-2 text-foreground" : "text-muted"
          }`}
        >
          Stream por fases
        </button>
      </div>

      <ExportActions slug={voting.slug} totalRounds={totalRounds} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showAnya}
          onChange={(e) => setShowAnya(e.target.checked)}
        />
        <span>Comparar con ANY/A (Últimas 3 temporadas)</span>
        <span
          className="cursor-help text-muted"
          tabIndex={0}
          title="Yardas netas ajustadas por intento de pase es una estadística avanzada que mide la eficiencia de un QB teniendo en cuenta yardas de pase, touchdowns, intercepciones y sacks en una única métrica. "
          aria-label="Yardas netas ajustadas por intento de pase es una estadística avanzada que mide la eficiencia de un QB teniendo en cuenta yardas de pase, touchdowns, intercepciones y sacks en una única métrica. "
        >
          ⓘ
        </span>
      </label>

      {mode === "list" ? (
        <RankingList result={result} showAnya={showAnya} />
      ) : (
        <RankingStream
          result={result}
          round={round}
          totalRounds={totalRounds}
          accent={voting.accent}
          showAnya={showAnya}
          onPrev={() => setRoundAndSync(Math.max(0, round - 1))}
          onNext={() => setRoundAndSync(Math.min(totalRounds - 1, round + 1))}
        />
      )}

      <section aria-label="Votantes">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
          Votantes ({voters.length}) · clasificación por desviación
        </h2>
        <p className="mb-3 text-xs text-muted">
          La desviación de cada votante se mide contra el consenso calculado{" "}
          <strong>sin su propio voto</strong> (leave-one-out), para que un voto
          extremo no se compare consigo mismo. Menor = más alineado con el resto.
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {voters.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-8 text-right font-mono text-base font-bold text-muted">
                  {v.rankPosition.toString().padStart(2, "0")}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{v.fullName}</p>
                  <p className="truncate text-muted">{v.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-mono text-sm font-bold">
                    {v.meanDeviation.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p
                    className="cursor-help text-[10px] uppercase tracking-wide text-muted"
                    title="Desviación media respecto al consenso calculado sin el voto de este votante (leave-one-out)."
                  >
                    desv. media
                  </p>
                </div>
                <Link
                  href={`/admin/${voting.slug}/votantes/${v.id}`}
                  className="font-subhead rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground"
                >
                  Ver ranking
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ExportActions({
  slug,
  totalRounds,
}: {
  slug: string;
  totalRounds: number;
}) {
  const [exportingStory, setExportingStory] = useState(false);
  const [exportingCarousel, setExportingCarousel] = useState(false);
  const [carouselProgress, setCarouselProgress] = useState(0);

  async function downloadBlob(url: string, filename: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleStory() {
    setExportingStory(true);
    try {
      await downloadBlob(
        `/api/admin/rankings/${slug}/story`,
        `story-${slug}-ranking-global.png`,
      );
    } finally {
      setExportingStory(false);
    }
  }

  async function handleCarousel() {
    setExportingCarousel(true);
    setCarouselProgress(0);
    try {
      for (let i = 0; i < totalRounds; i++) {
        await downloadBlob(
          `/api/admin/rankings/${slug}/round/${i}`,
          `carrusel-${slug}-fase-${i + 1}-de-${totalRounds}.png`,
        );
        setCarouselProgress(i + 1);
        if (i < totalRounds - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    } finally {
      setExportingCarousel(false);
      setCarouselProgress(0);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleStory}
        disabled={exportingStory || exportingCarousel}
        className="font-subhead flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs uppercase tracking-wide transition hover:border-foreground disabled:opacity-50"
      >
        {exportingStory ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Generando…
          </>
        ) : (
          "Exportar Story"
        )}
      </button>
      <button
        type="button"
        onClick={handleCarousel}
        disabled={exportingStory || exportingCarousel}
        className="font-subhead flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs uppercase tracking-wide transition hover:border-foreground disabled:opacity-50"
      >
        {exportingCarousel ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {carouselProgress}/{totalRounds} imágenes…
          </>
        ) : (
          "Exportar Carrusel"
        )}
      </button>
    </div>
  );
}

function RankingList({
  result,
  showAnya,
}: {
  result: GlobalRankingResult;
  showAnya: boolean;
}) {
  const historyByQb = useMemo(() => {
    const map = new Map<string, Array<{ roundIndex: number; points: number }>>();
    for (const round of result.rounds) {
      for (const score of round.scores) {
        if (score.points <= 0) continue;
        const arr = map.get(score.qbId) ?? [];
        arr.push({ roundIndex: round.roundIndex, points: score.points });
        map.set(score.qbId, arr);
      }
    }
    return map;
  }, [result.rounds]);

  return (
    <ol className="space-y-2">
      {result.ranking.map((entry) => {
        const qb = getQbById(entry.qbId);
        const team = qb ? getTeamByAbbr(qb.teamAbbr) : null;
        const history = historyByQb.get(entry.qbId) ?? [];
        return (
          <li
            key={entry.qbId}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
          >
            <div className="w-10 text-right font-mono text-lg font-bold text-muted">
              {entry.finalPosition.toString().padStart(2, "0")}
            </div>
            {team && qb && <TeamMark abbr={qb.teamAbbr} size={36} />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{qb?.name ?? entry.qbId}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>
                  {qb?.teamAbbr} · ronda {entry.roundIndex + 1} · {entry.pointsInRound} pts
                </span>
                {history.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {history.map((h) => {
                      const isElim = h.roundIndex === entry.roundIndex;
                      return (
                        <span
                          key={h.roundIndex}
                          className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                            isElim
                              ? "border-foreground/40 bg-surface-2 text-foreground"
                              : "border-border"
                          }`}
                          title={`Ronda ${h.roundIndex + 1}: ${h.points} pts`}
                        >
                          R{h.roundIndex + 1}:{h.points}
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
            </div>
            {showAnya && (
              <AnyaBadge qbId={entry.qbId} votePosition={entry.finalPosition} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RankingStream({
  result,
  round,
  totalRounds,
  accent,
  showAnya,
  onPrev,
  onNext,
}: {
  result: GlobalRankingResult;
  round: number;
  totalRounds: number;
  accent: string;
  showAnya: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const breakdown = result.rounds[round];
  // Entries asignadas en esta ronda, ordenadas de peor (mayor finalPosition) a mejor.
  const entries = useMemo(
    () =>
      [...result.ranking]
        .filter((e) => e.roundIndex === round)
        .sort((a, b) => b.finalPosition - a.finalPosition),
    [result.ranking, round],
  );
  const historyByQb = useMemo(() => {
    const map = new Map<string, Array<{ roundIndex: number; points: number }>>();
    for (const r of result.rounds) {
      for (const score of r.scores) {
        if (score.points <= 0) continue;
        const arr = map.get(score.qbId) ?? [];
        arr.push({ roundIndex: r.roundIndex, points: score.points });
        map.set(score.qbId, arr);
      }
    }
    return map;
  }, [result.rounds]);

  const [low, high] = breakdown.positionsAssigned;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={round === 0}
          aria-label="Fase anterior"
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:border-muted disabled:opacity-30"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Fase {round + 1} de {totalRounds}
          </p>
          <p
            className="font-mono text-2xl font-black"
            style={{ color: accent }}
          >
            Puestos {low}-{high}
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={round === totalRounds - 1}
          aria-label="Siguiente fase"
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:border-muted disabled:opacity-30"
        >
          →
        </button>
      </div>

      <ol className="space-y-2">
        {entries.map((entry) => {
          const qb = getQbById(entry.qbId);
          const team = qb ? getTeamByAbbr(qb.teamAbbr) : null;
          const history = historyByQb.get(entry.qbId) ?? [];
          return (
            <li
              key={entry.qbId}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3"
              style={{ borderLeft: `4px solid ${accent}` }}
            >
              <div className="w-12 text-right font-mono text-2xl font-black">
                {entry.finalPosition.toString().padStart(2, "0")}
              </div>
              {team && qb && <TeamMark abbr={qb.teamAbbr} size={44} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{qb?.name ?? entry.qbId}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>
                    {qb?.teamAbbr} · {entry.pointsInRound} pts
                  </span>
                  {history.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      {history.map((h) => {
                        const isElim = h.roundIndex === entry.roundIndex;
                        return (
                          <span
                            key={h.roundIndex}
                            className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                              isElim
                                ? "border-foreground/40 bg-surface-2 text-foreground"
                                : "border-border"
                            }`}
                            title={`Ronda ${h.roundIndex + 1}: ${h.points} pts`}
                          >
                            R{h.roundIndex + 1}:{h.points}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
              </div>
              {showAnya && (
                <AnyaBadge qbId={entry.qbId} votePosition={entry.finalPosition} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex justify-center gap-1.5">
        {Array.from({ length: totalRounds }, (_, i) => (
          <span
            key={i}
            className="h-1.5 w-6 rounded-full"
            style={{
              background: i === round ? accent : "var(--color-surface-2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const ANYA_RANKING = computeAnyaRanking();

// Bloque comparativo ANY/A mostrado a la derecha de cada QB: valor ANY/A, puesto
// en el ranking de ANY/A y diferencia respecto al puesto de la votación.
function AnyaBadge({
  qbId,
  votePosition,
}: {
  qbId: string;
  votePosition: number;
}) {
  const info = ANYA_RANKING.get(qbId);

  // Sin dato de ANY/A (p.ej. Willis): solo N/D, sin puesto ni diferencia.
  if (!info || info.value === null || info.rank === null) {
    return (
      <div className="shrink-0 text-right text-xs text-muted">
        <p className="font-mono font-bold">N/D</p>
        <p className="text-[10px] uppercase tracking-wide">ANY/A</p>
      </div>
    );
  }

  const diff = votePosition - info.rank;
  const value = info.value.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let diffEl: ReactNode;
  if (diff === 0) {
    diffEl = (
      <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
        =
      </span>
    );
  } else {
    const color = diff > 0 ? "#16a34a" : "#dc2626";
    const sign = diff > 0 ? "+" : "−";
    const title =
      diff > 0
        ? `Infravalorado por la votación (${Math.abs(diff)} puestos por debajo de su ANY/A)`
        : `Sobrevalorado por la votación (${Math.abs(diff)} puestos por encima de su ANY/A)`;
    diffEl = (
      <span
        className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold"
        style={{ borderColor: color, color }}
        title={title}
      >
        {sign}
        {Math.abs(diff)}
      </span>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
      <p className="font-mono text-sm font-bold">{value}</p>
      <div className="flex items-center gap-1 text-[10px] text-muted">
        <span className="font-mono">#{info.rank}</span>
        {diffEl}
      </div>
    </div>
  );
}
