"use client";

import { DEITIES, DEITY_META, scorePlayer, type Deity, type PublicPlayer } from "@/game";
import { DesecrationBadge } from "./DesecrationBadge";
import { PlayerAvatar } from "./PlayerAvatar";

export function SeatScoreboard({
  player,
  scoringDeity,
  isTurn,
  isViewing,
  isYou,
  isOnline,
  onClick,
}: {
  player: PublicPlayer;
  scoringDeity: Deity;
  isTurn: boolean;
  isViewing: boolean;
  isYou: boolean;
  isOnline?: boolean;
  onClick: () => void;
}) {
  const preview = scorePlayer(player, scoringDeity);
  const count = DEITIES.reduce(
    (sum, deity) => sum + player.journal[deity].length,
    0,
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ritual-panel min-w-[9.5rem] rounded-md px-2 py-1.5 text-left ${
        isViewing ? "ring-2 ring-[#e6dcc4]/80" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2">
          <PlayerAvatar name={player.displayName} src={player.avatarUrl} size="sm" />
          <span className="truncate font-[family-name:var(--font-display)] text-sm tracking-wide">
            {player.displayName}
          </span>
        </p>
        <span className="flex shrink-0 items-center gap-1">
          {isYou ? (
            <span className="text-[0.6rem] uppercase tracking-wider text-[#9a917c]">You</span>
          ) : null}
          {isOnline && !isYou ? (
            <span className="text-[0.6rem] uppercase tracking-wider text-[#2f8f5b]">Live</span>
          ) : null}
          {isTurn ? (
            <span className="rounded-sm bg-[#c9a227] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[#14110b]">
              Turn
            </span>
          ) : null}
          {isViewing ? (
            <span className="rounded-sm border border-[#e6dcc4]/70 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-[#e6dcc4]">
              Viewing
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-1 flex gap-1">
        {DEITIES.map((deity) => {
          const n = player.journal[deity].length;
          const mad = player.mad[deity];
          return (
            <span
              key={deity}
              className="flex min-w-[1.35rem] flex-col items-center gap-0.5"
              title={`${DEITY_META[deity].short}: ${n}`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-sm text-[0.65rem] font-semibold"
                style={{
                  background: DEITY_META[deity].color,
                  color: DEITY_META[deity].ink,
                  boxShadow: mad ? `0 0 8px ${DEITY_META[deity].color}` : undefined,
                  outline: mad ? "2px solid #e6dcc4" : undefined,
                  outlineOffset: mad ? 1 : undefined,
                  opacity: n === 0 && !mad ? 0.35 : 1,
                }}
              >
                {n}
              </span>
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[0.7rem] text-[#9a917c]">
          {count} pages · {preview} pts
        </p>
        <DesecrationBadge held={player.hasDesecration} />
      </div>
    </button>
  );
}
