import { cardDeities } from "./cards";
import { connectedPiles, wouldGoMad } from "./engine";
import {
  DEITIES,
  type Deity,
  type GameAction,
  type PendingKind,
  type PublicGameState,
} from "./types";

function giftKind(deity: Deity, blessed: boolean): PendingKind | "instant" {
  switch (deity) {
    case "kingInYellow":
      return blessed ? "memory_pick" : "telepathy";
    case "cthulhu":
      return "cover";
    case "nyarlathotep":
      return blessed ? "whisper_take" : "unfair_target";
    case "yidhra":
      return blessed ? "instant" : "defile";
    case "shubNiggurath":
      return blessed ? "dark_young" : "brooding";
    default:
      return "instant";
  }
}

export function applyOptimistic(
  game: PublicGameState,
  playerId: string,
  action: GameAction,
): PublicGameState | null {
  const next = structuredClone(game);
  const player = next.players.find((seat) => seat.id === playerId);
  if (!player) return null;

  switch (action.type) {
    case "setup_assign": {
      const index = player.setupHand.findIndex((card) => card.instanceId === action.instanceId);
      if (index < 0) return null;
      const card = player.setupHand[index]!;
      if (!cardDeities(card.cardId).includes(action.deity)) return null;
      player.setupHand.splice(index, 1);
      player.journal[action.deity].push({ ...card, assignedDeity: action.deity });
      if (next.players.every((seat) => seat.setupHand.length === 0)) {
        next.phase = "waiting_sacrifice";
      }
      return next;
    }
    case "assign_journal": {
      const index = player.omen.findIndex((card) => card.instanceId === action.instanceId);
      if (index < 0) return null;
      const card = player.omen[index]!;
      if (!cardDeities(card.cardId).includes(action.deity)) return null;
      player.omen.splice(index, 1);
      player.journal[action.deity].push({
        instanceId: card.instanceId,
        cardId: card.cardId,
        assignedDeity: action.deity,
      });
      if (player.omen.length === 0) {
        next.pending = null;
      } else if (next.pending) {
        next.pending.remaining = player.omen.length;
      }
      return next;
    }
    case "sacrifice": {
      let cardId: string | undefined;
      for (const deity of DEITIES) {
        const index = player.journal[deity].findIndex(
          (card) => card.instanceId === action.instanceId,
        );
        if (index >= 0) {
          cardId = player.journal[deity][index]!.cardId;
          player.journal[deity].splice(index, 1);
          break;
        }
      }
      if (!cardId) return null;
      const pile = next.piles[action.pileIndex];
      if (!pile || pile.count === 0) return null;
      pile.count += 1;
      pile.topFaceUp = true;
      pile.topCardId = cardId;
      for (const index of connectedPiles(action.pileIndex)) {
        const linked = next.piles[index];
        if (linked && linked.count > 0) {
          linked.count -= 1;
          linked.topFaceUp = false;
          linked.topCardId = null;
        }
      }
      return next;
    }
    case "apply_desecration": {
      const card = player.omen.find((omen) => omen.instanceId === action.instanceId);
      if (!card) return null;
      card.desecration = true;
      player.hasDesecration = false;
      if (wouldGoMad(player)) {
        next.phase = "assign_journal";
        next.pending = {
          kind: "assign_journal",
          actorPlayerId: playerId,
          remaining: player.omen.length,
          reason: "madness",
        };
      } else {
        next.phase = "activate_gift";
      }
      return next;
    }
    case "choose_overflow": {
      player.mad[action.deity] = true;
      return next;
    }
    case "stop": {
      if (player.omen.length > 0) {
        next.phase = "assign_journal";
        next.pending = {
          kind: "assign_journal",
          actorPlayerId: playerId,
          remaining: player.omen.length,
          reason: "stop",
        };
      }
      return next;
    }
    case "activate_gift": {
      if (wouldGoMad(player) && next.pending?.kind !== "mind_control_gift") {
        return null;
      }
      const blessed = Boolean(player.mad[action.deity]);
      const sourceIds =
        next.pending?.kind === "mind_control_gift" && next.pending.activatedInstanceId
          ? [next.pending.activatedInstanceId]
          : next.gainedThisSacrifice;
      const source = player.omen.find(
        (card) =>
          sourceIds.includes(card.instanceId) &&
          cardDeities(card.cardId).includes(action.deity),
      );
      if (!source) return null;
      const kind = giftKind(action.deity, blessed);
      if (kind === "instant") {
        next.pending = null;
        next.phase = "choose_continue";
        return next;
      }
      next.phase = "resolve_gift";
      next.pending = {
        kind,
        actorPlayerId: playerId,
        deity: action.deity,
        blessed,
        activatedInstanceId: source.instanceId,
        gainedInstanceIds: next.gainedThisSacrifice,
        after:
          action.deity === "cthulhu" ? (blessed ? "mind_control" : "continue") : undefined,
      };
      return next;
    }
    case "gift_cover": {
      const coverId = next.pending?.activatedInstanceId;
      if (!coverId) return null;
      const coverCard = player.omen.find((card) => card.instanceId === coverId);
      if (!coverCard) return null;
      coverCard.coveringInstanceId = action.targetInstanceId;
      next.pending = null;
      next.phase = "choose_continue";
      return next;
    }
    case "gift_defile": {
      const target = next.players.find((seat) => seat.id === action.playerId);
      if (!target || target.id === playerId || target.hasDesecration) return null;
      target.hasDesecration = true;
      next.desecrationCenter = Math.max(0, next.desecrationCenter - 1);
      next.pending = null;
      next.phase = "choose_continue";
      return next;
    }
    case "gift_unfair_target": {
      if (next.pending?.kind !== "unfair_target") return null;
      next.pending = {
        ...next.pending,
        kind: "unfair_victim_give",
        targetPlayerId: action.playerId,
      };
      return next;
    }
    default:
      return null;
  }
}
