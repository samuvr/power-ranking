"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { getAllTeams, findTeamByAbbr, TOTAL_TEAMS, type Team } from "@/data/teams";
import type { VotingPublic } from "@/lib/db/client";
import { computeEvolution, evolutionByTeam } from "@/lib/ranking-evolution";
import { TeamCard } from "./TeamCard";
import { RankingSlot } from "./RankingSlot";
import { VotingLogo } from "./VotingLogo";
import { TeamMark } from "./TeamMark";

type Tab = "pool" | "ranking";

type StoredDraft = {
  savedAt: number;
  positions: (string | null)[];
};

const draftKey = (userId: string) => `tpr:draft:${userId}`;
const EMPTY_ID_PREFIX = "__empty__";

type Props = {
  voting: VotingPublic;
  user: { id: string; fullName: string };
  /** Ranking guardado (o huecos vacíos si aún no hay ninguno). */
  initialPositions: (string | null)[];
  /** Momento del último guardado, para saber si el borrador local es más nuevo. */
  savedAt: string | null;
  /** Puestos del usuario en el último screenshot en el que aparece. */
  previousPositions: string[] | null;
  previousLabel: string | null;
  /** Screenshot desde el que no actualiza (null si ya está al día). */
  staleSince: string | null;
  votingActive: boolean;
};

