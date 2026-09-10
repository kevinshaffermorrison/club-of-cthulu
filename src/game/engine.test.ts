import { describe, expect, it } from "vitest";
import {
  applyAction,
  cardDeities,
  connectedPiles,
  createEmptyPlayer,
  createGame,
  giftIsLegal,
  legalGiftDeities,
  legalSacrificeCards,
  omenCounts,
  scorePlayer,
  toPublicState,
} from "./index";
import type { CardInstance, GameState, PlayerState } from "./types";

function card(cardId: string, instanceId = cardId): CardInstance {
  return { instanceId, cardId };
}

function player(partial: Partial<PlayerState> & { id: string }): PlayerState {
  const base = createEmptyPlayer({
    id: partial.id,
    seatIndex: partial.seatIndex ?? 0,
    displayName: partial.displayName ?? partial.id,
    controllerUserId: partial.controllerUserId ?? `user-${partial.id}`,
  });
  return { ...base, ...partial, journal: partial.journal ?? base.journal };
}

function fileOmens(state: GameState, playerId: string) {
  let next = state;
  while (next.phase === "assign_journal") {
    const actor = next.players.find((p) => p.id === playerId);
    const omen = actor?.omen[0];
    if (!omen) break;
    const deity = (omen.assignedDeity ?? cardDeities(omen.cardId)[0])!;
    next = applyAction(
      next,
      { type: "assign_journal", instanceId: omen.instanceId, deity },
      playerId,
    ).state;
  }
  return next;
}

function pile(cardIds: string[], topFaceUp = false) {
  return {
    topFaceUp,
    cards: cardIds.map((cardId, index) => card(cardId, `${cardId}#${index}`)),
  };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  const a = player({
    id: "a",
    seatIndex: 0,
    displayName: "Ada",
    journal: {
      kingInYellow: [],
      shubNiggurath: [],
      cthulhu: [card("25", "burn-c")],
      yidhra: [],
      nyarlathotep: [],
    },
  });
  const b = player({
    id: "b",
    seatIndex: 1,
    displayName: "Blake",
    journal: {
      kingInYellow: [card("1", "blake-k")],
      shubNiggurath: [],
      cthulhu: [],
      yidhra: [],
      nyarlathotep: [],
    },
  });
  return {
    id: "g1",
    playerCount: 2,
    scoringDeity: "cthulhu",
    phase: "waiting_sacrifice",
    currentPlayerId: "a",
    piles: [
      pile(["1", "2"]),
      pile(["13"]),
      pile(["26", "27"]),
      pile(["37"]),
      pile(["49", "50"]),
    ],
    desecrationCenter: 2,
    players: [a, b],
    pending: null,
    pendingStack: [],
    gainedThisSacrifice: [],
    scores: null,
    log: [],
    turnNumber: 1,
    ...overrides,
  };
}

describe("pentagram topology", () => {
  it("connects each pile to the two across the star, not neighbors", () => {
    expect(connectedPiles(0)).toEqual([2, 3]);
    expect(connectedPiles(1)).toEqual([3, 4]);
    expect(connectedPiles(2)).toEqual([4, 0]);
  });
});

describe("createGame", () => {
  it("deals 3 cards and five non-empty piles", () => {
    const game = createGame({
      id: "t",
      scoringDeity: "cthulhu",
      players: [
        { id: "a", displayName: "Ada", controllerUserId: "u1" },
        { id: "b", displayName: "Blake", controllerUserId: "u2" },
      ],
      rng: () => 0.5,
    });
    expect(game.players.every((p) => p.setupHand.length === 3)).toBe(true);
    expect(game.piles.flatMap((p) => p.cards).length + 6).toBe(80);
    expect(game.piles).toHaveLength(5);
    expect(game.piles.every((p) => p.cards.length > 0)).toBe(true);
    expect(game.phase).toBe("setup");
    const publicState = toPublicState(game);
    expect(publicState.piles.every((p) => p.topCardId === null)).toBe(true);
  });
});

