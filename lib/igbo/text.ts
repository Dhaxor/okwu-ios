// Igbo text primitives: normalisation, grapheme clusters and tone marks.
//
// Spelling follows the 1961 Ọnwụ orthography (Standard Igbo / Igbo Izugbe):
// 36 letters with dotted ị ọ ụ ṅ. Tone is marked with combining accents:
//   acute  U+0301  high
//   grave  U+0300  low
//   macron U+0304  downstepped high
// A dotted vowel with a tone mark (ị́ ọ̀ ụ̄) has NO precomposed code point,
// so it is always two code points after NFC. Every string the app stores,
// compares or renders goes through `nfc` first, and length limits count
// grapheme clusters, never UTF-16 units.
//
// Pure TypeScript: no react-native import, tested by bun (text.test.ts).

/** Combining tone marks, keyed by the tone they write. */
export const TONE_MARK = {
  high: "́",
  low: "̀",
  downstep: "̄",
} as const;

export type ToneName = keyof typeof TONE_MARK;

const TONE_BY_MARK: Record<string, ToneName> = {
  "́": "high",
  "̀": "low",
  "̄": "downstep",
};

export const DOT_BELOW = "̣";
export const DOT_ABOVE = "̇";

/** The 36 letters of the Ọnwụ alphabet, in alphabetical order (lower case). */
export const IGBO_LETTERS = [
  "a", "b", "ch", "d", "e", "f", "g", "gb", "gh", "gw", "h", "i", "ị", "j", "k", "kp", "kw", "l",
  "m", "n", "ṅ", "nw", "ny", "o", "ọ", "p", "r", "s", "sh", "t", "u", "ụ", "v", "w", "y", "z",
] as const;

/** The four letters an English keyboard lacks, which the key strip offers. */
export const DOTTED_LETTERS = ["ị", "ọ", "ụ", "ṅ"] as const;

/** Vowels (tone-bearing). */
export const IGBO_VOWELS = ["a", "e", "i", "ị", "o", "ọ", "u", "ụ"] as const;

/**
 * Characters people type for an Igbo letter by mistake, mapped to the letter
 * they meant. For the content linter and for gentle input hints; never
 * auto-applied to a learner's answer.
 */
export const LOOKALIKES: Readonly<Record<string, string>> = {
  "ñ": "ṅ", // ñ (Spanish keyboard)
  "Ñ": "Ṅ",
  "ŋ": "ṅ", // ŋ (Africanist orthographies, not Ọnwụ)
  "Ŋ": "Ṅ",
  "i̩": "ị", // vertical line below (older typewriter practice)
  "o̩": "ọ",
  "u̩": "ụ",
  "i̱": "ị", // macron below
  "o̱": "ọ",
  "u̱": "ụ",
};

/** Canonical composition. Use on every Igbo string at every boundary. */
export function nfc(text: string): string {
  return text.normalize("NFC");
}

/** Canonical decomposition (base letters then marks in canonical order). */
export function nfd(text: string): string {
  return text.normalize("NFD");
}

/** True for a combining mark (the blocks Latin text uses). */
export function isCombining(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe20 && cp <= 0xfe2f)
  );
}

/**
 * Split into user-perceived letters: a base code point plus the combining
 * marks after it. Enough for Latin-script Igbo; it does not join emoji ZWJ
 * sequences (Hermes has no Intl.Segmenter, so this runs everywhere the same).
 */
export function graphemes(text: string): string[] {
  const out: string[] = [];
  for (const ch of Array.from(text)) {
    if (isCombining(ch) && out.length > 0) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** Length in user-perceived letters (use for limits and progress, never `.length`). */
export function graphemeCount(text: string): number {
  return graphemes(nfc(text)).length;
}

/** The base letter of a cluster, lower-cased and without marks ("Ọ̀" → "o"). */
export function baseOf(cluster: string): string {
  const first = Array.from(nfd(cluster))[0] ?? "";
  return first.toLowerCase();
}

/** Can this cluster carry a tone mark? Vowels and the syllabic nasals m, n, ṅ. */
export function isTonable(cluster: string): boolean {
  return "aeioumn".includes(baseOf(cluster)) && baseOf(cluster) !== "";
}

/** The tone written on a cluster, or null when it is unmarked. */
export function toneOf(cluster: string): ToneName | null {
  for (const ch of Array.from(nfd(cluster))) {
    const tone = TONE_BY_MARK[ch];
    if (tone) return tone;
  }
  return null;
}

/** Remove every tone mark, keeping the dots: the spelling layer. */
export function stripTones(text: string): string {
  return nfc(
    Array.from(nfd(text))
      .filter((ch) => !(ch in TONE_BY_MARK))
      .join("")
  );
}

/** Set (or clear, with null) the tone of one cluster. */
export function setTone(cluster: string, tone: ToneName | null): string {
  const kept = Array.from(nfd(cluster)).filter((ch) => !(ch in TONE_BY_MARK));
  return nfc(kept.join("") + (tone ? TONE_MARK[tone] : ""));
}

export interface Selection {
  start: number;
  end: number;
}

export interface EditResult {
  text: string;
  selection: Selection;
  /** False when nothing changed (e.g. a tone tapped after a consonant). */
  applied: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Replace the selection with `insert` and return NFC text with the caret
 * after the insertion. Offsets are UTF-16 units of the returned string, as
 * TextInput reports them.
 */
export function insertAtSelection(text: string, selection: Selection, insert: string): EditResult {
  const start = clamp(Math.min(selection.start, selection.end), 0, text.length);
  const end = clamp(Math.max(selection.start, selection.end), 0, text.length);
  const before = nfc(text.slice(0, start) + insert);
  const next = nfc(before + text.slice(end));
  const caret = clamp(before.length, 0, next.length);
  return { text: next, selection: { start: caret, end: caret }, applied: true };
}

/**
 * The key strip's tone key: put `tone` on the letter just before the caret.
 * Tapping the same tone again removes it; another tone replaces it. Only
 * vowels and syllabic nasals take a tone, so after anything else this
 * changes nothing and reports applied: false (the UI can then hint).
 */
export function applyToneAtCaret(text: string, selection: Selection, tone: ToneName): EditResult {
  const source = nfc(text);
  const caret = clamp(Math.max(selection.start, selection.end), 0, source.length);
  const head = source.slice(0, caret);
  const tail = source.slice(caret);
  const clusters = graphemes(head);
  const target = clusters[clusters.length - 1];
  if (!target || !isTonable(target)) {
    return { text: source, selection: { start: caret, end: caret }, applied: false };
  }
  const nextTone = toneOf(target) === tone ? null : tone;
  const rebuilt = clusters.slice(0, -1).join("") + setTone(target, nextTone);
  const next = nfc(rebuilt + tail);
  const at = clamp(nfc(rebuilt).length, 0, next.length);
  return { text: next, selection: { start: at, end: at }, applied: true };
}

/** Upper-case an Igbo letter or digraph for display (ṅ → Ṅ, gb → Gb when `title`). */
export function upperLetter(letter: string, title = false): string {
  const clusters = graphemes(nfc(letter));
  if (clusters.length === 0) return letter;
  if (title) return nfc((clusters[0] ?? "").toUpperCase() + clusters.slice(1).join(""));
  return nfc(letter.toUpperCase());
}