export function RankingBoard({
  voting,
  user,
  initialPositions,
  savedAt,
  previousPositions,
  previousLabel,
  staleSince,
  votingActive,
}: Props) {
  const router = useRouter();
  const allTeams = useMemo(() => getAllTeams(), []);
  const votingMeta = voting;

  const [positions, setPositions] = useState<(string | null)[]>(initialPositions);
  const [tab, setTab] = useState<Tab>(
    initialPositions.some((p) => p === null) ? "pool" : "ranking",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Un borrador local solo gana si es posterior al último guardado en servidor.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(user.id));
      if (raw) {
        const draft = JSON.parse(raw) as StoredDraft;
        const serverAt = savedAt ? new Date(savedAt).getTime() : 0;
        if (
          Array.isArray(draft.positions) &&
          draft.positions.length === TOTAL_TEAMS &&
          draft.savedAt > serverAt
        ) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPositions(draft.positions);
        }
      }
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, [user.id, savedAt]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const draft: StoredDraft = { savedAt: Date.now(), positions };
      localStorage.setItem(draftKey(user.id), JSON.stringify(draft));
    } catch {
      // ignore quota errors
    }
  }, [positions, user.id, hydrated]);

  const placedSet = useMemo(
    () => new Set(positions.filter((v): v is string => !!v)),
    [positions],
  );
  const pool = useMemo(
    () => allTeams.filter((t) => !placedSet.has(t.abbr)),
    [allTeams, placedSet],
  );
  const placedCount = placedSet.size;
  const complete = placedCount === TOTAL_TEAMS;

  // Evolución en vivo: se recalcula según arrastras.
  const deltaByTeam = useMemo(() => {
    if (!previousPositions) return null;
    const placed = positions.filter((v): v is string => !!v);
    return evolutionByTeam(computeEvolution(placed, previousPositions));
  }, [positions, previousPositions]);

  const sortableIds = useMemo(
    () => positions.map((p, idx) => p ?? `${EMPTY_ID_PREFIX}${idx}`),
    [positions],
  );

  const placeTeam = useCallback((teamAbbr: string) => {
    setPositions((cur) => {
      const idx = cur.findIndex((v) => v === null);
      if (idx === -1) return cur;
      const next = [...cur];
      next[idx] = teamAbbr;
      return next;
    });
    setTab("ranking");
  }, []);

  const swap = useCallback((a: number, b: number) => {
    setPositions((cur) => {
      if (a < 0 || b < 0 || a >= cur.length || b >= cur.length) return cur;
      const next = [...cur];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }, []);

  const removeAt = useCallback((index: number) => {
    setPositions((cur) => {
      // Se quita el equipo y el resto sube: el hueco queda al final.
      const next = cur.filter((_, i) => i !== index);
      next.push(null);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragging(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragging(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = sortableIds.indexOf(String(active.id));
      const to = sortableIds.indexOf(String(over.id));
      if (from === -1 || to === -1) return;
      // Mover e insertar: los equipos intermedios se desplazan un puesto.
      setPositions((cur) => arrayMove(cur, from, to));
    },
    [sortableIds],
  );

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!complete) {
      setError("Tienes que colocar los 32 equipos");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/rankings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ positions: positions as string[] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as { id: string };
      try {
        localStorage.removeItem(draftKey(user.id));
      } catch {
        // ignore
      }
      router.push(`/vote/success?id=${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error enviando ranking";
      setError(msg);
      setSubmitting(false);
    }
  }, [complete, positions, router, user.id]);

  const draggingTeam = dragging ? findTeamByAbbr(dragging) : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-10 border-b-2 bg-background/95 px-4 py-3 backdrop-blur"
        style={{ borderColor: votingMeta.accent }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="relative h-10 w-10 overflow-hidden rounded-full border-2"
              style={{ borderColor: votingMeta.accent }}
            >
              <VotingLogo
                src={votingMeta.logo_url}
                name={votingMeta.name}
                accent={votingMeta.accent}
              />
            </div>
            <div>
              <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
                {user.fullName}
              </p>
              <p className="font-subhead text-sm leading-tight">{votingMeta.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-subhead text-[10px] uppercase tracking-wide text-muted">
              Progreso
            </p>
            <p className="font-mono text-base font-bold">
              {placedCount.toString().padStart(2, "0")} / {TOTAL_TEAMS}
            </p>
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-3xl">
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full transition-all"
              style={{
                width: `${(placedCount / TOTAL_TEAMS) * 100}%`,
                background: votingMeta.accent,
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <nav className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/historico"
            className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
          >
            Revisar Screenshots
          </Link>
          <Link
            href="/perfil"
            className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
          >
            Mi cuenta
          </Link>
        </nav>

        {staleSince && (
          <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
            Tu ranking no cambia desde <strong>{staleSince}</strong>. Actualízalo para
            entrar en el próximo screenshot.
          </p>
        )}

        {previousLabel && (
          <p className="mb-4 text-[11px] text-muted">
            Las flechas comparan con <strong>{previousLabel}</strong> y se actualizan
            según mueves equipos.
          </p>
        )}

        {!votingActive && (
          <p className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            La votación está cerrada: puedes reordenar tu ranking pero no guardarlo.
          </p>
        )}

        {/* Tabs (mobile) */}
        <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface lg:hidden">
          <button
            type="button"
            onClick={() => setTab("pool")}
            className={`font-subhead px-3 py-2 text-xs uppercase tracking-wide transition ${
              tab === "pool" ? "bg-surface-2 text-foreground" : "text-muted"
            }`}
          >
            Disponibles · {pool.length}
          </button>
          <button
            type="button"
            onClick={() => setTab("ranking")}
            className={`font-subhead px-3 py-2 text-xs uppercase tracking-wide transition ${
              tab === "ranking" ? "bg-surface-2 text-foreground" : "text-muted"
            }`}
          >
            Mi ranking · {placedCount}/{TOTAL_TEAMS}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Pool */}
          <section
            className={`${tab === "pool" ? "block" : "hidden"} lg:block`}
            aria-label="Equipos disponibles"
          >
            <h2 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
              Toca un equipo para añadirlo al siguiente puesto vacío
            </h2>
            <ul className="space-y-2">
              {pool.length === 0 && (
                <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
                  Has colocado todos los equipos.
                </li>
              )}
              {pool.map((team) => (
                <li key={team.abbr}>
                  <TeamCard team={team} onTap={() => placeTeam(team.abbr)} />
                </li>
              ))}
            </ul>
          </section>

          {/* Ranking */}
          <section
            className={`${tab === "ranking" ? "block" : "hidden"} lg:block`}
            aria-label="Mi ranking"
          >
            <h2 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
              Arrastra por el asa ⠿ para reordenar (1 = mejor, 32 = peor)
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDragging(null)}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <ol className="space-y-2">
                  {positions.map((teamAbbr, idx) => {
                    const team: Team | null = teamAbbr
                      ? findTeamByAbbr(teamAbbr) ?? null
                      : null;
                    return (
                      <li key={sortableIds[idx]}>
                        <RankingSlot
                          sortableId={sortableIds[idx]}
                          position={idx + 1}
                          team={team}
                          canMoveUp={idx > 0 && !!team}
                          canMoveDown={
                            idx < TOTAL_TEAMS - 1 && !!team && !!positions[idx + 1]
                          }
                          delta={
                            teamAbbr
                              ? deltaByTeam?.get(teamAbbr)?.delta ?? null
                              : null
                          }
                          since={previousLabel ?? undefined}
                          onMoveUp={() => swap(idx, idx - 1)}
                          onMoveDown={() => swap(idx, idx + 1)}
                          onRemove={() => removeAt(idx)}
                        />
                      </li>
                    );
                  })}
                </ol>
              </SortableContext>
              <DragOverlay>
                {draggingTeam ? (
                  <div className="flex items-center gap-2 rounded-xl border-2 bg-surface px-2 py-2 shadow-lg"
                    style={{ borderColor: votingMeta.accent }}
                  >
                    <TeamMark abbr={draggingTeam.abbr} size={36} />
                    <p className="truncate text-sm font-semibold">
                      {draggingTeam.location} {draggingTeam.name}
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </section>
        </div>
      </div>

      {/* Sticky submit */}
      <footer className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 safe-bottom backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {error && (
            <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!complete || submitting || !votingActive}
            className="font-subhead w-full rounded-xl px-4 py-3 text-base uppercase tracking-wide text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: votingMeta.accent }}
          >
            {submitting
              ? "Guardando…"
              : complete
                ? "Guardar ranking"
                : `Coloca los ${TOTAL_TEAMS - placedCount} restantes`}
          </button>
        </div>
      </footer>
    </div>
  );
}
