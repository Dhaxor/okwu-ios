// The phrasebook's pure logic (phrasebook.test.ts): an index over the
// shipped file, the phrases of a situation, and search that ignores tone
// marks and dots ("daalu" finds Daalụ, "Dàálụ́" finds it too), or matches
// the English ("thank you", "market").
import { stripDots } from "@/lib/igbo/letters";
import { nfc } from "@/lib/igbo/text";
import { igboKey } from "@/lib/content/dictionary";
import type { Phrase, PhrasebookFile, SituationId } from "./types";

export interface SituationSummary {
  id: SituationId;
  title: string;
  blurb: string;
  count: number;
}

interface Keyed {
  phrase: Phrase;
  /** Tone-free, lower-case Igbo with dots ("daalụ nke ukwuu"). */
  plain: string;
  /** The same without dots ("daalu nke ukwuu"). */
  dotless: string;
  enLower: string;
  enWords: string[];
}

export interface PhrasebookIndex {
  credit: string;
  situations: SituationSummary[];
  size: number;
  /** @internal */
  keyed: Keyed[];
  /** @internal */
  byId: Map<string, Keyed>;
}

const enWordsOf = (s: string) => s.toLowerCase().split(/[^a-z']+/).filter(Boolean);

export function buildPhrasebookIndex(file: PhrasebookFile): PhrasebookIndex {
  const keyed: Keyed[] = [];
  for (const s of file.situations) {
    for (const [id, igbo, en, audio] of s.phrases) {
      const phrase: Phrase = { id, igbo: nfc(igbo), en, audio: audio || null, situation: s.id };
      const plain = igboKey(phrase.igbo);
      keyed.push({ phrase, plain, dotless: stripDots(plain), enLower: en.toLowerCase(), enWords: enWordsOf(en) });
    }
  }
  return {
    credit: file.credit,
    situations: file.situations.map((s) => ({ id: s.id, title: s.title, blurb: s.blurb, count: s.phrases.length })),
    size: keyed.length,
    keyed,
    byId: new Map(keyed.map((k) => [k.phrase.id, k])),
  };
}

export function phrasesOf(index: PhrasebookIndex, situation: SituationId): Phrase[] {
  return index.keyed.filter((k) => k.phrase.situation === situation).map((k) => k.phrase);
}

export function phraseById(index: PhrasebookIndex, id: string): Phrase | null {
  return index.byId.get(id)?.phrase ?? null;
}

export function situationOf(index: PhrasebookIndex, id: string): SituationSummary | null {
  return index.situations.find((s) => s.id === id) ?? null;
}

export type PhraseMatch = "igbo" | "igbo-without-dots" | "english";

export interface PhraseHit {
  phrase: Phrase;
  match: PhraseMatch;
  score: number;
}

const DOTTED = /[ịọụṅ]/u;
/** Whole-word (or word-start) containment of a key inside a phrase key. */
const startsWord = (hay: string, needle: string) => hay.startsWith(needle) || hay.includes(` ${needle}`);

/**
 * Search the phrasebook. Igbo ignores case, tone marks and punctuation; when
 * the query has no dots, dotted letters match too ("ahia" finds ahịa). A
 * query with dots matches only phrases with those dots. English matches when
 * every query word starts a word of the gloss. Results: whole Igbo phrase or
 * word starts first, then inside a word, then English; shorter phrases first.
 */
export function searchPhrases(index: PhrasebookIndex, query: string, opts: { limit?: number } = {}): PhraseHit[] {
  const limit = opts.limit ?? 60;
  const q = igboKey(query);
  if (!q) return [];
  const qDotless = stripDots(q);
  const igboOnly = DOTTED.test(q);
  const qWords = enWordsOf(query);
  const hits: PhraseHit[] = [];
  for (const k of index.keyed) {
    let best: PhraseHit | null = null;
    const offer = (h: PhraseHit) => {
      if (!best || h.score > best.score) best = h;
    };
    if (k.plain.includes(q)) offer({ phrase: k.phrase, match: "igbo", score: startsWord(k.plain, q) ? 100 : 80 });
    else if (!igboOnly && k.dotless.includes(qDotless)) offer({ phrase: k.phrase, match: "igbo-without-dots", score: startsWord(k.dotless, qDotless) ? 90 : 70 });
    if (!igboOnly && qWords.length > 0) {
      const whole = qWords.every((w) => k.enWords.includes(w));
      const prefix = whole || qWords.every((w) => k.enWords.some((e) => e.startsWith(w)));
      if (whole && k.enLower.includes(qWords.join(" "))) offer({ phrase: k.phrase, match: "english", score: 60 });
      else if (whole) offer({ phrase: k.phrase, match: "english", score: 50 });
      else if (prefix) offer({ phrase: k.phrase, match: "english", score: 40 });
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => b.score - a.score || a.phrase.igbo.length - b.phrase.igbo.length || (a.phrase.id < b.phrase.id ? -1 : 1));
  return hits.slice(0, limit);
}

/** Starting points for an empty search: English words, and Igbo typed without its dots. */
export const PHRASE_SUGGESTIONS: readonly string[] = ["thank you", "how much", "welcome", "daalu", "help", "tomorrow", "kedu", "food"];

/** The text "Copy" puts on the clipboard: the Igbo, then the English. */
export function copyTextOf(phrase: Pick<Phrase, "igbo" | "en">): string {
  return `${nfc(phrase.igbo)}\n${phrase.en}`;
}

/**
 * Dictionary lookups for the words of a phrase: each word without its
 * punctuation, in order, without repeats ("Biko, nye m ohere." → biko, nye,
 * m, ohere). Single letters are left out (pronouns are not worth a page).
 */
export function wordsOfPhrase(igbo: string): string[] {
  const out: string[] = [];
  for (const raw of nfc(igbo).split(/\s+/u)) {
    // "n'ahịa" looks up "ahịa": the preposition n' is written onto the next word.
    const w = raw.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, "").replace(/^[nN]['’]/u, "");
    if ([...w].length < 2) continue;
    if (!out.some((o) => o.toLowerCase() === w.toLowerCase())) out.push(w);
  }
  return out;
}
