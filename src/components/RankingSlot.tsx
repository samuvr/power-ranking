"use client";

import { type Team } from "@/data/teams";
import { TeamMark } from "./TeamMark";

type Props = {
  position: number;
  team: Team | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function RankingSlot({ position, team, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onRemove }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-2">
      <div className="flex w-9 shrink-0 items-center justify-center font-mono text-base font-bold text-foreground">
        {position.toString().padStart(2, "0")}
      </div>
      {team ? (
        <>
          <TeamMark abbr={team.abbr} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {team.location} {team.name}
            </p>
            <p className="truncate font-mono text-xs text-muted">{team.abbr}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Subir"
              disabled={!canMoveUp}
              onClick={onMoveUp}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-base font-bold transition active:scale-90 hover:border-muted disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Bajar"
              disabled={!canMoveDown}
              onClick={onMoveDown}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-base font-bold transition active:scale-90 hover:border-muted disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Quitar"
              onClick={onRemove}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-base font-bold transition active:scale-90 hover:border-accent hover:text-accent"
            >
              ×
            </button>
          </div>
        </>
      ) : (
        <div className="flex h-12 flex-1 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
          Vacío
        </div>
      )}
    </div>
  );
}
