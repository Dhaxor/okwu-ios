// The dictionary's word pages: what a headword row (./dictionary) does not
// carry. Each regional form's own recording, the headword's word class as
// the source names it, and up to two example sentences that have their own
// recording. Built by `bun scripts/content/word-details.ts` from the Igbo
// API import into ./generated/wordDetails.json (aligned with
// ./generated/dictionary.json row by row); loaded lazily with
// `loadWordDetails()` from ./index. Pure here (wordDetails.test.ts).

/**
 * One headword: [variant audio aligned with the row's variants ("" = none),
 * examples, word class]. Audio ids are packed (see `packAudioId`).
 */
export type WordDetailsRow = [variantAudio: string[], examples: [igbo: string, english: string, audio: string][], wordClass: string];

const HEADWORD_PREFIX = "ia.w.";

/**
 * Packed AudioIds, to keep the file small: "ia_" (the main dataset) is
 * dropped, and a regional recording named after its headword
 * ("ia_<headword>-<suffix>", nearly all of them) is written "~<suffix>".
 * Other ids ("iax_…") are kept whole.
 */
export function packAudioId(id: string, headwordId: string): string {
  if (!id) return "";
  const own = `ia_${headwordId.startsWith(HEADWORD_PREFIX) ? headwordId.slice(HEADWORD_PREFIX.length) : headwordId}-`;
  if (id.startsWith(own)) return `~${id.slice(own.length)}`;
  return id.startsWith("ia_") ? id.slice(3) : id;
}

export function unpackAudioId(packed: string, headwordId: string): string | null {
  if (!packed) return null;
  if (packed.startsWith("~")) return `ia_${headwordId.startsWith(HEADWORD_PREFIX) ? headwordId.slice(HEADWORD_PREFIX.length) : headwordId}-${packed.slice(1)}`;
  return packed.startsWith("iax_") || packed.startsWith("ia_") ? packed : `ia_${packed}`;
}

export interface WordDetailsFile {
  version: 1;
  builtAt: string;
  /** Examples kept per headword (the shortest with a recording). */
  examplesPerEntry: number;
  /** Headword id → details; headwords with nothing to add are left out. */
  entries: Record<string, WordDetailsRow>;
}

export interface WordExample {
  /** NFC Igbo as the source writes it (spelling layer). */
  igbo: string;
  en: string;
  /** AudioId of the sentence's recording, or null. */
  audio: string | null;
}

export interface WordDetails {
  /** One AudioId (or null) per variant of the dictionary row, in the row's order. */
  variantAudio: (string | null)[];
  examples: WordExample[];
  /** The source's word class ("Proper noun", "Active verb", …), or null. */
  wordClass: string | null;
}

export const NO_DETAILS: WordDetails = { variantAudio: [], examples: [], wordClass: null };

/** The details of one headword; empty (never null) when the file has nothing for it. */
export function wordDetailsOf(file: Pick<WordDetailsFile, "entries"> | null, id: string): WordDetails {
  const row = file?.entries[id];
  if (!row) return NO_DETAILS;
  const [audio, examples, wordClass] = row;
  return {
    variantAudio: audio.map((a) => unpackAudioId(a, id)),
    examples: examples.map(([igbo, en, a]) => ({ igbo: igbo.normalize("NFC"), en, audio: unpackAudioId(a, id) })),
    wordClass: wordClass || null,
  };
}
