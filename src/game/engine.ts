import {
  ALL_CARD_IDS,
  CATALOG,
  cardDeities,
  desecrationTokensForPlayerCount,
  emptyJournal,
  emptyMad,
  formatDeityList,
  GIFTS,
  isDual,
} from "./cards";
import { madnessCount, scoreGame } from "./scoring";
import {
  DEITIES,
  IllegalActionError,
  type CardInstance,
  type Deity,
  type GameAction,
  type GameState,
  type PlayerState,
  type PrivateView,
  type PublicGameState,
} from "./types";

export function connectedPiles(pileIndex: number): [number, number] {
  return [(pileIndex + 2) % 5, (pileIndex + 3) % 5];
}

export function emptyPileCount(state: GameState): number {
  return state.piles.filter((pile) => pile.cards.length === 0).length;
}

export function findPlayer(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new IllegalActionError("Unknown player");
  return player;
}

export function currentPlayer(state: GameState): PlayerState {
  return findPlayer(state, state.currentPlayerId);
}

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function newInstance(cardId: string, n: number): CardInstance {
  return { instanceId: `${cardId}#${n}`, cardId };
}

export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j] as T;
    items[j] = tmp as T;
  }
  return items;
}

export function createEmptyPlayer(input: {
  id: string;
  seatIndex: number;
  displayName: string;
  controllerUserId: string;
}): PlayerState {
  return {
    ...input,
    journal: emptyJournal(),
    omen: [],
    mad: emptyMad(),
    hasDesecration: false,
    setupHand: [],
  };
}

export function createGame(input: {
  id: string;
  players: { id: string; displayName: string; controllerUserId: string }[];
  scoringDeity: Deity;
  rng?: () => number;
}): GameState {
  if (input.players.length < 2 || input.players.length > 4) {
    throw new IllegalActionError("Club of Cthulhu is for 2–4 researchers");
  }
  const rng = input.rng ?? Math.random;
  const deck = shuffleInPlace(
    ALL_CARD_IDS.flatMap((cardId, index) => [newInstance(cardId, index)]),
    rng,
  );

  const players = input.players.map((player, seatIndex) => {
    const seat = createEmptyPlayer({ ...player, seatIndex });
    seat.setupHand = deck.splice(0, 3);
    return seat;
  });

  const piles: GameState["piles"] = Array.from({ length: 5 }, () => ({
    cards: [] as CardInstance[],
    topFaceUp: false,
  }));
  let pileIndex = 0;
  while (deck.length > 0) {
    const card = deck.shift();
    if (!card) break;
    piles[pileIndex]!.cards.push(card);
    pileIndex = (pileIndex + 1) % 5;
  }

  const start = Math.floor(rng() * players.length);
  return {
    id: input.id,
    playerCount: players.length,
    scoringDeity: input.scoringDeity,
    phase: "setup",
    currentPlayerId: players[start]!.id,
    piles,
    desecrationCenter: desecrationTokensForPlayerCount(players.length),
    players,
    pending: null,
    pendingStack: [],
    gainedThisSacrifice: [],
    scores: null,
    log: [`The ritual begins. ${players[start]!.displayName} lights the first candle.`],
    turnNumber: 1,
    secretPeek: undefined,
  };
}

export function toPublicState(state: GameState): PublicGameState {
  return {
    id: state.id,
    playerCount: state.playerCount,
    scoringDeity: state.scoringDeity,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    piles: state.piles.map((pile) => ({
      count: pile.cards.length,
      topFaceUp: pile.topFaceUp,
      topCardId:
        pile.topFaceUp && pile.cards[0] ? pile.cards[0].cardId : null,
    })),
    desecrationCenter: state.desecrationCenter,
    players: state.players.map((player) => ({
      id: player.id,
      seatIndex: player.seatIndex,
      displayName: player.displayName,
      controllerUserId: player.controllerUserId,
      journal: player.journal,
      omen: player.omen,
      mad: player.mad,
      hasDesecration: player.hasDesecration,
      setupHand: player.setupHand,
    })),
    pending: state.pending
      ? {
          kind: state.pending.kind,
          actorPlayerId: state.pending.actorPlayerId,
          targetPlayerId: state.pending.targetPlayerId,
          remaining: state.pending.remaining,
          gainedInstanceIds: state.pending.gainedInstanceIds,
          activatedInstanceId: state.pending.activatedInstanceId,
          deity: state.pending.deity,
          blessed: state.pending.blessed,
          pileIndexes: state.pending.pileIndexes,
          after: state.pending.after,
          reason: state.pending.reason,
          newlyMad: state.pending.newlyMad,
        }
      : null,
    gainedThisSacrifice: state.gainedThisSacrifice,
    scores: state.scores,
    log: state.log,
    turnNumber: state.turnNumber,
  };
}