describe("sacrifice", () => {
  it("rejects placing onto an empty deck", () => {
    const state = baseState({
      piles: [
        pile([]),
        pile(["13"]),
        pile(["26"]),
        pile(["37"]),
        pile(["49"]),
      ],
    });
    expect(() =>
      applyAction(state, { type: "sacrifice", instanceId: "burn-c", pileIndex: 0 }, "a"),
    ).toThrow(/empty/);
  });

  it("draws the two connected pile tops into the omen zone", () => {
    const { state } = applyAction(
      baseState(),
      { type: "sacrifice", instanceId: "burn-c", pileIndex: 0 },
      "a",
    );
    const ada = state.players[0]!;
    expect(ada.journal.cthulhu).toHaveLength(0);
    expect(state.piles[0]!.topFaceUp).toBe(true);
    expect(state.piles[0]!.cards[0]!.cardId).toBe("25");
    expect(ada.omen.map((c) => c.cardId).sort()).toEqual(["26", "37"]);
    expect(state.piles[2]!.cards[0]!.cardId).toBe("27");
    expect(state.phase).toBe("activate_gift");
  });
});

describe("madness", () => {
  it("goes mad before gifts when any color already hits 3", () => {
    const state = baseState({
      piles: [
        pile(["1", "2"]),
        pile(["13"]),
        pile(["26", "27"]),
        pile(["37", "38"]),
        pile(["49", "50"]),
      ],
    });
    state.players[0]!.omen = [
      card("28", "pre-1"),
      card("29", "pre-2"),
    ];
    const claimed = applyAction(
      state,
      { type: "sacrifice", instanceId: "burn-c", pileIndex: 0 },
      "a",
    ).state;
    expect(claimed.phase).toBe("assign_journal");
    expect(claimed.pending?.reason).toBe("madness");
    expect(claimed.players[0]!.mad.cthulhu).toBe(true);
    expect(claimed.log.some((line) => line.includes("went mad in Green"))).toBe(
      true,
    );
    const next = fileOmens(claimed, "a");
    expect(next.phase).toBe("waiting_sacrifice");
    expect(next.currentPlayerId).toBe("b");
    expect(next.players[0]!.omen).toHaveLength(0);
    expect(next.players[0]!.journal.cthulhu.length).toBeGreaterThan(0);
  });

  it("does not count a covered omen toward madness", () => {
    const ada = player({
      id: "a",
      omen: [
        { ...card("25", "mist"), coveringInstanceId: "other" },
        card("26", "keep"),
        card("37", "other"),
      ],
    });
    expect(omenCounts(ada).cthulhu).toBe(2);
    expect(omenCounts(ada).yidhra).toBe(0);
  });

  it("does not offer gifts when covering would have been needed to stay sane", () => {
    const state = baseState({
      piles: [
        pile(["1", "2"]),
        pile(["13"]),
        pile(["26", "27"]),
        pile(["37", "38"]),
        pile(["49", "50"]),
      ],
    });
    state.players[0]!.omen = [card("38", "p1"), card("39", "p2")];
    state.players[0]!.journal.kingInYellow = [card("2", "spare")];
    const claimed = applyAction(
      state,
      { type: "sacrifice", instanceId: "burn-c", pileIndex: 0 },
      "a",
    ).state;
    expect(claimed.phase).not.toBe("activate_gift");
    expect(claimed.players[0]!.mad.yidhra).toBe(true);
    expect(() =>
      applyAction(claimed, { type: "activate_gift", deity: "cthulhu" }, "a"),
    ).toThrow(/Madness/);
  });

  it("counts dual-deity cards for both colors", () => {
    const ada = player({
      id: "a",
      omen: [
        card("75", "d1"),
        card("25", "c1"),
        card("37", "y1"),
      ],
    });
    expect(omenCounts(ada).cthulhu).toBe(2);
    expect(omenCounts(ada).yidhra).toBe(2);
    ada.omen.push(card("77", "d2"));
    expect(omenCounts(ada).cthulhu).toBe(3);
  });

  it("lets desecration double a card's omen weight", () => {
    const ada = player({
      id: "a",
      omen: [
        { ...card("25", "c1"), desecration: true },
        card("26", "c2"),
      ],
    });
    expect(omenCounts(ada).cthulhu).toBe(3);
  });

  it("blocks sacrificing mad colors until sane columns are empty", () => {
    const ada = player({
      id: "a",
      mad: {
        kingInYellow: false,
        shubNiggurath: false,
        cthulhu: true,
        yidhra: false,
        nyarlathotep: false,
      },
      journal: {
        kingInYellow: [],
        shubNiggurath: [],
        cthulhu: [card("25", "mad-card")],
        yidhra: [card("37", "sane-card")],
        nyarlathotep: [],
      },
    });
    expect(legalSacrificeCards(ada).map((c) => c.instanceId)).toEqual(["sane-card"]);
    ada.journal.yidhra = [];
    expect(legalSacrificeCards(ada).map((c) => c.instanceId)).toEqual(["mad-card"]);
  });
});

