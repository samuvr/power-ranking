"use client";

import { type Team } from "@/data/teams";
import { TeamMark } from "./TeamMark";

type Props = {
  team: Team;
  onTap?: () => void;
  disabled?: boolean;
  compact?: boolean;
};

export function TeamCard({ team, onTap, disabled, compact }: Props) {
  const content = (
    <>
      <TeamMark abbr={team.abbr} size={compact ? 36 : 44} />
      <div className="min-w-0 flex-1 text-left">
        <p className={`truncate font-semibold ${compact ? "text-sm" : "text-base"}`}>
          {team.location} {team.name}
        </p>
        <p className="truncate font-mono text-xs text-muted">{team.abbr}</p>
      </div>
    </>
  );

  if (!onTap) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left transition active:scale-[0.98] hover:border-muted disabled:opacity-40 disabled:active:scale-100`}
    >
      {content}
    </button>
  );
}