export function privateViewFor(
  state: GameState,
  playerId: string,
): PrivateView {
  if (state.secretPeek?.playerId === playerId) {
    return { peekedCards: state.secretPeek.peekedCards };
  }
  const pending = state.pending;
  if (!pending || pending.actorPlayerId !== playerId) return {};
  if (pending.peekedCards && pending.pileIndexes) {
    return {
      peekedCards: pending.peekedCards.map((card, index) => ({
        pileIndex: pending.pileIndexes![index]!,
        card,
      })),
    };
  }
  return {};
}

export function journalCards(player: Pick<PlayerState, "journal">): CardInstance[] {
  return DEITIES.flatMap((deity) => player.journal[deity]);
}

export function legalSacrificeCards(player: Pick<PlayerState, "journal" | "mad">): CardInstance[] {
  const sane = DEITIES.filter((deity) => !player.mad[deity]);
  const saneCards = sane.flatMap((deity) => player.journal[deity]);
  if (saneCards.length > 0) return saneCards;
  return journalCards(player);
}

function findJournalCard(
  player: PlayerState,
  instanceId: string,
): { deity: Deity; index: number; card: CardInstance } | null {
  for (const deity of DEITIES) {
    const index = player.journal[deity].findIndex(
      (card) => card.instanceId === instanceId,
    );
    if (index >= 0) {
      return { deity, index, card: player.journal[deity][index]! };
    }
  }
  return null;
}

function removeJournalCard(
  player: PlayerState,
  instanceId: string,
): CardInstance {
  const found = findJournalCard(player, instanceId);
  if (!found) throw new IllegalActionError("That card is not in your journal");
  return player.journal[found.deity].splice(found.index, 1)[0]!;
}

export function omenCounts(player: Pick<PlayerState, "omen">): Record<Deity, number> {
  const covered = new Set(
    player.omen
      .map((card) => card.coveringInstanceId)
      .filter((id): id is string => Boolean(id)),
  );
  const numeric: Record<Deity, number> = {
    kingInYellow: 0,
    shubNiggurath: 0,
    cthulhu: 0,
    yidhra: 0,
    nyarlathotep: 0,
  };
  for (const card of player.omen) {
    if (covered.has(card.instanceId)) continue;
    const weight = card.desecration ? 2 : 1;
    for (const deity of cardDeities(card.cardId)) {
      numeric[deity] += weight;
    }
  }
  return numeric;
}

export function wouldGoMad(player: Pick<PlayerState, "omen">): boolean {
  const counts = omenCounts(player);
  return DEITIES.some((deity) => counts[deity] >= 3);
}

function drawTop(
  state: GameState,
  pileIndex: number,
): CardInstance | null {
  const pile = state.piles[pileIndex];
  if (!pile || pile.cards.length === 0) return null;
  const card = pile.cards.shift()!;
  card.coveringInstanceId = undefined;
  card.desecration = undefined;
  pile.topFaceUp = false;
  return card;
}

function placeOnPile(
  state: GameState,
  pileIndex: number,
  card: CardInstance,
  faceUp: boolean,
) {
  const pile = state.piles[pileIndex];
  if (!pile) throw new IllegalActionError("Invalid pile");
  const copy = { ...card };
  delete copy.coveringInstanceId;
  delete copy.desecration;
  delete copy.assignedDeity;
  pile.cards.unshift(copy);
  pile.topFaceUp = faceUp;
}

function log(state: GameState, message: string) {
  state.log = [...state.log.slice(-40), message];
}

function actorIs(state: GameState, playerId: string, allowPendingTarget = false) {
  const pending = state.pending;
  if (pending) {
    if (pending.kind === "unfair_victim_give") {
      if (playerId !== pending.targetPlayerId) {
        throw new IllegalActionError("Wait for the chosen researcher to give a card");
      }
      return;
    }
    if (playerId !== pending.actorPlayerId) {
      throw new IllegalActionError("This vision is not yours");
    }
    return;
  }
  if (allowPendingTarget) return;
  if (
    state.phase !== "setup" &&
    playerId !== state.currentPlayerId
  ) {
    throw new IllegalActionError("It is not your turn");
  }
}

function finishSetupIfReady(state: GameState) {
  if (state.players.every((player) => player.setupHand.length === 0)) {
    state.phase = "waiting_sacrifice";
    log(state, "Every journal has its first pages. The star is hungry.");
  }
}

function maybeEndForMadness(state: GameState, player: PlayerState): boolean {
  if (madnessCount(player) >= 5) {
    log(
      state,
      `${player.displayName} is blessed by all five gods — and vanishes.`,
    );
    endGame(state);
    return true;
  }
  return false;
}

