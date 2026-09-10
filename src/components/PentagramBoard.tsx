"use client";

import { useEffect, useState } from "react";
import { DEITY_META, connectedPiles, type Deity, type PublicPile } from "@/game";
import { DEITIES } from "@/game/types";
import { CardBack, CardFace, EmptyCardSlot } from "./CardArt";
import type { CardDrag } from "./ManuscriptTile";

const POINTS: { x: number; y: number }[] = [
  { x: 50, y: 10 },
  { x: 90, y: 40 },
  { x: 74, y: 88 },
  { x: 26, y: 88 },
  { x: 10, y: 40 },
];

export function PentagramBoard({
  piles,
  desecrationCenter,
  scoringDeity,
  selectedPile,
  droppablePiles,
  peekCardIds,
  highlightDrops,
  onSelectPile,
  onDropOnPile,
}: {
  piles: PublicPile[];
  desecrationCenter: number;
  scoringDeity: Deity;
  selectedPile?: number | null;
  droppablePiles?: number[];
  peekCardIds?: Record<number, string>;
  highlightDrops?: boolean;
  onSelectPile?: (index: number) => void;
  onDropOnPile?: (pileIndex: number, drag: CardDrag) => void;
}) {
  const [hoverPile, setHoverPile] = useState<number | null>(null);
  useEffect(() => {
    if (!highlightDrops) setHoverPile(null);
  }, [highlightDrops]);
  const star = POINTS.map((_, i) => {
    const [a, b] = connectedPiles(i);
    return `M ${POINTS[i]!.x} ${POINTS[i]!.y} L ${POINTS[a]!.x} ${POINTS[a]!.y} M ${POINTS[i]!.x} ${POINTS[i]!.y} L ${POINTS[b]!.x} ${POINTS[b]!.y}`;
  }).join(" ");

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

  return (
    <div className="relative w-full max-w-[520px]">
      <svg viewBox="0 0 100 100" className="w-full drop-shadow-[0_0_18px_rgba(201,162,39,0.12)]">
        <polygon
          points={POINTS.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#3a3324"
          strokeWidth="0.6"
        />
        <path d={star} fill="none" stroke="#c9a227" strokeWidth="0.55" opacity="0.85" />
        <circle cx="50" cy="50" r="9" fill="#0c100d" stroke="#8f2d2d" strokeWidth="0.7" />
        <text x="50" y="49" textAnchor="middle" fontSize="3.2" fill="#c43c3c">
          {desecrationCenter}
        </text>
        <text x="50" y="54" textAnchor="middle" fontSize="2.2" fill="#9a917c">
          tokens
        </text>
      </svg>
      {POINTS.map((point, index) => {
        const pile = piles[index];
        const deity = DEITIES[index]!;
        const droppable = Boolean(droppablePiles?.includes(index));
        const active = selectedPile === index;
        const empty = !pile || pile.count === 0;
        const faceUp = Boolean(pile?.topFaceUp && pile.topCardId);
        const peekedId = peekCardIds?.[index];
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelectPile?.(index)}
            onDragOver={(event) => {
              if (!droppable) return;
              event.preventDefault();
              setHoverPile(index);
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) {
                return;
              }
              setHoverPile((current) => (current === index ? null : current));
            }}
            onDrop={(event) => {
              setHoverPile(null);
              if (!droppable || !onDropOnPile) return;
              event.preventDefault();
              const drag = parseDrag(event);
              if (drag) onDropOnPile(index, drag);
            }}
            className={`absolute w-[18%] -translate-x-1/2 -translate-y-1/2 p-0 ${
              onSelectPile || droppable ? "cursor-pointer" : ""
            } ${active ? "ring-2 ring-[#e6dcc4] ring-offset-1 ring-offset-[#0c100d]" : ""} ${
              highlightDrops && droppable
                ? hoverPile === index
                  ? "ring-4 ring-[#e6dcc4] ring-offset-2 ring-offset-[#0c100d] scale-110"
                  : "ring-2 ring-[#c9a227] ring-offset-2 ring-offset-[#0c100d]"
                : ""
            }`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            aria-label={`${DEITY_META[deity].short} deck, ${pile?.count ?? 0} cards, ${
              empty ? "empty" : faceUp ? "face up" : "face down"
            }`}
          >
            {empty ? (
              <EmptyCardSlot />
            ) : faceUp && pile.topCardId ? (
              <div className="relative">
                <div className="absolute inset-0 translate-x-[3px] translate-y-[4px] opacity-70">
                  <CardBack />
                </div>
                <CardFace cardId={pile.topCardId} />
                <span className="absolute -right-1 -top-1 rounded-sm bg-[#14110b] px-1 text-[0.55rem] text-[#e6dcc4]">
                  {pile.count}
                </span>
              </div>
            ) : peekedId ? (
              <div className="relative">
                <CardFace cardId={peekedId} />
                <span className="absolute -right-1 -top-1 rounded-sm bg-[#14110b] px-1 text-[0.55rem] text-[#c9a227]">
                  peek
                </span>
              </div>
            ) : (
              <CardBack count={pile.count} />
            )}
          </button>
        );
      })}
      <p className="mt-2 text-center text-xs tracking-[0.18em] uppercase text-[#9a917c]">
        Scoring · {DEITY_META[scoringDeity].short}
      </p>
    </div>
  );
}
