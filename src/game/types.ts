export const DEITIES = [
  "kingInYellow",
  "shubNiggurath",
  "cthulhu",
  "yidhra",
  "nyarlathotep",
] as const;

export type Deity = (typeof DEITIES)[number];

export type Phase =
  | "setup"
  | "waiting_sacrifice"
  | "apply_desecration"
  | "activate_gift"
  | "resolve_gift"
  | "choose_overflow"
  | "assign_journal"
  | "choose_continue"
  | "game_over";

export interface ManuscriptCard {
  id: string;
  deities: Deity[];
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
  assignedDeity?: Deity;
  coveringInstanceId?: string;
  desecration?: boolean;
}

export interface Pile {
  cards: CardInstance[];
  topFaceUp: boolean;
}

export interface PlayerState {
  id: string;
  seatIndex: number;
  displayName: string;
  controllerUserId: string;
  journal: Record<Deity, CardInstance[]>;
  omen: CardInstance[];
  mad: Record<Deity, boolean>;
  hasDesecration: boolean;
  setupHand: CardInstance[];
}

export type PendingKind =
  | "overflow"
  | "assign_journal"
  | "telepathy"
  | "memory_pick"
  | "memory_place"
  | "cover"
  | "unfair_target"
  | "unfair_victim_give"
  | "unfair_actor_give"
  | "whisper_take"
  | "whisper_give"
  | "defile"
  | "brooding"
  | "dark_young"
  | "dark_young_assign"
  | "mind_control_gift";

export interface Pending {
  kind: PendingKind;
  actorPlayerId: string;
  targetPlayerId?: string;
  remaining?: number;
  gainedInstanceIds?: string[];
  activatedInstanceId?: string;
  deity?: Deity;
  blessed?: boolean;
  pileIndexes?: number[];
  peekedCards?: CardInstance[];
  after?: "interpret" | "continue" | "mind_control";
  reason?: "madness" | "stop" | "dark_young";
  newlyMad?: Deity[];
}

export interface ScoreRow {
  playerId: string;
  displayName: string;
  score: number;
  madnesses: number;
  journalCount: number;
  winner: boolean;
}

export interface GameState {
  id: string;
  playerCount: number;
  scoringDeity: Deity;
  phase: Phase;
  currentPlayerId: string;
  piles: Pile[];
  desecrationCenter: number;
  players: PlayerState[];
  pending: Pending | null;
  pendingStack: Pending[];
  gainedThisSacrifice: string[];
  scores: ScoreRow[] | null;
  log: string[];
  turnNumber: number;
  secretPeek?: PrivateView & { playerId: string };
}

export interface PublicPile {
  count: number;
  topCardId: string | null;
  topFaceUp: boolean;
}

export interface PublicPlayer {
  id: string;
  seatIndex: number;
  displayName: string;
  controllerUserId: string;
  journal: Record<Deity, CardInstance[]>;
  omen: CardInstance[];
  mad: Record<Deity, boolean>;
  hasDesecration: boolean;
  setupHand: CardInstance[];
  isReady?: boolean;
}

export interface PublicPending {
  kind: PendingKind;
  actorPlayerId: string;
  targetPlayerId?: string;
  remaining?: number;
  gainedInstanceIds?: string[];
  activatedInstanceId?: string;
  deity?: Deity;
  blessed?: boolean;
  pileIndexes?: number[];
  after?: Pending["after"];
  reason?: Pending["reason"];
  newlyMad?: Deity[];
}

export interface PublicGameState {
  id: string;
  playerCount: number;
  scoringDeity: Deity;
  phase: Phase;
  currentPlayerId: string;
  piles: PublicPile[];
  desecrationCenter: number;
  players: PublicPlayer[];
  pending: PublicPending | null;
  gainedThisSacrifice: string[];
  scores: ScoreRow[] | null;
  log: string[];
  turnNumber: number;
}

export interface PrivateView {
  peekedCards?: { pileIndex: number; card: CardInstance }[];
}

export type GameAction =
  | { type: "setup_assign"; instanceId: string; deity: Deity }
  | { type: "sacrifice"; instanceId: string; pileIndex: number }
  | { type: "apply_desecration"; instanceId: string }
  | { type: "choose_overflow"; deity: Deity }
  | { type: "assign_journal"; instanceId: string; deity: Deity }
  | { type: "activate_gift"; deity: Deity }
  | { type: "gift_telepathy"; pileIndex: number }
  | { type: "gift_memory_pick"; pileIndexes: [number, number] }
  | {
      type: "gift_memory_place";
      placements: { instanceId: string; pileIndex: number }[];
    }
  | { type: "gift_cover"; targetInstanceId: string }
  | { type: "gift_unfair_target"; playerId: string }
  | { type: "gift_give_card"; instanceId: string }
  | { type: "gift_whisper_take"; playerId: string; instanceId: string }
  | { type: "gift_defile"; playerId: string }
  | { type: "gift_draw_top"; pileIndex: number }
  | { type: "stop" };

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}