function endGame(state: GameState) {
  state.phase = "game_over";
  state.pending = null;
  state.pendingStack = [];
  state.scores = scoreGame(state.players, state.scoringDeity);
}

function returnDesecration(state: GameState, player: PlayerState) {
  let found = player.hasDesecration;
  player.hasDesecration = false;
  for (const card of player.omen) {
    if (card.desecration) {
      card.desecration = false;
      found = true;
    }
  }
  if (found) state.desecrationCenter += 1;
}

function orderedPlayers(state: GameState): PlayerState[] {
  return [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
}

function nextSeat(state: GameState, playerId: string): PlayerState {
  const ordered = orderedPlayers(state);
  const currentIndex = ordered.findIndex((p) => p.id === playerId);
  return ordered[(currentIndex - 1 + ordered.length) % ordered.length]!;
}

function passTurn(state: GameState) {
  const player = currentPlayer(state);
  returnDesecration(state, player);
  for (const card of player.omen) {
    card.coveringInstanceId = undefined;
  }

  const empties = emptyPileCount(state);
  const threshold = state.playerCount === 2 ? 1 : 2;
  if (empties >= threshold) {
    log(state, "The flame dies out. The star has gone dark.");
    endGame(state);
    return;
  }

  let next = nextSeat(state, state.currentPlayerId);
  for (let hops = 0; hops < state.players.length; hops += 1) {
    if (legalSacrificeCards(next).length > 0) {
      state.currentPlayerId = next.id;
      state.phase = "waiting_sacrifice";
      state.gainedThisSacrifice = [];
      state.pending = null;
      state.turnNumber += 1;
      log(state, `${next.displayName}'s turn.`);
      return;
    }
    log(state, `${next.displayName} has nothing left to burn.`);
    next = nextSeat(state, next.id);
  }
  log(state, "No researcher has a page left to offer.");
  endGame(state);
}

function beginAssignOrPass(
  state: GameState,
  player: PlayerState,
  reason: "madness" | "stop",
  newlyMad?: Deity[],
) {
  if (player.omen.length > 0) {
    state.phase = "assign_journal";
    state.pending = {
      kind: "assign_journal",
      actorPlayerId: player.id,
      remaining: player.omen.length,
      reason,
      newlyMad,
    };
    return;
  }
  commitOmenToJournal(state, player);
  if (reason === "madness" && maybeEndForMadness(state, player)) return;
  passTurn(state);
}

function commitOmenToJournal(state: GameState, player: PlayerState) {
  for (const card of player.omen) {
    const deity = card.assignedDeity ?? cardDeities(card.cardId)[0]!;
    const clean = {
      instanceId: card.instanceId,
      cardId: card.cardId,
      assignedDeity: deity,
    };
    player.journal[deity].push(clean);
  }
  player.omen = [];
}

function interpretOmens(state: GameState, player: PlayerState): "mad" | "ok" {
  const counts = omenCounts(player);
  const hitting = DEITIES.filter((deity) => counts[deity] >= 3);
  if (hitting.length === 0) return "ok";

  const newlyMad = hitting.filter((deity) => !player.mad[deity]);
  const overflowHits = hitting.filter((deity) => player.mad[deity]);
  for (const deity of newlyMad) player.mad[deity] = true;
  const overflow = overflowHits.length;

  if (newlyMad.length > 0) {
    log(state, `${player.displayName} went mad in ${formatDeityList(newlyMad)}.`);
  }
  if (overflowHits.length > 0) {
    log(
      state,
      `${player.displayName}'s ${formatDeityList(overflowHits)} omen overflowed.`,
    );
  }

  const saneLeft = DEITIES.filter((deity) => !player.mad[deity]);
  if (overflow > 0 && saneLeft.length > 0) {
    state.phase = "choose_overflow";
    state.pending = {
      kind: "overflow",
      actorPlayerId: player.id,
      remaining: Math.min(overflow, saneLeft.length),
      newlyMad,
    };
    return "mad";
  }
  beginAssignOrPass(state, player, "madness", newlyMad);
  return "mad";
}

function afterDraws(state: GameState, player: PlayerState) {
  if (player.hasDesecration && state.gainedThisSacrifice.length > 0) {
    state.phase = "apply_desecration";
    return;
  }
  offerGiftsOrInterpret(state, player);
}

function offerGiftsOrInterpret(state: GameState, player: PlayerState) {
  if (wouldGoMad(player)) {
    interpretThenContinue(state, player);
    return;
  }
  const legal = legalGiftDeities(state, player);
  if (legal.length > 0) {
    state.phase = "activate_gift";
    return;
  }
  interpretThenContinue(state, player);
}

function interpretThenContinue(state: GameState, player: PlayerState) {
  const result = interpretOmens(state, player);
  if (result === "mad") return;
  state.phase = "choose_continue";
  if (legalSacrificeCards(player).length === 0) {
    beginAssignOrPass(state, player, "stop");
  }
}

type GiftCheckPile = { topFaceUp: boolean; cards?: { length: number }; count?: number };

type GiftCheckState = {
  piles: GiftCheckPile[];
  desecrationCenter: number;
  players: Array<{
    id: string;
    hasDesecration: boolean;
    journal: Record<Deity, CardInstance[]>;
  }>;
  gainedThisSacrifice: string[];
};

type GiftCheckPlayer = {
  id: string;
  omen: CardInstance[];
  journal: Record<Deity, CardInstance[]>;
};

export function legalGiftDeities(
  state: GiftCheckState,
  player: GiftCheckPlayer & { mad: Record<Deity, boolean> },
): Deity[] {
  const gained = player.omen.filter((card) =>
    state.gainedThisSacrifice.includes(card.instanceId),
  );
  const present = new Set<Deity>();
  for (const card of gained) {
    for (const deity of cardDeities(card.cardId)) present.add(deity);
  }
  return DEITIES.filter(
    (deity) => present.has(deity) && giftIsLegal(state, player, deity, player.mad[deity]),
  );
}

function pileSize(pile: GiftCheckPile): number {
  if (pile.cards) return pile.cards.length;
  return pile.count ?? 0;
}

function unmarkedDesecrationTargets(
  state: GiftCheckState,
  player: { id: string },
) {
  return state.players.filter(
    (other) => other.id !== player.id && !other.hasDesecration,
  );
}

function pilesWithCards(state: GiftCheckState): number[] {
  return state.piles
    .map((pile, index) => (pileSize(pile) > 0 ? index : -1))
    .filter((index) => index >= 0);
}

function faceDownTops(state: GiftCheckState): number[] {
  return state.piles
    .map((pile, index) => (pileSize(pile) > 0 && !pile.topFaceUp ? index : -1))
    .filter((index) => index >= 0);
}

function otherPlayersWithJournal(
  state: GiftCheckState,
  player: GiftCheckPlayer,
) {
  return state.players.filter(
    (other) => other.id !== player.id && journalCards(other).length > 0,
  );
}

export function giftIsLegal(
  state: GiftCheckState,
  player: GiftCheckPlayer,
  deity: Deity,
  blessed: boolean,
): boolean {
  const gained = player.omen.filter((card) =>
    state.gainedThisSacrifice.includes(card.instanceId),
  );
  switch (deity) {
    case "kingInYellow":
      if (blessed) return pilesWithCards(state).length >= 2;
      return faceDownTops(state).length >= 1;
    case "cthulhu":
      return gained.length >= 2;
    case "nyarlathotep":
      return (
        otherPlayersWithJournal(state, player).length > 0 &&
        journalCards(player).length > 0
      );
    case "yidhra":
      return (
        state.desecrationCenter > 0 &&
        unmarkedDesecrationTargets(state, player).length > 0
      );
    case "shubNiggurath":
      return faceDownTops(state).length >= 1;
    default:
      return false;
  }
}

function activatedCard(
  player: PlayerState,
  gainedIds: string[],
  deity: Deity,
): CardInstance {
  const card = player.omen.find(
    (omenCard) =>
      gainedIds.includes(omenCard.instanceId) &&
      cardDeities(omenCard.cardId).includes(deity),
  );
  if (!card) throw new IllegalActionError("No gained card of that deity");
  return card;
}

function startGift(
  state: GameState,
  player: PlayerState,
  deity: Deity,
  blessed: boolean,
  activatedInstanceId: string,
) {
  state.phase = "resolve_gift";
  const gained = state.gainedThisSacrifice;
  switch (deity) {
    case "kingInYellow":
      if (blessed) {
        state.pending = {
          kind: "memory_pick",
          actorPlayerId: player.id,
          deity,
          blessed,
          activatedInstanceId,
        };
      } else {
        state.pending = {
          kind: "telepathy",
          actorPlayerId: player.id,
          deity,
          blessed,
          activatedInstanceId,
        };
      }
      return;
    case "cthulhu":
      state.pending = {
        kind: "cover",
        actorPlayerId: player.id,
        deity,
        blessed,
        activatedInstanceId,
        gainedInstanceIds: gained,
        after: blessed ? "mind_control" : "continue",
      };
      return;
    case "nyarlathotep":
      if (blessed) {
        state.pending = {
          kind: "whisper_take",
          actorPlayerId: player.id,
          deity,
          blessed,
          activatedInstanceId,
        };
      } else {
        state.pending = {
          kind: "unfair_target",
          actorPlayerId: player.id,
          deity,
          blessed,
          activatedInstanceId,
        };
      }
      return;
    case "yidhra":
      if (blessed) {
        resolveMadnessUnleashed(state, player);
        finishGift(state);
      } else if (unmarkedDesecrationTargets(state, player).length === 0) {
        log(
          state,
          `${player.displayName}'s defilement finds no unmarked researcher.`,
        );
        finishGift(state);
      } else {
        state.pending = {
          kind: "defile",
          actorPlayerId: player.id,
          deity,
          blessed,
          activatedInstanceId,
        };
      }
      return;
    case "shubNiggurath":
      state.pending = {
        kind: blessed ? "dark_young" : "brooding",
        actorPlayerId: player.id,
        deity,
        blessed,
        activatedInstanceId,
      };
      return;
    default:
      throw new IllegalActionError("Unknown gift");
  }
}

function resolveMadnessUnleashed(state: GameState, player: PlayerState) {
  let marked = 0;
  for (const other of state.players) {
    if (other.id === player.id || other.hasDesecration) continue;
    if (state.desecrationCenter <= 0) break;
    other.hasDesecration = true;
    state.desecrationCenter -= 1;
    marked += 1;
  }
  if (marked === 0) {
    log(
      state,
      `${player.displayName}'s unleashed madness finds no unmarked researcher.`,
    );
    return;
  }
  log(state, `${player.displayName} unleashes madness across the circle.`);
}

function finishGift(state: GameState) {
  state.pending = state.pendingStack.pop() ?? null;
  if (state.pending) {
    state.phase = "resolve_gift";
    return;
  }
  if (state.phase === "game_over") return;
  interpretThenContinue(state, currentPlayer(state));
}

function giveDesecration(state: GameState, target: PlayerState) {
  if (target.hasDesecration) {
    throw new IllegalActionError("They already bear a heavy blessing");
  }
  if (state.desecrationCenter <= 0) {
    throw new IllegalActionError("The star has no tokens left");
  }
  target.hasDesecration = true;
  state.desecrationCenter -= 1;
}

export function applyAction(
  state: GameState,
  action: GameAction,
  actorPlayerId: string,
): { state: GameState; privateView: PrivateView } {
  const next = cloneState(state);
  applyActionMut(next, action, actorPlayerId);
  return { state: next, privateView: privateViewFor(next, actorPlayerId) };
}

function applyActionMut(
  state: GameState,
  action: GameAction,
  actorPlayerId: string,
) {
  if (state.phase === "game_over") {
    throw new IllegalActionError("The candles are already out");
  }
  if (state.secretPeek && state.secretPeek.playerId === actorPlayerId) {
    state.secretPeek = undefined;
  }
  const player = findPlayer(state, actorPlayerId);

  switch (action.type) {
    case "setup_assign": {
      if (state.phase !== "setup") {
        throw new IllegalActionError("Opening pages are already set");
      }
      const index = player.setupHand.findIndex(
        (card) => card.instanceId === action.instanceId,
      );
      if (index < 0) throw new IllegalActionError("That card is not in your hand");
      const card = player.setupHand[index]!;
      if (!cardDeities(card.cardId).includes(action.deity)) {
        throw new IllegalActionError("That manuscript does not bear that color");
      }
      player.setupHand.splice(index, 1);
      player.journal[action.deity].push({
        ...card,
        assignedDeity: action.deity,
      });
      finishSetupIfReady(state);
      return;
    }
    case "sacrifice": {
      actorIs(state, actorPlayerId);
      if (state.phase !== "waiting_sacrifice" && state.phase !== "choose_continue") {
        throw new IllegalActionError("You cannot sacrifice now");
      }
      if (state.phase === "choose_continue") {
        // sacrificing again
      }
      const legal = legalSacrificeCards(player);
      if (!legal.some((card) => card.instanceId === action.instanceId)) {
        throw new IllegalActionError("You cannot burn that card");
      }
      const pile = state.piles[action.pileIndex];
      if (!pile) throw new IllegalActionError("Invalid pile");
      if (pile.cards.length === 0) {
        throw new IllegalActionError("You may not place a card onto an empty deck");
      }
      const burned = removeJournalCard(player, action.instanceId);
      placeOnPile(state, action.pileIndex, burned, true);
      const gained: CardInstance[] = [];
      for (const connected of connectedPiles(action.pileIndex)) {
        const drawn = drawTop(state, connected);
        if (drawn) gained.push(drawn);
      }
      player.omen.push(...gained);
      state.gainedThisSacrifice = gained.map((card) => card.instanceId);
      log(
        state,
        `${player.displayName} feeds the star and draws ${gained.length} omen${gained.length === 1 ? "" : "s"}.`,
      );
      afterDraws(state, player);
      return;
    }
    case "apply_desecration": {
      actorIs(state, actorPlayerId);
      if (state.phase !== "apply_desecration") {
        throw new IllegalActionError("No token to place");
      }
      if (!player.hasDesecration) {
        throw new IllegalActionError("You do not hold a desecration token");
      }
      const card = player.omen.find(
        (omenCard) => omenCard.instanceId === action.instanceId,
      );
      if (!card || !state.gainedThisSacrifice.includes(card.instanceId)) {
        throw new IllegalActionError("Place the token on a card gained this sacrifice");
      }
      card.desecration = true;
      player.hasDesecration = false;
      offerGiftsOrInterpret(state, player);
      return;
    }
    case "choose_overflow": {
      actorIs(state, actorPlayerId);
      if (state.phase !== "choose_overflow" || state.pending?.kind !== "overflow") {
        throw new IllegalActionError("No overflowing blessing");
      }
      if (player.mad[action.deity]) {
        throw new IllegalActionError("That color is already mad");
      }
      player.mad[action.deity] = true;
      log(
        state,
        `${player.displayName} went mad in ${formatDeityList([action.deity])}.`,
      );
      const newlyMad = [...(state.pending.newlyMad ?? []), action.deity];
      const remaining = (state.pending.remaining ?? 1) - 1;
      if (remaining > 0 && DEITIES.some((deity) => !player.mad[deity])) {
        state.pending.remaining = remaining;
        state.pending.newlyMad = newlyMad;
        return;
      }
      state.pending = null;
      beginAssignOrPass(state, player, "madness", newlyMad);
      return;
    }
    case "assign_journal": {
      actorIs(state, actorPlayerId);
      if (state.phase !== "assign_journal" && state.pending?.kind !== "dark_young_assign") {
        throw new IllegalActionError("Nothing to assign");
      }
      if (state.pending?.kind === "dark_young_assign") {
        const card = player.omen.find((c) => c.instanceId === action.instanceId)
          ?? journalCards(player).find((c) => c.instanceId === action.instanceId);
        if (!card) throw new IllegalActionError("Unknown card");
        if (!cardDeities(card.cardId).includes(action.deity)) {
          throw new IllegalActionError("Color mismatch");
        }
        const held = player.omen.find((c) => c.instanceId === action.instanceId);
        if (held) {
          player.omen = player.omen.filter((c) => c.instanceId !== action.instanceId);
          player.journal[action.deity].push({
            instanceId: held.instanceId,
            cardId: held.cardId,
            assignedDeity: action.deity,
          });
        }
        finishGift(state);
        return;
      }
      const card = player.omen.find((c) => c.instanceId === action.instanceId);
      if (!card) throw new IllegalActionError("That omen is gone");
      if (!cardDeities(card.cardId).includes(action.deity)) {
        throw new IllegalActionError("Color mismatch");
      }
      player.omen = player.omen.filter((c) => c.instanceId !== action.instanceId);
      player.journal[action.deity].push({
        instanceId: card.instanceId,
        cardId: card.cardId,
        assignedDeity: action.deity,
      });
      if (player.omen.length > 0) {
        if (state.pending) state.pending.remaining = player.omen.length;
        return;
      }
      const reason = state.pending?.reason === "madness" ? "madness" : "stop";
      state.pending = null;
      if (reason === "madness" && maybeEndForMadness(state, player)) return;
      passTurn(state);
      return;
    }
    case "activate_gift": {
      actorIs(state, actorPlayerId);
      if (wouldGoMad(player) && state.pending?.kind !== "mind_control_gift") {
        throw new IllegalActionError("Madness closes the gifts");
      }
      if (state.pending?.kind === "mind_control_gift") {
        const instanceId = state.pending.activatedInstanceId;
        const covered = player.omen.find((card) => card.instanceId === instanceId);
        if (!covered || !cardDeities(covered.cardId).includes(action.deity)) {
          throw new IllegalActionError("That gift is not on the covered card");
        }
        if (!giftIsLegal(state, player, action.deity, player.mad[action.deity])) {
          throw new IllegalActionError("That gift cannot be used");
        }
        startGift(
          state,
          player,
          action.deity,
          player.mad[action.deity],
          covered.instanceId,
        );
        return;
      }
      if (state.phase !== "activate_gift") {
        throw new IllegalActionError("You cannot invoke a gift now");
      }
      if (!legalGiftDeities(state, player).includes(action.deity)) {
        throw new IllegalActionError("That gift cannot be used");
      }
      const card = activatedCard(player, state.gainedThisSacrifice, action.deity);
      startGift(state, player, action.deity, player.mad[action.deity], card.instanceId);
      return;
    }
    case "gift_telepathy": {
      actorIs(state, actorPlayerId);
      if (state.pending?.kind !== "telepathy") {
        throw new IllegalActionError("Telepathy is not open");
      }
      const pile = state.piles[action.pileIndex];
      if (!pile || pile.cards.length === 0 || pile.topFaceUp) {
        throw new IllegalActionError("Choose a face-down pile top");
      }
      const peeked = { ...pile.cards[0]! };
      state.secretPeek = {
        playerId: player.id,
        peekedCards: [{ pileIndex: action.pileIndex, card: peeked }],
      };
      log(state, `${player.displayName} listens through the veil.`);
      finishGift(state);
      return;
    }
    case "gift_memory_pick": {
      actorIs(state, actorPlayerId);
      if (state.pending?.kind !== "memory_pick") {
        throw new IllegalActionError("Memory Distortion is not open");
      }
      const [a, b] = action.pileIndexes;
      if (a === b) throw new IllegalActionError("Choose two different decks");
      const pileA = state.piles[a];
      const pileB = state.piles[b];
      if (!pileA?.cards[0] || !pileB?.cards[0]) {
        throw new IllegalActionError("Both decks must have cards");
      }
      state.pending = {
        ...state.pending,
        kind: "memory_place",
        pileIndexes: [a, b],
        peekedCards: [{ ...pileA.cards[0] }, { ...pileB.cards[0] }],
      };
      return;
    }
    case "gift_memory_place": {
      actorIs(state, actorPlayerId);
      if (state.pending?.kind !== "memory_place" || !state.pending.peekedCards) {
        throw new IllegalActionError("Nothing to rearrange");
      }
      const peeked = state.pending.peekedCards;
      const piles = state.pending.pileIndexes ?? [];
      if (action.placements.length !== 2 || piles.length !== 2) {
        throw new IllegalActionError("Place both cards");
      }
      const usedPiles = new Set(action.placements.map((p) => p.pileIndex));
      if (usedPiles.size !== 2 || ![...usedPiles].every((p) => piles.includes(p))) {
        throw new IllegalActionError("Return one card to each chosen deck");
      }
      const drawn = piles.map((pileIndex) => drawTop(state, pileIndex)!);
      for (const placement of action.placements) {
        const card =
          drawn.find((item) => item.instanceId === placement.instanceId) ??
          peeked.find((item) => item.instanceId === placement.instanceId);
        if (!card) throw new IllegalActionError("Unknown peeked card");
        placeOnPile(state, placement.pileIndex, card, false);
      }
      log(state, `${player.displayName} rewrites the star's memory.`);
      finishGift(state);
      return;
    }
    case "gift_cover": {
      actorIs(state, actorPlayerId);
      if (state.pending?.kind !== "cover" || !state.pending.activatedInstanceId) {
        throw new IllegalActionError("Nothing to cover");
      }
      const coverId = state.pending.activatedInstanceId;
      if (action.targetInstanceId === coverId) {
        throw new IllegalActionError("Cover a different card from this sacrifice");
      }
      if (!state.gainedThisSacrifice.includes(action.targetInstanceId)) {
        throw new IllegalActionError("Cover a card gained this sacrifice");
      }
      const coverCard = player.omen.find((c) => c.instanceId === coverId);
      const target = player.omen.find((c) => c.instanceId === action.targetInstanceId);
      if (!coverCard || !target) throw new IllegalActionError("Missing omen card");
      coverCard.coveringInstanceId = target.instanceId;
      if (state.pending.blessed && target.desecration) {
        target.desecration = false;
      }
      log(state, `${player.displayName} hides a sign in mist.`);
      if (state.pending.after === "mind_control") {
        const options = cardDeities(target.cardId).filter((deity) =>
          giftIsLegal(state, player, deity, player.mad[deity]),
        );
        if (options.length === 0) {
          finishGift(state);
          return;
        }
        const chosen = options[0]!;
        if (options.length === 1) {
          startGift(state, player, chosen, player.mad[chosen], target.instanceId);
          return;
        }
        state.pending = {
          kind: "mind_control_gift",
          actorPlayerId: player.id,
          activatedInstanceId: target.instanceId,
          gainedInstanceIds: [target.instanceId],
        };
        state.phase = "activate_gift";
        return;
      }
      finishGift(state);
      return;
    }
    case "gift_unfair_target": {
      actorIs(state, actorPlayerId);
      if (state.pending?.kind !== "unfair_target") {
        throw new IllegalActionError("Unfair Trade is not open");
      }
      const target = findPlayer(state, action.playerId);
      if (target.id === player.id) throw new IllegalActionError("Choose another researcher");
      if (journalCards(target).length === 0) {
        throw new IllegalActionError("They have no journal cards");
      }
      state.pending = {
        ...state.pending,
        kind: "unfair_victim_give",
        targetPlayerId: target.id,
      };
      log(state, `${player.displayName} demands a page from ${target.displayName}.`);
      return;
    }
    case "gift_give_card": {
      if (state.pending?.kind === "unfair_victim_give") {
        if (actorPlayerId !== state.pending.targetPlayerId) {
          throw new IllegalActionError("The demanded researcher must give a card");
        }
        const victim = player;
        const actor = findPlayer(state, state.pending.actorPlayerId);
        const card = removeJournalCard(victim, action.instanceId);
        actor.journal[card.assignedDeity ?? cardDeities(card.cardId)[0]!].push(card);
        state.pending = {
          ...state.pending,
          kind: "unfair_actor_give",
        };
        return;
      }
      if (state.pending?.kind === "unfair_actor_give" || state.pending?.kind === "whisper_give") {
        actorIs(state, actorPlayerId);
        const actor = player;
        const target = findPlayer(state, state.pending.targetPlayerId!);
        const card = removeJournalCard(actor, action.instanceId);
        target.journal[card.assignedDeity ?? cardDeities(card.cardId)[0]!].push(card);
        log(state, `Pages change hands between ${actor.displayName} and ${target.displayName}.`);
        finishGift(state);
        return;
      }
      throw new IllegalActionError("No trade is pending");
    }
    case "gift_whisper_take": {
      actorIs(state, actorPlayerId);
      if (state.pending?.kind !== "whisper_take") {
        throw new IllegalActionError("The trickster is silent");
      }
      const target = findPlayer(state, action.playerId);
      if (target.id === player.id) throw new IllegalActionError("Choose another researcher");
      const card = removeJournalCard(target, action.instanceId);
      player.journal[card.assignedDeity ?? cardDeities(card.cardId)[0]!].push(card);
      state.pending = {
        ...state.pending,
        kind: "whisper_give",
        targetPlayerId: target.id,
      };
      return;
    }
    case "gift_defile": {
      actorIs(state, actorPlayerId);
      if (state.pending?.kind !== "defile") {
        throw new IllegalActionError("Defilement is not open");
      }
      const target = findPlayer(state, action.playerId);
      if (target.id === player.id) throw new IllegalActionError("Choose another researcher");
      giveDesecration(state, target);
      log(state, `${player.displayName} marks ${target.displayName} with a heavy blessing.`);
      finishGift(state);
      return;
    }
    case "gift_draw_top": {
      actorIs(state, actorPlayerId);
      const kind = state.pending?.kind;
      if (kind !== "brooding" && kind !== "dark_young") {
        throw new IllegalActionError("No drawing gift is open");
      }
      const pile = state.piles[action.pileIndex];
      if (!pile || pile.cards.length === 0 || pile.topFaceUp) {
        throw new IllegalActionError("Draw a face-down pile top");
      }
      const drawn = drawTop(state, action.pileIndex);
      if (!drawn) throw new IllegalActionError("Empty deck");
      if (kind === "brooding") {
        player.omen.push(drawn);
        state.gainedThisSacrifice = [...state.gainedThisSacrifice, drawn.instanceId];
        log(state, `${player.displayName} broods another omen.`);
        const result = interpretOmens(state, player);
        if (result === "mad") return;
        finishGift(state);
        return;
      }
      if (isDual(drawn.cardId)) {
        player.omen.push(drawn);
        state.pending = {
          kind: "dark_young_assign",
          actorPlayerId: player.id,
          reason: "dark_young",
        };
        state.phase = "assign_journal";
        return;
      }
      const deity = cardDeities(drawn.cardId)[0]!;
      player.journal[deity].push({ ...drawn, assignedDeity: deity });
      log(state, `${player.displayName} births a Dark Young into their journal.`);
      finishGift(state);
      return;
    }
    case "stop": {
      actorIs(state, actorPlayerId);
      if (state.phase !== "choose_continue" && state.phase !== "waiting_sacrifice") {
        throw new IllegalActionError("You cannot stop now");
      }
      if (state.phase === "waiting_sacrifice" && legalSacrificeCards(player).length > 0) {
        throw new IllegalActionError("You must sacrifice at least once");
      }
      beginAssignOrPass(state, player, "stop");
      return;
    }
    default:
      throw new IllegalActionError("Unknown action");
  }
}

export function activateCoveredGift(state: GameState, actorPlayerId: string, deity: Deity) {
  return applyAction(state, { type: "activate_gift", deity }, actorPlayerId);
}

export { GIFTS, CATALOG, connectedPiles as pentagramLinks };
