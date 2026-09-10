import { DEITIES, type Deity, type PlayerState, type ScoreRow } from "./types";

/** Points by manuscript count (index = count, last value repeats for higher counts). */
export type ScoreCurve = number[];

/**
 * Official scoring cards are not fully printed in the compressed rulebook.
 * The Cthulhu (green) table matches the example: 5 Nyarlathotep = 10,
 * 1 Shub-Niggurath = 10, 4 Yidhra = 0. Other deities use the same style of
 * sparse / linear / valley curves, rotated per scoring card.
 */
export const SCORING_TABLES: Record<Deity, Record<Deity, ScoreCurve>> = {
  cthulhu: {
    cthulhu: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    kingInYellow: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    nyarlathotep: [0, 2, 4, 6, 8, 10, 12, 14, 16],
    shubNiggurath: [0, 10, 8, 6, 4, 2, 0, 0, 0],
    yidhra: [0, 4, 8, 4, 0, 0, 0, 0, 0],
  },
  kingInYellow: {
    kingInYellow: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    nyarlathotep: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    shubNiggurath: [0, 2, 4, 6, 8, 10, 12, 14, 16],
    yidhra: [0, 10, 8, 6, 4, 2, 0, 0, 0],
    cthulhu: [0, 4, 8, 4, 0, 0, 0, 0, 0],
  },
  shubNiggurath: {
    shubNiggurath: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    yidhra: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    cthulhu: [0, 2, 4, 6, 8, 10, 12, 14, 16],
    kingInYellow: [0, 10, 8, 6, 4, 2, 0, 0, 0],
    nyarlathotep: [0, 4, 8, 4, 0, 0, 0, 0, 0],
  },
  yidhra: {
    yidhra: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    cthulhu: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    kingInYellow: [0, 2, 4, 6, 8, 10, 12, 14, 16],
    nyarlathotep: [0, 10, 8, 6, 4, 2, 0, 0, 0],
    shubNiggurath: [0, 4, 8, 4, 0, 0, 0, 0, 0],
  },
  nyarlathotep: {
    nyarlathotep: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    shubNiggurath: [0, 0, 3, 6, 10, 15, 21, 21, 21],
    yidhra: [0, 2, 4, 6, 8, 10, 12, 14, 16],
    cthulhu: [0, 10, 8, 6, 4, 2, 0, 0, 0],
    kingInYellow: [0, 4, 8, 4, 0, 0, 0, 0, 0],
  },
};

export function pointsForCount(curve: ScoreCurve, count: number): number {
  if (count <= 0) return 0;
  const index = Math.min(count, curve.length - 1);
  return curve[index] ?? 0;
}

export function scorePlayer(
  player: Pick<PlayerState, "journal" | "mad">,
  scoringDeity: Deity,
): number {
  const table = SCORING_TABLES[scoringDeity];
  let total = 0;
  for (const deity of DEITIES) {
    if (player.mad[deity]) continue;
    total += pointsForCount(table[deity], player.journal[deity].length);
  }
  return total;
}

export function journalCount(player: PlayerState): number {
  return DEITIES.reduce((sum, deity) => sum + player.journal[deity].length, 0);
}

export function madnessCount(player: PlayerState): number {
  return DEITIES.filter((deity) => player.mad[deity]).length;
}

export function scoreGame(
  players: PlayerState[],
  scoringDeity: Deity,
): ScoreRow[] {
  const rows: ScoreRow[] = players.map((player) => ({
    playerId: player.id,
    displayName: player.displayName,
    score: scorePlayer(player, scoringDeity),
    madnesses: madnessCount(player),
    journalCount: journalCount(player),
    winner: false,
  }));

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.madnesses !== b.madnesses) return a.madnesses - b.madnesses;
    if (b.journalCount !== a.journalCount) return b.journalCount - a.journalCount;
    return 0;
  });

  const lead = rows[0];
  if (!lead) return rows;
  const tied = rows.filter(
    (row) =>
      row.score === lead.score &&
      row.madnesses === lead.madnesses &&
      row.journalCount === lead.journalCount,
  );
  if (tied.length === 1) {
    lead.winner = true;
  }
  return rows;
}
