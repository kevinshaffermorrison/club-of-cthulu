import { DEITIES, type Deity, type PlayerState, type ScoreRow } from "./types";

/** Points by manuscript count (index = count). Counts above 20 use the last printed cell. */
export type ScoreCurve = number[];

function formula(fn: (count: number) => number): ScoreCurve {
  return Array.from({ length: 21 }, (_, count) => (count === 0 ? 0 : fn(count)));
}

function row(values: number[]): ScoreCurve {
  return [0, ...values];
}

/**
 * Printed scoring cards (pages 1–20), mapped by the card’s color:
 * yellow / red / green / purple / blue.
 */
export const SCORING_TABLES: Record<Deity, Record<Deity, ScoreCurve>> = {
  kingInYellow: {
    kingInYellow: formula((n) => 5 * n),
    shubNiggurath: formula((n) => 9 * (n - 2)),
    cthulhu: formula((n) => 6 * n),
    yidhra: formula((n) => 8 * (n - 2)),
    nyarlathotep: formula((n) => 7 * (n - 1)),
  },
  shubNiggurath: {
    kingInYellow: formula((n) =>
      n % 2 === 1 ? (11 * (n + 1)) / 2 : 11 * (n / 2 - 1),
    ),
    shubNiggurath: formula((n) =>
      n === 1 ? 3 : ((n + 2) * (n + 3)) / 2,
    ),
    cthulhu: formula((n) => 8 * (n - 2)),
    yidhra: formula((n) => (n === 1 ? 0 : 6 * n)),
    nyarlathotep: formula((n) => (n <= 2 ? 0 : 10 * n)),
  },
  cthulhu: {
    kingInYellow: row([
      -10, 0, -5, 5, 13, 28, 15, 20, 50, 62, 73, 62, 52, 90, 90, 60, 95, 100,
      101, 108,
    ]),
    shubNiggurath: row([
      3, 6, 9, 12, 15, 20, 25, 30, 36, 43, 49, 56, 62, 68, 75, 77, 80, 84, 86,
      90,
    ]),
    cthulhu: row([
      2, 4, 7, 11, 17, 23, 29, 37, 41, 43, 47, 53, 57, 61, 67, 71, 74, 83, 89,
      97,
    ]),
    yidhra: row([
      15, 20, 20, 25, 25, 25, 25, 30, 35, 40, 30, 40, 60, 80, 50, 70, 90, 100,
      100, 98,
    ]),
    nyarlathotep: row([
      0, 6, 10, 14, 18, 23, 27, 30, 34, 38, 43, 53, 55, 65, 76, 77, 80, 83, 86,
      93,
    ]),
  },
  yidhra: {
    kingInYellow: formula((n) => 3 * n),
    shubNiggurath: row([
      5, 9, 14, 18, 23, 28, 32, 37, 42, 46, 51, 55, 60, 65, 70, 75, 80, 85, 90,
      95,
    ]),
    cthulhu: formula((n) => 4 * n - 2),
    yidhra: formula((n) => (n === 1 ? 1 : 4 * (n - 1))),
    nyarlathotep: formula((n) => (n === 1 ? 4 : 4 * (n - 2))),
  },
  nyarlathotep: {
    kingInYellow: row([
      60, 45, 30, 15, 0, 90, 60, 30, 0, 120, 60, 0, 180, 150, 60, 240, 150, 90,
      360, 280,
    ]),
    shubNiggurath: formula((n) => (n - 1) ** 2),
    cthulhu: row([
      15, 30, 15, 30, 30, 60, 30, 60, 60, 60, 120, 120, 120, 165, 120, 165, 165,
      220, 165, 220,
    ]),
    yidhra: formula((n) => 12 * (n - 2)),
    nyarlathotep: formula((n) => 9 * (n - 1)),
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
