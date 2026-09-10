"use client";

/** Always-visible chip so you can scan who holds the desecration token. */
export function DesecrationBadge({ held }: { held: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider"
      title={held ? "Holds a desecration token" : "No desecration token"}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full border-2"
        style={
          held
            ? {
                background: "#c43c3c",
                borderColor: "#8f2d2d",
                boxShadow: "0 0 8px #c43c3c",
              }
            : {
                background: "transparent",
                borderColor: "#3a3324",
              }
        }
      />
      <span className={held ? "text-[#c43c3c]" : "text-[#5a5348]"}>
        Desecration
      </span>
    </span>
  );
}
