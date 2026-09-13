"use client";

import Link from "next/link";
import { DEITY_META, type Deity } from "@/game";
import { PlayerAvatar } from "./PlayerAvatar";

export type CircleSummary = {
  id: string;
  code: string;
  status: "lobby" | "playing" | "finished";
  scoring_deity: string;
  created_at: string;
  players: { display_name: string; controller_user_id: string; avatar_url?: string | null }[] | null;
};

const STATUS_LABEL: Record<CircleSummary["status"], string> = {
  lobby: "Gathering",
  playing: "In ritual",
  finished: "Findings",
};

const STATUS_RANK: Record<CircleSummary["status"], number> = {
  playing: 0,
  lobby: 1,
  finished: 2,
};

export function YourCircles({
  circles,
  userId,
}: {
  circles: CircleSummary[];
  userId: string | null;
}) {
  const ordered = [...circles].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  return (
    <section className="ritual-panel mt-8 rounded-md p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
        Your circles
      </h2>
      {ordered.length === 0 ? (
        <p className="mt-2 text-sm text-[#9a917c]">
          Circles you open or join on this device will appear here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {ordered.map((circle) => {
            const scoring = DEITY_META[circle.scoring_deity as Deity];
            const seats = circle.players ?? [];
            const yours = seats
              .filter((seat) => seat.controller_user_id === userId)
              .map((seat) => seat.display_name);
            const names = seats.map((seat) => seat.display_name).join(", ");
            return (
              <li key={circle.id}>
                <Link
                  href={`/room/${circle.code}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#3a3324] px-3 py-2 hover:border-[#c9a227]/70"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-[family-name:var(--font-display)] tracking-[0.12em]">
                      <span className="flex -space-x-1.5">
                        {seats.slice(0, 4).map((seat) => (
                          <PlayerAvatar
                            key={`${circle.id}-${seat.display_name}-${seat.controller_user_id}`}
                            name={seat.display_name}
                            src={seat.avatar_url}
                            size="sm"
                          />
                        ))}
                      </span>
                      {circle.code}
                      <span className="ml-2 text-xs uppercase tracking-wider text-[#9a917c]">
                        {STATUS_LABEL[circle.status]}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[#9a917c]">
                      {scoring ? `Scoring · ${scoring.short}` : "Scoring"}
                      {names ? ` · ${names}` : ""}
                      {yours.length ? ` · you (${yours.join(", ")})` : ""}
                    </p>
                  </div>
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-[#c9a227]">
                    {circle.status === "finished" ? "Review" : "Resume"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
