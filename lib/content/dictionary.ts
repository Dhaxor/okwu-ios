// The dictionary (free tool): a compact index of headwords with search by
// Igbo (tone-insensitive, and dot-insensitive for people who type without
// ị ọ ụ ṅ), by dialect form, and by English gloss. Built by
// `bun scripts/content/cli.ts dictionary`; pure search here (dictionary.test.ts).
import { stripDots } from "@/lib/igbo/letters";
import { nfc, stripTones } from "@/lib/igbo/text";

/** One row of the shipped file: kept as an array to stay small. */
export type DictionaryRow = [
  id: string,
  /** Spelling layer (dots, no tone marks). */
  spelling: string,
  /** Fully tone-marked, or "" while tones are pending. */
  toned: string,
  gloss: string,
  /** Part of speech ("" when unknown). */
  pos: string,
  /** AudioId of the headword recording, or "". */
  audio: string,
  /** Dialect forms: [spelling, comma-separated dialect ids]. */
  variants: [string, string][],
  /** Bit flags: 1 reviewed by Okwu, 2 name, 4 affix. */
  flags: number,
];

export interface DictionaryFile {
  version: 1;
  builtAt: string;
  /** Attribution to show with results. */
  credit: string;
  /** Dialect id → display label (as the source writes it). */
  dialects: Record<string, string>;
  rows: DictionaryRow[];
}

export const DICT_REVIEWED = 1;
export const DICT_NAME = 2;
export const DICT_AFFIX = 4;

export interface DictionaryEntry {
  id: string;
  spelling: string;
  toned: string | null;
  gloss: string;
  pos: string | null;
  audio: string | null;
  variants: { spelling: string; dialects: string[] }[];
  reviewed: boolean;
  name: boolean;
  affix: boolean;
}

interface Keyed {
  entry: DictionaryEntry;
  plain: string;
  dotless: string;
  variantPlain: string[];
  variantDotless: string[];
  glossWords: string[];
  glossLower: string;
}

export interface DictionaryIndex {
  credit: string;
  dialects: Record<string, string>;
  size: number;
  /** @internal */
  keyed: Keyed[];
}

/** Lower-case, tone-free, punctuation-light key ("Àkwà!" → "akwa"). */
export function igboKey(text: string): string {
  return nfc(stripTones(nfc(text)).toLowerCase())
    .replace(/[’‘ʼ'`]/gu, "")
    .replace(/[^\p{L}\p{M}\s-]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 1);

export function buildDictionaryIndex(file: DictionaryFile): DictionaryIndex {
  const keyed = file.rows.map(([id, spelling, toned, gloss, pos, audio, variants, flags]) => {
    const entry: DictionaryEntry = {
      id,
      spelling,
      toned: toned || null,
      gloss,
      pos: pos || null,
      audio: audio || null,
      variants: variants.map(([s, d]) => ({ spelling: s, dialects: d ? d.split(",") : [] })),
      reviewed: (flags & DICT_REVIEWED) !== 0,
      name: (flags & DICT_NAME) !== 0,
      affix: (flags & DICT_AFFIX) !== 0,
    };
    const plain = igboKey(spelling);
    const variantPlain = variants.map(([s]) => igboKey(s));
    return {
      entry,
      plain,
      dotless: stripDots(plain),
      variantPlain,
      variantDotless: variantPlain.map(stripDots),
      glossWords: wordsOf(gloss),
      glossLower: gloss.toLowerCase(),
    };
  });
  return { credit: file.credit, dialects: file.dialects, size: keyed.length, keyed };
}

export type MatchKind = "headword" | "headword-prefix" | "without-dots" | "dialect-form" | "english";

export interface DictionaryHit {
  entry: DictionaryEntry;
  match: MatchKind;
  /** For dialect-form matches: the form that matched. */
  form?: string;
  score: number;
}

const DOTTED = /[ịọụṅ]/u;

/**
 * Search the dictionary. Igbo matches ignore case and tone marks; when the
 * query has no dots, dotted words match too (kedu → kedụ). English matches
 * whole words of the gloss first, then word starts. Results are ranked:
 * exact headword, without dots, headword prefix, dialect form, English.
 */
export function searchDictionary(index: DictionaryIndex, query: string, opts: { limit?: number } = {}): DictionaryHit[] {
  const limit = opts.limit ?? 20;
  const q = igboKey(query);
  if (!q) return [];
  const qDotless = stripDots(q);
  const igboOnly = DOTTED.test(q);
  const qWords = wordsOf(query);
  const hits: DictionaryHit[] = [];
  for (const k of index.keyed) {
    let best: DictionaryHit | null = null;
    const offer = (h: DictionaryHit) => {
      if (!best || h.score > best.score) best = h;
    };
    if (k.plain === q) offer({ entry: k.entry, match: "headword", score: 100 });
    else if (!igboOnly && k.dotless === qDotless) offer({ entry: k.entry, match: "without-dots", score: 90 });
    else if (k.plain.startsWith(q) || (!igboOnly && k.dotless.startsWith(qDotless))) offer({ entry: k.entry, match: "headword-prefix", score: 70 - Math.min(20, k.plain.length - q.length) });
    k.variantPlain.forEach((v, i) => {
      if (v === q || (!igboOnly && k.variantDotless[i] === qDotless)) {
        offer({ entry: k.entry, match: "dialect-form", form: k.entry.variants[i]?.spelling ?? v, score: v === q ? 60 : 55 });
      }
    });
    if (!igboOnly && qWords.length > 0) {
      const all = qWords.every((w) => k.glossWords.includes(w));
      if (all) {
        const first = k.glossWords.indexOf(qWords[0] as string);
        offer({ entry: k.entry, match: "english", score: 50 - Math.min(20, first) });
      } else if (qWords.every((w) => k.glossWords.some((g) => g.startsWith(w)))) {
        offer({ entry: k.entry, match: "english", score: 25 });
      }
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => b.score - a.score || a.entry.spelling.length - b.entry.spelling.length || (a.entry.id < b.entry.id ? -1 : 1));
  return hits.slice(0, limit);
}
