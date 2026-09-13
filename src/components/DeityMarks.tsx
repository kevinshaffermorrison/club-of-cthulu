"use client";

import type { ReactNode } from "react";
import { DEITY_META, type Deity } from "@/game";

function MarkSvg({
  ink,
  accent,
  children,
}: {
  ink: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 40 48"
      className="h-full w-full"
      aria-hidden
      fill={ink}
      stroke={ink}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {children}
      <desc>{accent}</desc>
    </svg>
  );
}

export function DeityMark({ deity }: { deity: Deity }) {
  const { color, ink } = DEITY_META[deity];

  if (deity === "kingInYellow") {
    return (
      <MarkSvg ink={ink} accent="King in Yellow">
        <path d="M6 17 L11 7 L16 15 L20 4 L24 15 L29 7 L34 17 Z" strokeWidth="0" />
        <rect x="10" y="16" width="20" height="22" rx="1.5" strokeWidth="0" />
        <rect x="14" y="22" width="4.2" height="5.5" fill={color} strokeWidth="0" />
        <rect x="21.8" y="22" width="4.2" height="5.5" fill={color} strokeWidth="0" />
        <rect x="16.5" y="31" width="7" height="2" fill={color} strokeWidth="0" />
        <rect x="18.5" y="38" width="3" height="6" strokeWidth="0" />
      </MarkSvg>
    );
  }

  if (deity === "shubNiggurath") {
    return (
      <MarkSvg ink={ink} accent="Shub-Niggurath">
        <path
          d="M13 18 Q5 10 9 3"
          fill="none"
          strokeWidth="3.2"
        />
        <path
          d="M27 18 Q35 10 31 3"
          fill="none"
          strokeWidth="3.2"
        />
        <polygon points="20,11 33,24 20,42 7,24" strokeWidth="0" />
        <polygon points="8,18 13,14 14,22" strokeWidth="0" />
        <polygon points="32,18 27,14 26,22" strokeWidth="0" />
        <circle cx="16.5" cy="23" r="1.7" fill={color} strokeWidth="0" />
        <circle cx="23.5" cy="23" r="1.7" fill={color} strokeWidth="0" />
        <polygon points="20,27 22.5,32 20,34 17.5,32" fill={color} strokeWidth="0" />
      </MarkSvg>
    );
  }

  if (deity === "cthulhu") {
    return (
      <MarkSvg ink={ink} accent="Cthulhu">
        <polygon points="2,22 17,14 17,34" strokeWidth="0" />
        <polygon points="38,22 23,14 23,34" strokeWidth="0" />
        <ellipse cx="20" cy="17" rx="8.5" ry="9" strokeWidth="0" />
        <circle cx="16.5" cy="16" r="1.8" fill={color} strokeWidth="0" />
        <circle cx="23.5" cy="16" r="1.8" fill={color} strokeWidth="0" />
        <path
          d="M13 25 Q10 34 8 45"
          fill="none"
          strokeWidth="2.4"
        />
        <path
          d="M17 26 Q15 36 14 46"
          fill="none"
          strokeWidth="2.4"
        />
        <path
          d="M20 26 Q20 36 20 46"
          fill="none"
          strokeWidth="2.4"
        />
        <path
          d="M23 26 Q25 36 26 46"
          fill="none"
          strokeWidth="2.4"
        />
        <path
          d="M27 25 Q30 34 32 45"
          fill="none"
          strokeWidth="2.4"
        />
      </MarkSvg>
    );
  }

  if (deity === "yidhra") {
    return (
      <MarkSvg ink={ink} accent="Yidhra">
        <path
          d="M30 8 A13 13 0 1 0 30 36 A8.5 13 0 1 1 30 8"
          strokeWidth="0"
        />
        <polygon points="20,16 26,22 20,28 14,22" strokeWidth="0" />
        <polygon points="20,19 22.4,22 20,25 17.6,22" fill={color} strokeWidth="0" />
        <path
          d="M20 28 Q30 33 22 40 Q12 46 22 48"
          fill="none"
          strokeWidth="2.6"
        />
        <path
          d="M16 30 Q8 36 14 44"
          fill="none"
          strokeWidth="2"
        />
      </MarkSvg>
    );
  }

  return (
    <MarkSvg ink={ink} accent="Nyarlathotep">
      <polygon points="7,8 33,8 38,28 4,28" strokeWidth="0" />
      <polygon points="19,8 21,8 24,28 16,28" fill={color} strokeWidth="0" />
      <rect x="13" y="14" width="14" height="16" rx="3" strokeWidth="0" />
      <rect x="16" y="18" width="3.2" height="3.6" fill={color} strokeWidth="0" />
      <rect x="20.8" y="18" width="3.2" height="3.6" fill={color} strokeWidth="0" />
      <rect x="17.5" y="24.5" width="5" height="1.6" fill={color} strokeWidth="0" />
      <polygon points="17,30 23,30 21.5,44 18.5,44" strokeWidth="0" />
    </MarkSvg>
  );
}
