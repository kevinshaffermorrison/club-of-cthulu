"use client";

import {
  DEITIES,
  DEITY_META,
  type CardInstance,
  type Deity,
  type PublicPlayer,
} from "@/game";
import { useState } from "react";
import { DesecrationBadge } from "./DesecrationBadge";
import { ManuscriptTile, type CardDrag } from "./ManuscriptTile";

const JOURNAL_PEEK_REM = 1.15;

export function JournalZoom({
  player,
  omenSelectable,
  journalSelectable,
  setupDraggable,
  omenDraggable,
  journalDraggable,
  journalDroppable,
  omenDroppable,
  highlightedIds,
  selectedId,
  onSelect,
  onDrop,
  onDragBegin,
  onDragEnd,
}: {
  player: PublicPlayer;
  omenSelectable?: (card: CardInstance) => boolean;
  journalSelectable?: (card: CardInstance, deity: Deity) => boolean;
  setupDraggable?: boolean;
  omenDraggable?: (card: CardInstance) => boolean;
  journalDraggable?: (card: CardInstance) => boolean;
  journalDroppable?: (deity: Deity) => boolean;
  omenDroppable?: boolean;
  highlightedIds?: string[];
  selectedId?: string | null;
  onSelect?: (card: CardInstance, deity?: Deity) => void;
  onDrop?: (drag: CardDrag, target: { type: "journal"; deity: Deity } | { type: "omen" }) => void;
  onDragBegin?: (drag: CardDrag) => void;
  onDragEnd?: () => void;
}) {
  const [hoverDeity, setHoverDeity] = useState<Deity | null>(null);
  function parseDrag(event: React.DragEvent): CardDrag | null {
    const raw =
      event.dataTransfer.getData("application/json") ||
      event.dataTransfer.getData("text/plain");
    try {
      return JSON.parse(raw) as CardDrag;
    } catch {
      return null;
    }
  }

  function renderOmenTile(
    card: CardInstance,
    coverRole?: "covering" | "hidden",
  ) {
    return (
      <ManuscriptTile
        card={card}
        selected={selectedId === card.instanceId}
        highlighted={highlightedIds?.includes(card.instanceId)}
        dimmed={coverRole === "hidden" ? false : omenSelectable ? !omenSelectable(card) : false}
        coverRole={coverRole}
        draggable={omenDraggable?.(card)}
        drag={{ kind: "omen", instanceId: card.instanceId }}
        onDragBegin={onDragBegin}
        onDragEnd={() => {
          setHoverDeity(null);
          onDragEnd?.();
        }}
        onClick={
          omenSelectable?.(card) || omenDraggable?.(card)
            ? () => onSelect?.(card)
            : undefined
        }
      />
    );
  }

  return (
      <div className="ritual-panel max-h-[min(78vh,calc(100dvh-11rem))] overflow-auto rounded-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg tracking-[0.2em] uppercase">
          {player.displayName}
        </h2>
        <DesecrationBadge held={player.hasDesecration} />
      </div>
      {player.setupHand.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-[0.7rem] uppercase tracking-[0.2em] text-[#9a917c]">
            Opening pages — drag onto a matching color
          </p>
          <div className="flex flex-wrap gap-2">
            {player.setupHand.map((card) => (
              <ManuscriptTile
                key={card.instanceId}
                card={card}
                selected={selectedId === card.instanceId}
                draggable={setupDraggable}
                drag={{ kind: "setup", instanceId: card.instanceId }}
                onDragBegin={onDragBegin}
                onDragEnd={() => {
                  setHoverDeity(null);
                  onDragEnd?.();
                }}
                onClick={onSelect ? () => onSelect(card) : undefined}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={`mb-4 min-h-[6rem] rounded-sm border border-dashed p-2 transition ${
          omenDroppable
            ? "border-[#c9a227] bg-[#c9a227]/15 shadow-[0_0_18px_rgba(201,162,39,0.35)]"
            : "border-[#3a3324]"
        }`}
        onDragOver={(event) => {
          if (omenDroppable) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!omenDroppable || !onDrop) return;
          event.preventDefault();
          const drag = parseDrag(event);
          if (drag) onDrop(drag, { type: "omen" });
        }}
      >
        <p className="mb-2 text-[0.7rem] uppercase tracking-[0.2em] text-[#9a917c]">
          Omen zone
        </p>
        <div className="flex flex-wrap items-start gap-2">
          {player.omen.length === 0 ? (
            <p className="text-xs text-[#9a917c]">Empty</p>
          ) : (
            groupOmenCards(player.omen).map((entry) =>
              entry.kind === "cover" ? (
                <div
                  key={`${entry.cover.instanceId}-${entry.hidden.instanceId}`}
                  className="relative h-[8.4rem] w-[6.7rem]"
                >
                  <div className="absolute left-3 top-4 z-0">
                    {renderOmenTile(entry.hidden, "hidden")}
                  </div>
                  <div className="absolute left-0 top-0 z-10">
                    {renderOmenTile(entry.cover, "covering")}
                  </div>
                </div>
              ) : (
                <div key={entry.card.instanceId}>{renderOmenTile(entry.card)}</div>
              ),
            )
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {DEITIES.map((deity) => (
          <div
            key={deity}
            className={`min-h-[8rem] rounded-sm p-1 transition ${
              journalDroppable?.(deity)
                ? hoverDeity === deity
                  ? "bg-[#c9a227]/30 outline outline-2 outline-[#e6dcc4] shadow-[0_0_22px_rgba(230,220,196,0.55)]"
                  : "bg-[#c9a227]/15 outline outline-2 outline-[#c9a227] shadow-[0_0_16px_rgba(201,162,39,0.4)]"
                : ""
            }`}
            onDragOver={(event) => {
              if (!journalDroppable?.(deity)) return;
              event.preventDefault();
              setHoverDeity(deity);
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) {
                return;
              }
              setHoverDeity((current) => (current === deity ? null : current));
            }}
            onDrop={(event) => {
              setHoverDeity(null);
              if (!journalDroppable?.(deity) || !onDrop) return;
              event.preventDefault();
              const drag = parseDrag(event);
              if (drag) onDrop(drag, { type: "journal", deity });
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="token"
                style={{
                  background: player.mad[deity] ? DEITY_META[deity].color : "#1a1812",
                }}
              />
              <p className="text-[0.65rem] uppercase tracking-wider text-[#9a917c]">
                {DEITY_META[deity].short}
                {player.mad[deity] ? " · mad" : ""}
              </p>
            </div>
            <div
              className="relative w-[5.4rem]"
              style={{
                height:
                  player.journal[deity].length === 0
                    ? "7.56rem"
                    : `${7.56 + Math.max(0, player.journal[deity].length - 1) * JOURNAL_PEEK_REM}rem`,
              }}
            >
              {player.journal[deity].map((card, index) => (
                <div
                  key={card.instanceId}
                  className="absolute left-0 hover:z-50"
                  style={{
                    top: `${index * JOURNAL_PEEK_REM}rem`,
                    zIndex: selectedId === card.instanceId ? 40 : index + 1,
                  }}
                >
                  <ManuscriptTile
                    card={card}
                    selected={selectedId === card.instanceId}
                    dimmed={
                      journalSelectable
                        ? !journalSelectable(card, deity)
                        : false
                    }
                    draggable={journalDraggable?.(card)}
                    drag={{ kind: "journal", instanceId: card.instanceId }}
                    onDragBegin={onDragBegin}
                    onDragEnd={() => {
                      setHoverDeity(null);
                      onDragEnd?.();
                    }}
                    onClick={
                      journalSelectable?.(card, deity) || journalDraggable?.(card)
                        ? () => onSelect?.(card, deity)
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupOmenCards(omen: CardInstance[]) {
  const byId = new Map(omen.map((card) => [card.instanceId, card]));
  const hiddenIds = new Set(
    omen.flatMap((card) => {
      if (!card.coveringInstanceId || !byId.has(card.coveringInstanceId)) {
        return [];
      }
      return [card.coveringInstanceId];
    }),
  );
  const seen = new Set<string>();
  const entries: Array<
    | { kind: "single"; card: CardInstance }
    | { kind: "cover"; cover: CardInstance; hidden: CardInstance }
  > = [];
  for (const card of omen) {
    if (seen.has(card.instanceId)) continue;
    if (card.coveringInstanceId) {
      const hidden = byId.get(card.coveringInstanceId);
      if (hidden) {
        seen.add(card.instanceId);
        seen.add(hidden.instanceId);
        entries.push({ kind: "cover", cover: card, hidden });
        continue;
      }
    }
    if (hiddenIds.has(card.instanceId)) continue;
    seen.add(card.instanceId);
    entries.push({ kind: "single", card });
  }
  return entries;
}
