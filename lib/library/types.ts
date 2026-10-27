// The Culture and heritage library's compiled data (engineer E2). Built by
// `bun scripts/library/build.ts` from content/library/*.yaml and the Igbo API
// dataset into ./generated/*.json; read through ./index.ts.
//
// Every Igbo string in these files is dataset text (Nkọwa okwu, CC BY 4.0,
// used with permission), NFC, verified verbatim by the build. English that
// is ours (meanings, usage notes, retellings, explainers) is pending
// cultural-advisor review, and the screens say so.
import type { MarketDay } from "@/lib/game/types";

/** A dataset recording: an AudioId ("ia_<stem>" / "iax_<stem>"), played like the dictionary's clips. */
export type ClipId = string;

/** A dataset sentence with its translation and recording. */
export interface LibraryLine {
  igbo: string;
  en: string;
  audio: ClipId | null;
}

/** A dataset headword shown as a word chip: its tone-marked form, a gloss and its recording. */
export interface LibraryWord {
  text: string;
  gloss: string;
  audio: ClipId | null;
}

export type NameTheme = "chi" | "market" | "virtue" | "birth";

export interface NameThemeInfo {
  id: NameTheme;
  title: string;
  blurb: string;
}

export interface LibraryName {
  /** Stable ASCII id (the tone- and dot-free spelling). */
  id: string;
  /** The name as it is usually written: no tone marks, dots kept, a capital. */
  spelling: string;
  /** The dataset's tone-marked form (tones as the dataset marks them, unverified), or null. */
  toned: string | null;
  /** The dataset spelling when `spelling` is an everyday form (Okeke for Okeeke). */
  datasetSpelling: string | null;
  /** The dataset's definition, tidied; null shows "Meaning pending review". */
  meaning: string | null;
  /** The first sense, for lists. */
  short: string | null;
  theme: NameTheme;
  /** The dataset's word class ("Name", "Proper noun", "Noun"), or null for a name attested only in a sentence. */
  wordClass: string | null;
  audio: ClipId | null;
  /** A literal breakdown, each part a dataset headword (pending review). */
  parts: LibraryWord[];
  /** The market day of a market-day name. */
  day: MarketDay | null;
  /** Regional forms from the dataset ("Also said as"). */
  variants: { spelling: string; where: string[]; audio: ClipId | null }[];
  examples: LibraryLine[];
  /** The dictionary's headword id, to open its word page. */
  dictId: string | null;
}

export interface NamesFile {
  version: 1;
  themes: NameThemeInfo[];
  names: LibraryName[];
}

export type ProverbTheme = "words" | "wisdom" | "patience" | "together" | "character" | "generations";

export interface LibraryProverb {
  id: string;
  /** The dataset sentence (an "(ilu)" / "(Proverb)" marker dropped). */
  igbo: string;
  /** The dataset's translation. */
  en: string;
  audio: ClipId;
  theme: ProverbTheme;
  /** Our English draft, pending review; null shows "Meaning pending review". */
  meaning: string | null;
  usage: string | null;
  /** Set when the dataset translation is an English equivalent, not a literal rendering. */
  literalNote: string | null;
  /** Ids of tales and customs that use it. */
  seeAlso: { kind: "tale" | "custom"; id: string; title: string }[];
}

export interface ProverbsFile {
  version: 1;
  themes: { id: ProverbTheme; title: string }[];
  proverbs: LibraryProverb[];
  /** Found in the data but held back for the cultural advisor. */
  heldBack: number;
}

/** Original procedural art for a tale or an explainer (components/feature/library/CultureArt). */
export type CultureMotif =
  | "yam"
  | "calabash"
  | "crescent"
  | "kola"
  | "beads"
  | "road"
  | "steps"
  | "dawn"
  | "spiral"
  | "circle"
  | "feathers"
  | "mosaic"
  | "vine"
  | "kite"
  | "dust"
  | "none";

export type TalePart = { kind: "p"; text: string } | ({ kind: "line" } & LibraryLine);

export interface LibraryTale {
  id: string;
  title: string;
  /** The well-known outline this retells. */
  outline: string;
  told: string;
  motif: CultureMotif;
  minutes: number;
  parts: TalePart[];
  moral: string;
}

export interface TalesFile {
  version: 1;
  tales: LibraryTale[];
}

export type CustomLink = "names" | "calendar";

export interface LibraryCustom {
  id: string;
  /** A dataset Igbo word or phrase naming the custom. */
  kicker: string;
  title: string;
  summary: string;
  motif: CultureMotif;
  sections: { h: string; p: string }[];
  words: LibraryWord[];
  lines: LibraryLine[];
  varies: string;
  links: CustomLink[];
  proverb: string | null;
}

export interface CustomsFile {
  version: 1;
  customs: LibraryCustom[];
}

export interface LibraryMarketDay {
  id: MarketDay;
  spelling: string;
  toned: string;
  audio: ClipId | null;
  label: string;
  about: string;
  today: LibraryLine;
  line: LibraryLine;
  /** Ids into the names book. */
  names: string[];
}

export interface CalendarFile {
  version: 1;
  days: LibraryMarketDay[];
  beliefNote: string;
}

export interface LibraryMeta {
  version: 1;
  builtAt: string;
  counts: { names: number; proverbs: number; tales: number; customs: number; heldBack: number; clips: number };
  credits: string[];
}
