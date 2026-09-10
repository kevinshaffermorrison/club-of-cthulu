"use client";

import { DEITY_META, type ScoreRow } from "@/game";
import type { Deity } from "@/game";

export function ScoringOverlay({
  scores,
  scoringDeity,
}: {
  scores: ScoreRow[];
  scoringDeity: Deity;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="ritual-panel w-full max-w-lg rounded-md p-6">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-[#c9a227]">
          The candles go out
        </p>
        <h2 className="mt-2 text-center font-[family-name:var(--font-display)] text-3xl">
          Findings
        </h2>
        <p className="mb-4 text-center text-sm text-[#9a917c]">
          Scored with {DEITY_META[scoringDeity].short}
        </p>
        <div className="gold-rule mb-4" />
        <ol className="space-y-3">
          {scores.map((row) => (
            <li
              key={row.playerId}
              className="flex items-center justify-between gap-3"
            >
              <span className="font-[family-name:var(--font-display)]">
                {row.winner ? "★ " : ""}
                {row.displayName}
              </span>
              <span className="text-sm text-[#9a917c]">
                {row.score} pts · {row.madnesses} mad · {row.journalCount} pages
              </span>
            </li>
          ))}
        </ol>
        {scores.filter((row) => row.winner).length === 0 ? (
          <p className="mt-4 text-center text-sm text-[#9a917c]">
            The notes refuse a single author. Draw.
          </p>
        ) : null}
      </div>
    </div>
  );
}