describe("game end", () => {
  it("ends a 2-player game when one pile is empty on pass", () => {
    const state = baseState({
      phase: "choose_continue",
      piles: [
        pile(["1"]),
        pile([]),
        pile(["26"]),
        pile(["37"]),
        pile(["49"]),
      ],
    });
    const { state: next } = applyAction(state, { type: "stop" }, "a");
    expect(next.phase).toBe("game_over");
    expect(next.scores).not.toBeNull();
  });

  it("does not end a 3-player game on a single empty pile", () => {
    const state = baseState({
      playerCount: 3,
      phase: "choose_continue",
      players: [
        player({
          id: "a",
          journal: {
            kingInYellow: [card("4", "a-k")],
            shubNiggurath: [],
            cthulhu: [],
            yidhra: [],
            nyarlathotep: [],
          },
        }),
        player({
          id: "b",
          seatIndex: 1,
          journal: {
            kingInYellow: [card("5", "b-k")],
            shubNiggurath: [],
            cthulhu: [],
            yidhra: [],
            nyarlathotep: [],
          },
        }),
        player({
          id: "c",
          seatIndex: 2,
          displayName: "Corvus",
          journal: {
            kingInYellow: [card("6", "c-k")],
            shubNiggurath: [],
            cthulhu: [],
            yidhra: [],
            nyarlathotep: [],
          },
        }),
      ],
      piles: [
        pile(["1"]),
        pile([]),
        pile(["26"]),
        pile(["37"]),
        pile(["49"]),
      ],
    });
    const { state: next } = applyAction(state, { type: "stop" }, "a");
    expect(next.phase).toBe("waiting_sacrifice");
    expect(next.currentPlayerId).toBe("c");
  });
});

describe("scoring", () => {
  it("matches the Cthulhu scoring-card example", () => {
    const ada = player({
      id: "a",
      mad: {
        kingInYellow: true,
        shubNiggurath: false,
        cthulhu: true,
        yidhra: false,
        nyarlathotep: false,
      },
      journal: {
        kingInYellow: [card("1")],
        shubNiggurath: [card("13")],
        cthulhu: [card("25"), card("26")],
        yidhra: [card("37"), card("38"), card("39"), card("40")],
        nyarlathotep: [card("49"), card("50"), card("51"), card("52"), card("53")],
      },
    });
    expect(scorePlayer(ada, "cthulhu")).toBe(20);
  });
});

describe("desecration gifts", () => {
  it("does not offer purple gifts when every other researcher already has a token", () => {
    const state = baseState();
    state.players[1]!.hasDesecration = true;
    state.desecrationCenter = 2;
    state.gainedThisSacrifice = ["p"];
    state.players[0]!.omen = [card("37", "p")];
    expect(giftIsLegal(state, state.players[0]!, "yidhra", false)).toBe(false);
    expect(giftIsLegal(state, state.players[0]!, "yidhra", true)).toBe(false);
    expect(legalGiftDeities(state, state.players[0]!)).not.toContain("yidhra");
  });

  it("offers purple gifts when another researcher has no token", () => {
    const state = baseState();
    state.desecrationCenter = 1;
    state.gainedThisSacrifice = ["p"];
    state.players[0]!.omen = [card("37", "p")];
    expect(giftIsLegal(state, state.players[0]!, "yidhra", false)).toBe(true);
  });
});

describe("privacy", () => {
  it("hides face-down pile tops from the public view", () => {
    const publicState = toPublicState(baseState());
    expect(publicState.piles[0]!.count).toBe(2);
    expect(publicState.piles[0]!.topCardId).toBeNull();
    const revealed = baseState();
    revealed.piles[0]!.topFaceUp = true;
    expect(toPublicState(revealed).piles[0]!.topCardId).toBe("1");
  });
});
