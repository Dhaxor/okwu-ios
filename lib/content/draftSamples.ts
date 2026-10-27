// DRAFT — pending native review. Development placeholders only.
//
// The shell and the kitchen sink need a little Igbo to show the type and the
// pitch line. Every string here is copied from docs/RESEARCH.md or
// docs/PLAN.md (the tone minimal set, the market days, motif names); none is
// AI-authored. They must not ship: real content comes from the content
// pipeline with two native reviewers (docs/CONTRACTS.md §1). Screens that
// show these render a DraftTag.
import type { ToneLevel } from "@/components/art/geometry";

export const DRAFT_NOTICE = "Draft · pending native review";

export interface DraftWord {
  text: string;
  gloss: string;
  tones: ToneLevel[];
  syllables: string[];
}

/** RESEARCH §3: àkwà bed, ákwà cloth, àkwá egg, ákwá cry. */
export const TONE_SET: readonly DraftWord[] = [
  { text: "àkwà", gloss: "bed", tones: ["L", "L"], syllables: ["à", "kwà"] },
  { text: "ákwà", gloss: "cloth", tones: ["H", "L"], syllables: ["á", "kwà"] },
  { text: "àkwá", gloss: "egg", tones: ["L", "H"], syllables: ["à", "kwá"] },
  { text: "ákwá", gloss: "cry", tones: ["H", "H"], syllables: ["á", "kwá"] },
];

/** PLAN §Free tools: the four market days of the izu. */
export const MARKET_DAYS = ["Eke", "Orie", "Afọ", "Nkwọ"] as const;

/** RESEARCH §3: the harmony example ("Kedụ ka i mere", not "ka ị mere"). */
export const HARMONY_EXAMPLE = "Kedụ ka i mere";

/** Motif names from PLAN (all still to be confirmed by native speakers). */
export const MOTIF_NAMES = {
  hometown: "Obodo",
  guide: "Nnenne",
  chain: "Izu",
  garden: "Ubi",
  proverbs: "Ilu",
  names: "Aha",
  stories: "Akụkọ",
  cohort: "Ọgbọ",
  club: "Otu",
} as const;
