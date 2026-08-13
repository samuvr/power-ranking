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
import { getTeamAbbrs, findTeamByAbbr, TOTAL_TEAMS } from "@/data/teams";
import type { VotingPublic } from "@/lib/db/client";
import { computeEvolution, evolutionByTeam } from "@/lib/ranking-evolution";
import { RankingSlot } from "./RankingSlot";
import { VotingLogo } from "./VotingLogo";
import { TeamMark } from "./TeamMark";

type StoredDraft = {
  savedAt: number;
  positions: (string | null)[];
};

const draftKey = (userId: string) => `tpr:draft:${userId}`;

/**
 * Deja siempre una lista con los 32 equipos: quita repetidos y desconocidos y
 * añade al final los que falten. Cubre borradores antiguos (con huecos) y
 * rankings guardados antes de que la lista fuese siempre completa.
 */
function normalizePositions(input: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const abbr of input) {
    if (!abbr || seen.has(abbr) || !findTeamByAbbr(abbr)) continue;
    seen.add(abbr);
    out.push(abbr);
  }
  for (const abbr of getTeamAbbrs()) {
    if (!seen.has(abbr)) out.push(abbr);
  }
  return out;
}

const samePositions = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((abbr, i) => abbr === b[i]);

type Props = {
  voting: VotingPublic;
  user: { id: string; fullName: string };
  /** Ranking guardado, o el orden por defecto si el usuario aún no tiene. */
  initialPositions: string[];
  /** false cuando el orden inicial es la semilla y no un ranking del usuario. */
  hasSavedRanking: boolean;
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
  hasSavedRanking,
  savedAt,
  previousPositions,
  previousLabel,
  staleSince,
  votingActive,
}: Props) {
  const router = useRouter();
  const votingMeta = voting;

  const savedPositions = useMemo(
    () => normalizePositions(initialPositions),
    [initialPositions],
  );

  const [positions, setPositions] = useState<string[]>(savedPositions);
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
        if (Array.isArray(draft.positions) && draft.savedAt > serverAt) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPositions(normalizePositions(draft.positions));
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

  // "Sin guardar": o nunca ha guardado, o ha movido algo desde el último guardado.
  const dirty = !hasSavedRanking || !samePositions(positions, savedPositions);

  // Evolución en vivo: se recalcula según arrastras.
  const deltaByTeam = useMemo(() => {
    if (!previousPositions) return null;
    return evolutionByTeam(computeEvolution(positions, previousPositions));
  }, [positions, previousPositions]);

  const swap = useCallback((a: number, b: number) => {
    setPositions((cur) => {
      if (a < 0 || b < 0 || a >= cur.length || b >= cur.length) return cur;
      const next = [...cur];
      [next[a], next[b]] = [next[b], next[a]];
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
      const from = positions.indexOf(String(active.id));
      const to = positions.indexOf(String(over.id));
      if (from === -1 || to === -1) return;
      // Mover e insertar: los equipos intermedios se desplazan un puesto.
      setPositions((cur) => arrayMove(cur, from, to));
    },
    [positions],
  );

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (positions.length !== TOTAL_TEAMS) {
      setError(`Tienes que ordenar los ${TOTAL_TEAMS} equipos`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/rankings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ positions }),
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
  }, [positions, router, user.id]);

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
              Estado
            </p>
            <p className="font-subhead text-sm leading-tight">
              {dirty ? "Sin guardar" : "Guardado"}
            </p>
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

        {!hasSavedRanking && (
          <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
            Este es el orden de partida con los {TOTAL_TEAMS} equipos. Colócalos a tu
            gusto y guarda tu ranking.
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

        <section aria-label="Mi ranking">
          <h2 className="font-subhead mb-2 text-[11px] uppercase tracking-wide text-muted">
            Arrastra por el asa ⠿ o usa ↑ ↓ para reordenar (1 = mejor, {TOTAL_TEAMS} =
            peor)
          </h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
          >
            <SortableContext items={positions} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
                {positions.map((teamAbbr, idx) => {
                  const team = findTeamByAbbr(teamAbbr);
                  if (!team) return null;
                  return (
                    <li key={teamAbbr}>
                      <RankingSlot
                        position={idx + 1}
                        team={team}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < positions.length - 1}
                        delta={deltaByTeam?.get(teamAbbr)?.delta ?? null}
                        since={previousLabel ?? undefined}
                        onMoveUp={() => swap(idx, idx - 1)}
                        onMoveDown={() => swap(idx, idx + 1)}
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
            disabled={submitting || !votingActive}
            className="font-subhead w-full rounded-xl px-4 py-3 text-base uppercase tracking-wide text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: votingMeta.accent }}
          >
            {submitting ? "Guardando…" : "Guardar ranking"}
          </button>
        </div>
      </footer>
    </div>
  );
}
