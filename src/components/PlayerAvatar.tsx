"use client";

export function PlayerAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[0.7rem]" : "h-9 w-9 text-sm";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={`${dim} shrink-0 rounded-full object-cover ring-1 ring-[#3a3324]`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-[#2a2418] font-[family-name:var(--font-display)] text-[#e6dcc4] ring-1 ring-[#3a3324]`}
    >
      {initial}
    </span>
  );
}
