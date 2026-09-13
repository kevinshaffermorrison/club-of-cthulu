"use client";

import { useEffect, useState } from "react";
import {
  cardDeities,
  legalSacrificeCards,
  type Deity,
  type GameAction,
  type PrivateView,
  type PublicGameState,
} from "@/game";
import { ActionDock } from "./ActionDock";
import { JournalZoom } from "./JournalZoom";
import type { CardDrag } from "./ManuscriptTile";
import { PassGate } from "./PassGate";
import { PentagramBoard } from "./PentagramBoard";
import { ScoringStrategyChip } from "./ScoringCard";
import { HomeLink } from "./HomeLink";
import { ScoringOverlay } from "./ScoringOverlay";
import { SeatScoreboard } from "./SeatScoreboard";
import { PlayerAvatar } from "./PlayerAvatar";

export function GameBoard({
  game,
  userId,
  privateView,
  realtimeStatus,
  onlineUserIds,
  onAct,
}: {
  game: PublicGameState;
  userId: string;
  privateView: PrivateView;
  realtimeStatus?: "connecting" | "live" | "error";
  onlineUserIds?: string[];
  onAct: (playerId: string, action: GameAction) => Promise<void>;
}) {
  const localSeats = game.players.filter((p) => p.controllerUserId === userId);
  const actingId =
    game.pending?.kind === "unfair_victim_give"
      ? game.pending.targetPlayerId
      : (game.pending?.actorPlayerId ??
        (game.phase === "setup"
          ? localSeats.find((s) => s.setupHand.length > 0)?.id
          : game.currentPlayerId));

  const [focus, setFocus] = useState<string | null>(null);
  const [manualSeat, setManualSeat] = useState<string | null>(null);
  const [confirmedActor, setConfirmedActor] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedPile, setSelectedPile] = useState<number | null>(null);
  const [memoryFirst, setMemoryFirst] = useState<number | null>(null);
  const [activeDrag, setActiveDrag] = useState<CardDrag | null>(null);

  const derivedSeat =
    (actingId && localSeats.some((s) => s.id === actingId) ? actingId : null) ??
    localSeats[0]?.id ??
    null;
  const activeSeat = manualSeat ?? derivedSeat;
  const actor =
    localSeats.find((s) => s.id === activeSeat) ?? localSeats[0] ?? null;
  const focusedPlayer =
    game.players.find((p) => p.id === (focus ?? actor?.id)) ?? actor;
  const legalIds = new Set(
    actor ? legalSacrificeCards(actor).map((c) => c.instanceId) : [],
  );
  const showGate = Boolean(
    actingId &&
      localSeats.length > 1 &&
      localSeats.some((s) => s.id === actingId) &&
      confirmedActor !== actingId,
  );
  const ownFocus = Boolean(actor && focusedPlayer && actor.id === focusedPlayer.id);
  const canSacrifice =
    ownFocus &&
    (game.phase === "waiting_sacrifice" || game.phase === "choose_continue") &&
    (!game.pending || game.pending.actorPlayerId === actor?.id);
  const droppablePiles = canSacrifice
    ? game.piles
        .map((pile, index) => (pile.count > 0 ? index : -1))
        .filter((index) => index >= 0)
    : [];
  const peekCardIds = Object.fromEntries(
    (privateView.peekedCards ?? []).map((peek) => [peek.pileIndex, peek.card.cardId]),
  );

  useEffect(() => {
    if (game.pending?.kind !== "memory_pick") setMemoryFirst(null);
  }, [game.pending?.kind]);

  function send(action: GameAction) {
    if (!actor) return;
    void onAct(actor.id, action);
    setSelectedCardId(null);
  }

  function onCardDrop(
    drag: CardDrag,
    target: { type: "journal"; deity: Deity } | { type: "omen" },
  ) {
    if (!actor || !ownFocus) return;
    if (target.type === "omen") return;
    if (drag.kind === "setup") {
      const card = actor.setupHand.find((c) => c.instanceId === drag.instanceId);
      if (!card || !cardDeities(card.cardId).includes(target.deity)) return;
      void send({
        type: "setup_assign",
        instanceId: drag.instanceId,
        deity: target.deity,
      });
      return;
    }
    if (drag.kind === "omen") {
      const card = actor.omen.find((c) => c.instanceId === drag.instanceId);
      if (!card || !cardDeities(card.cardId).includes(target.deity)) return;
      void send({
        type: "assign_journal",
        instanceId: drag.instanceId,
        deity: target.deity,
      });
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {game.phase === "game_over" && game.scores ? (
        <ScoringOverlay
          scores={game.scores}
          scoringDeity={game.scoringDeity}
          players={game.players}
        />
      ) : null}
      {showGate && actingId ? (
        <PassGate
          name={game.players.find((p) => p.id === actingId)?.displayName ?? "researcher"}
          onContinue={() => {
            setConfirmedActor(actingId);
            setManualSeat(actingId);
          }}
        />
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-3">
          <HomeLink />
          <h1 className="font-[family-name:var(--font-display)] text-lg tracking-[0.25em] uppercase">
            Club of Cthulhu
          </h1>
          <span
            className={`text-[0.65rem] uppercase tracking-wider ${
              realtimeStatus === "live"
                ? "text-[#2f8f5b]"
                : realtimeStatus === "error"
                  ? "text-[#c43c3c]"
                  : "text-[#9a917c]"
            }`}
          >
            {realtimeStatus === "live"
              ? "Live"
              : realtimeStatus === "error"
                ? "Offline"
                : "Linking"}
          </span>
          <ScoringStrategyChip deity={game.scoringDeity} />
        </div>
        {localSeats.length > 1 ? (
          <div className="flex gap-2">
            {localSeats.map((seat) => (
              <button
                key={seat.id}
                type="button"
                onClick={() => {
                  setManualSeat(seat.id);
                  setFocus(seat.id);
                }}
                className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs uppercase tracking-wider ${
                  activeSeat === seat.id
                    ? "bg-[#c9a227] text-[#14110b]"
                    : "border border-[#3a3324] text-[#9a917c]"
                }`}
              >
                <PlayerAvatar name={seat.displayName} src={seat.avatarUrl} size="sm" />
                {seat.displayName}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2 px-3">
        {game.players.map((player) => (
          <SeatScoreboard
            key={player.id}
            player={player}
            scoringDeity={game.scoringDeity}
            isTurn={game.currentPlayerId === player.id}
            isViewing={focusedPlayer?.id === player.id}
            isYou={player.controllerUserId === userId}
            isOnline={onlineUserIds?.includes(player.controllerUserId)}
            onClick={() => setFocus(player.id)}
          />
        ))}
      </div>

      <div className="grid flex-1 gap-3 px-3 py-2 lg:grid-cols-[minmax(20rem,32rem)_minmax(0,1fr)]">
        <div className="order-2 flex min-w-0 justify-center lg:order-1 lg:sticky lg:top-2 lg:self-start">
          <PentagramBoard
            piles={game.piles}
            desecrationCenter={game.desecrationCenter}
            selectedPile={selectedPile ?? memoryFirst}
            droppablePiles={
              activeDrag?.kind === "journal" ? droppablePiles : []
            }
            highlightDrops={activeDrag?.kind === "journal"}
            peekCardIds={peekCardIds}
            onSelectPile={(index) => {
              setSelectedPile(index);
              const pile = game.piles[index];
              const kind = game.pending?.kind;
              if (!pile || pile.count === 0 || pile.topFaceUp) return;
              if (kind === "telepathy") {
                void send({ type: "gift_telepathy", pileIndex: index });
                return;
              }
              if (kind === "brooding" || kind === "dark_young") {
                void send({ type: "gift_draw_top", pileIndex: index });
                return;
              }
              if (kind === "memory_pick") {
                if (memoryFirst == null || memoryFirst === index) {
                  setMemoryFirst(index);
                  return;
                }
                void send({
                  type: "gift_memory_pick",
                  pileIndexes: [memoryFirst, index],
                });
                setMemoryFirst(null);
              }
            }}
            onDropOnPile={(pileIndex, drag) => {
              if (drag.kind === "journal") {
                void send({
                  type: "sacrifice",
                  instanceId: drag.instanceId,
                  pileIndex,
                });
              }
            }}
          />
        </div>

        <div className="order-1 flex min-w-0 flex-col lg:order-2">
          {focusedPlayer ? (
            <JournalZoom
              player={focusedPlayer}
              selectedId={selectedCardId}
              highlightedIds={game.gainedThisSacrifice}
              setupDraggable={ownFocus && game.phase === "setup"}
              omenDraggable={(card) =>
                ownFocus &&
                (game.phase === "assign_journal" ||
                  game.pending?.kind === "assign_journal" ||
                  game.pending?.kind === "dark_young_assign" ||
                  (game.phase === "apply_desecration" &&
                    game.gainedThisSacrifice.includes(card.instanceId)))
              }
              journalDraggable={(card) => ownFocus && legalIds.has(card.instanceId)}
              journalDroppable={(deity) => {
                if (!ownFocus || !actor || !activeDrag) return false;
                if (activeDrag.kind === "setup" && game.phase === "setup") {
                  const card = actor.setupHand.find(
                    (c) => c.instanceId === activeDrag.instanceId,
                  );
                  return Boolean(card && cardDeities(card.cardId).includes(deity));
                }
                if (
                  activeDrag.kind === "omen" &&
                  (game.phase === "assign_journal" ||
                    game.pending?.kind === "assign_journal" ||
                    game.pending?.kind === "dark_young_assign")
                ) {
                  const card = actor.omen.find(
                    (c) => c.instanceId === activeDrag.instanceId,
                  );
                  return Boolean(card && cardDeities(card.cardId).includes(deity));
                }
                return false;
              }}
              omenDroppable={false}
              journalSelectable={(card) => {
                if (!actor || focusedPlayer.id !== actor.id) {
                  return game.pending?.kind === "whisper_take";
                }
                if (
                  game.phase === "waiting_sacrifice" ||
                  game.phase === "choose_continue"
                ) {
                  return legalIds.has(card.instanceId);
                }
                return Boolean(game.pending);
              }}
              omenSelectable={(card) => {
                if (actor?.id !== focusedPlayer.id) return false;
                if (game.pending?.kind === "cover") {
                  return (
                    game.gainedThisSacrifice.includes(card.instanceId) &&
                    card.instanceId !== game.pending.activatedInstanceId
                  );
                }
                if (game.phase === "apply_desecration") {
                  return game.gainedThisSacrifice.includes(card.instanceId);
                }
                return game.phase === "assign_journal";
              }}
              onSelect={(card) => {
                setSelectedCardId(card.instanceId);
                if (
                  game.pending?.kind === "cover" &&
                  game.gainedThisSacrifice.includes(card.instanceId) &&
                  card.instanceId !== game.pending.activatedInstanceId
                ) {
                  void send({
                    type: "gift_cover",
                    targetInstanceId: card.instanceId,
                  });
                }
              }}
              onDrop={onCardDrop}
              onDragBegin={setActiveDrag}
              onDragEnd={() => setActiveDrag(null)}
              logLine={game.log.at(-1)}
              actions={
                <ActionDock
                  game={game}
                  actor={actor}
                  privateView={privateView}
                  selectedCardId={selectedCardId}
                  selectedPile={selectedPile}
                  onAct={(action) => {
                    if (!actor) return;
                    send(action);
                  }}
                />
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
