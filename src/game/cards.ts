import { CARD_COLORS } from "./card-colors";
import type { Deity, ManuscriptCard } from "./types";

export const COLOR_DEITY = {
  yellow: "kingInYellow",
  red: "shubNiggurath",
  green: "cthulhu",
  purple: "yidhra",
  blue: "nyarlathotep",
} as const;

export type InkColor = keyof typeof COLOR_DEITY;

export function deitiesFromColorSpec(spec: string): Deity[] {
  return spec.split("-").map((part) => {
    const deity = COLOR_DEITY[part as InkColor];
    if (!deity) throw new Error(`Unknown color ${part}`);
    return deity;
  });
}

export function cardColorSpec(cardId: string): string {
  const spec = CARD_COLORS[Number(cardId) as keyof typeof CARD_COLORS];
  if (!spec) throw new Error(`Unknown card ${cardId}`);
  return spec;
}

export const DEITY_META: Record<
  Deity,
  { name: string; color: string; ink: string; short: string }
> = {
  kingInYellow: {
    name: "The King in Yellow",
    color: "#e4c441",
    ink: "#2a2208",
    short: "Yellow",
  },
  shubNiggurath: {
    name: "Shub-Niggurath",
    color: "#c43c3c",
    ink: "#2a0c0c",
    short: "Red",
  },
  cthulhu: {
    name: "Cthulhu",
    color: "#2f8f5b",
    ink: "#07150e",
    short: "Green",
  },
  yidhra: {
    name: "Yidhra",
    color: "#8b5cf6",
    ink: "#1a0d33",
    short: "Purple",
  },
  nyarlathotep: {
    name: "Nyarlathotep",
    color: "#3b82f6",
    ink: "#071225",
    short: "Blue",
  },
};

export function formatDeityList(deities: Deity[]): string {
  const names = deities.map((deity) => DEITY_META[deity].short);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export const GIFTS: Record<
  Deity,
  {
    gift: { id: string; name: string; text: string };
    blessed: { id: string; name: string; text: string };
  }
> = {
  kingInYellow: {
    gift: {
      id: "telepathy",
      name: "Telepathy",
      text: "Peek at a face-down pile top, then return it.",
    },
    blessed: {
      id: "memoryDistortion",
      name: "Memory Distortion",
      text: "Peek at two pile tops, then put both back face-down in any order.",
    },
  },
  cthulhu: {
    gift: {
      id: "mistOfRlyeh",
      name: "Mist of R'lyeh",
      text: "Cover another card you drew this sacrifice.",
    },
    blessed: {
      id: "mindControl",
      name: "Mind Control",
      text: "Cover another card you drew this sacrifice (token optional), then activate its gift.",
    },
  },
  nyarlathotep: {
    gift: {
      id: "unfairTrade",
      name: "Unfair Trade",
      text: "A chosen researcher gives you a journal card; you give them one of yours.",
    },
    blessed: {
      id: "whisper",
      name: "Whisper of the Trickster",
      text: "Take a journal card from another researcher, then give them one of yours.",
    },
  },
  yidhra: {
    gift: {
      id: "mentalDefilement",
      name: "Mental Defilement",
      text: "Give a desecration token to another researcher who has none.",
    },
    blessed: {
      id: "madnessUnleashed",
      name: "Madness Unleashed",
      text: "Give a desecration token to every other researcher who has none.",
    },
  },
  shubNiggurath: {
    gift: {
      id: "brooding",
      name: "Brooding",
      text: "Draw a face-down pile top into your omen zone, then interpret omens.",
    },
    blessed: {
      id: "darkYoung",
      name: "Dark Young",
      text: "Draw a face-down pile top directly into your research journal.",
    },
  },
};

export const CATALOG: Record<string, ManuscriptCard> = Object.fromEntries(
  buildCatalog().map((card) => [card.id, card]),
);

export const ALL_CARD_IDS = Object.keys(CATALOG);

export function buildCatalog(): ManuscriptCard[] {
  return Object.entries(CARD_COLORS).map(([id, spec]) => ({
    id,
    deities: deitiesFromColorSpec(spec),
  }));
}

export function cardDeities(cardId: string): Deity[] {
  const card = CATALOG[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  return card.deities;
}

export function isDual(cardId: string): boolean {
  return cardDeities(cardId).length === 2;
}

export function emptyJournal(): Record<Deity, import("./types").CardInstance[]> {
  return {
    kingInYellow: [],
    shubNiggurath: [],
    cthulhu: [],
    yidhra: [],
    nyarlathotep: [],
  };
}

export function emptyMad(): Record<Deity, boolean> {
  return {
    kingInYellow: false,
    shubNiggurath: false,
    cthulhu: false,
    yidhra: false,
    nyarlathotep: false,
  };
}

export function desecrationTokensForPlayerCount(playerCount: number): number {
  return playerCount;
}
