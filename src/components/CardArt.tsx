"use client";

import { DEITY_META, cardDeities, isDual } from "@/game";

const CARD_SHELL =
  "relative overflow-hidden rounded-[0.35rem] border shadow-[2px_3px_0_rgba(0,0,0,0.45)]";

export function CardBack({
  className = "",
  count,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <div
      className={`${CARD_SHELL} aspect-[5/7] w-full border-[#c9a227]/50 ${className}`}
      style={{
        background:
          "radial-gradient(circle at 50% 40%, #2a2418 0%, #14110b 62%, #0c100d 100%)",
      }}
    >
      <div
        className="absolute inset-[9%] rounded-[0.2rem] border border-[#c9a227]/35"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 6px,
            rgba(201, 162, 39, 0.06) 6px,
            rgba(201, 162, 39, 0.06) 7px
          )`,
        }}
      />
      <svg viewBox="0 0 40 40" className="absolute inset-[22%] fill-none">
        <polygon
          points="20,3 24,15 37,15 26,22 30,35 20,27 10,35 14,22 3,15 16,15"
          stroke="#c9a227"
          strokeWidth="1.2"
        />
      </svg>
      {count != null ? (
        <span className="absolute bottom-1 left-0 right-0 text-center text-[0.6rem] font-semibold tracking-wider text-[#c9a227]">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export function CardFace({
  cardId,
  assignedDeity,
  desecration,
  covering,
  hidden,
  className = "",
}: {
  cardId: string;
  assignedDeity?: string;
  desecration?: boolean;
  covering?: boolean;
  hidden?: boolean;
  className?: string;
}) {
  const deities = cardDeities(cardId);
  const dual = isDual(cardId);
  const a = DEITY_META[deities[0]!];
  const b = deities[1] ? DEITY_META[deities[1]] : a;
  const background = dual
    ? `linear-gradient(to right, ${a.color} 0 50%, ${b.color} 50% 100%)`
    : `linear-gradient(165deg, ${a.color} 0%, ${a.color} 55%, #1a140c 140%)`;

  return (
    <div
      className={`${CARD_SHELL} aspect-[5/7] w-full border-[#e6dcc4]/40 ${className}`}
      style={{ background }}
    >
      <div className="absolute inset-[7%] rounded-[0.15rem] border border-black/25 bg-black/10" />
      <div className="absolute left-1.5 top-1.5 flex gap-0.5">
        {deities.map((deity) => (
          <span
            key={deity}
            className="h-2 w-2 rounded-[1px] border border-black/40"
            style={{ background: DEITY_META[deity].color }}
          />
        ))}
      </div>
      <p
        className="absolute bottom-1.5 left-1 right-1 text-center font-[family-name:var(--font-display)] text-[0.62rem] font-semibold uppercase leading-tight tracking-wide"
        style={{
          color: dual ? "#14110b" : a.ink,
          textShadow: dual ? "0 0 4px rgba(230,220,196,0.7)" : undefined,
        }}
      >
        {deities.map((deity) => DEITY_META[deity].short).join(" / ")}
      </p>
      {assignedDeity ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-sm border border-black/50 bg-black/30" />
      ) : null}
      {desecration ? (
        <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#8f2d2d] bg-[#c43c3c]" />
      ) : null}
      {covering ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0c100d]/50 to-transparent" />
      ) : null}
      {hidden ? (
        <>
          <span className="absolute inset-0 bg-[#0c100d]/45" />
          <span
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `repeating-linear-gradient(
                -18deg,
                transparent,
                transparent 5px,
                rgba(12, 16, 13, 0.7) 5px,
                rgba(12, 16, 13, 0.7) 7px
              )`,
            }}
          />
        </>
      ) : null}
    </div>
  );
}

export function EmptyCardSlot({ className = "" }: { className?: string }) {
  return (
    <div
      className={`aspect-[5/7] w-full rounded-[0.35rem] border border-dashed border-[#3a3324] bg-[#0c100d]/40 ${className}`}
    />
  );
}
