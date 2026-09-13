"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DEITIES,
  DEITY_META,
  SCORING_TABLES,
  type Deity,
} from "@/game";
import { DeityMark } from "./DeityMarks";

const LOW = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const HIGH = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
const ALL = [...LOW, ...HIGH] as const;

function countBands(layout: "stack" | "wide") {
  return layout === "wide" ? ([ALL] as const) : ([LOW, HIGH] as const);
}

export function ScoringTable({
  deity,
  wide = false,
}: {
  deity: Deity;
  wide?: boolean;
}) {
  const table = SCORING_TABLES[deity];
  const meta = DEITY_META[deity];
  const bands = countBands(wide ? "wide" : "stack");
  return (
    <div className="min-w-0 overflow-hidden">
      <p
        className="mb-2 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.18em]"
        style={{ color: meta.color }}
      >
        <span className="inline-block h-6 w-5 shrink-0">
          <DeityMark deity={deity} />
        </span>
        {meta.short} scoring
      </p>
      <div className="grid gap-3">
        {bands.map((counts) => (
          <div key={counts[0]} className="min-w-0 overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-center text-[0.6rem] tabular-nums">
              <thead>
                <tr className="text-[#9a917c]">
                  <th className="w-6 pb-1 font-normal" />
                  {counts.map((n) => (
                    <th key={n} className="pb-1 font-normal">
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEITIES.map((journalDeity) => {
                  const curve = table[journalDeity];
                  const journal = DEITY_META[journalDeity];
                  return (
                    <tr key={journalDeity}>
                      <th
                        className="py-0.5"
                        scope="row"
                        aria-label={journal.short}
                        style={{
                          background: `color-mix(in srgb, ${journal.color} 32%, transparent)`,
                        }}
                      >
                        <span className="mx-auto block h-4 w-3.5">
                          <DeityMark deity={journalDeity} />
                        </span>
                      </th>
                      {counts.map((n) => (
                        <td
                          key={n}
                          className="px-0 py-0.5 text-[#e6dcc4]"
                          style={{
                            background: `color-mix(in srgb, ${journal.color} 32%, transparent)`,
                          }}
                        >
                          {curve[Math.min(n, curve.length - 1)]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoringStrategyChip({
  deity,
  align = "left",
}: {
  deity: Deity;
  align?: "left" | "center";
}) {
  const meta = DEITY_META[deity];
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPinned(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPinned(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setPinned((current) => !current)}
        className="flex items-center gap-1.5 rounded-sm border border-[#3a3324] px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-[#e6dcc4]"
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: meta.color }}
        />
        Scoring · {meta.short}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={`${meta.short} scoring card`}
          className={`ritual-panel absolute top-full z-50 mt-1 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md p-3 shadow-[0_8px_28px_rgba(0,0,0,0.55)] ${
            align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
          }`}
        >
          <ScoringTable deity={deity} />
        </div>
      ) : null}
    </div>
  );
}

function ScoringGallery({
  selected,
  onSelect,
  onClose,
}: {
  selected: Deity | "random";
  onSelect: (deity: Deity) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/80 p-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="All scoring cards"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-6xl space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-[0.16em] uppercase">
            Scoring cards
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-[#3a3324] px-3 py-1 text-[0.7rem] uppercase tracking-wider text-[#e6dcc4]"
          >
            Close
          </button>
        </div>
        <div className="grid gap-4">
          {DEITIES.map((deity) => (
            <button
              key={deity}
              type="button"
              onClick={() => {
                onSelect(deity);
                onClose();
              }}
              className={`ritual-panel rounded-md p-4 text-left ${
                selected === deity ? "ring-2 ring-[#e6dcc4]" : ""
              }`}
            >
              <ScoringTable deity={deity} wide />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScoringStrategyPicker({
  value,
  onChange,
}: {
  value: Deity | "random";
  onChange: (value: Deity | "random") => void;
}) {
  const [gallery, setGallery] = useState(false);
  return (
    <div className="mt-3 min-w-0">
      <p className="text-xs uppercase tracking-wider text-[#9a917c]">Scoring card</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DEITIES.map((deity) => (
          <button
            key={deity}
            type="button"
            onClick={() => onChange(deity)}
            className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-[0.7rem] uppercase tracking-wider ${
              value === deity
                ? "ring-2 ring-[#e6dcc4]"
                : "border border-[#3a3324]"
            }`}
            style={
              value === deity
                ? { background: DEITY_META[deity].color, color: DEITY_META[deity].ink }
                : undefined
            }
          >
            <span className="inline-block h-4 w-3.5">
              <DeityMark deity={deity} />
            </span>
            {DEITY_META[deity].short}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("random")}
          className={`rounded-sm px-2 py-1 text-[0.7rem] uppercase tracking-wider ${
            value === "random"
              ? "bg-[#c9a227] text-[#14110b]"
              : "border border-[#3a3324] text-[#9a917c]"
          }`}
        >
          Random
        </button>
      </div>
      <p className="mt-2 text-[0.7rem] text-[#9a917c]">
        {value === "random"
          ? "A scoring card will be drawn when the circle opens."
          : `This circle scores with ${DEITY_META[value].short}.`}
      </p>
      <div className="mt-3 min-w-0 overflow-hidden rounded-md border border-[#3a3324] p-3">
        {value === "random" ? (
          <p className="text-sm text-[#9a917c]">
            Pick a color to preview its table, or open the full set.
          </p>
        ) : (
          <ScoringTable deity={value} />
        )}
        <button
          type="button"
          onClick={() => setGallery(true)}
          className="mt-3 w-full rounded-sm border border-[#c9a227] px-3 py-2 text-[0.7rem] uppercase tracking-[0.16em] text-[#c9a227]"
        >
          Compare all cards
        </button>
      </div>
      {gallery ? (
        <ScoringGallery
          selected={value}
          onSelect={onChange}
          onClose={() => setGallery(false)}
        />
      ) : null}
    </div>
  );
}
