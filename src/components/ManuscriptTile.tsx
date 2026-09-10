"use client";

import { CardFace } from "./CardArt";
import type { CardInstance } from "@/game";

export type CardDrag =
  | { kind: "setup"; instanceId: string }
  | { kind: "journal"; instanceId: string }
  | { kind: "omen"; instanceId: string };

export function ManuscriptTile({
  card,
  selected,
  highlighted,
  dimmed,
  draggable,
  drag,
  coverRole,
  onClick,
  onDragBegin,
  onDragEnd,
}: {
  card: CardInstance;
  selected?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  draggable?: boolean;
  drag?: CardDrag;
  coverRole?: "covering" | "hidden";
  onClick?: () => void;
  onDragBegin?: (drag: CardDrag) => void;
  onDragEnd?: () => void;
}) {
  const label =
    coverRole === "hidden" ? "Hidden" : coverRole === "covering" ? "Mist" : highlighted ? "Drawn" : null;
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        if (!drag) return;
        event.dataTransfer.setData("application/json", JSON.stringify(drag));
        event.dataTransfer.setData("text/plain", JSON.stringify(drag));
        event.dataTransfer.effectAllowed = "move";
        onDragBegin?.(drag);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={onClick}
      disabled={!onClick && !draggable}
      aria-label={
        coverRole === "hidden"
          ? "Hidden omen under mist"
          : coverRole === "covering"
            ? "Omen covering another card in mist"
            : undefined
      }
      className={`relative w-[5.4rem] p-0 text-left transition ${
        selected ? "ring-2 ring-[#c9a227]" : ""
      } ${highlighted && !coverRole ? "ring-2 ring-[#e6dcc4]" : ""} ${
        dimmed ? "opacity-40" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {label ? (
        <span
          className={`absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-sm px-1 text-[0.55rem] font-semibold uppercase tracking-wider ${
            coverRole === "hidden"
              ? "bg-[#1a1812] text-[#e6dcc4]"
              : coverRole === "covering"
                ? "bg-[#2f8f5b] text-[#07150e]"
                : "bg-[#e6dcc4] text-[#14110b]"
          }`}
        >
          {label}
        </span>
      ) : null}
      <CardFace
        cardId={card.cardId}
        assignedDeity={card.assignedDeity}
        desecration={card.desecration}
        covering={coverRole === "covering" || Boolean(card.coveringInstanceId && !coverRole)}
        hidden={coverRole === "hidden"}
      />
    </button>
  );
}
