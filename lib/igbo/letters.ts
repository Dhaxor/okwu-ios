// Igbo letters: tokenising text into the 36 letters of the Ọnwụ alphabet,
// dot handling and vowel-harmony sets. Builds on ./text (NFC, graphemes,
// tone marks) and never changes its API.
//
// Pure TypeScript, no react-native import; tested by bun (letters.test.ts).
import { DOT_ABOVE, DOT_BELOW, IGBO_LETTERS, LOOKALIKES, TONE_MARK, graphemes, nfc, nfd, type ToneName } from "./text";

/** The nine two-letter consonants. Longest match wins when tokenising ("nw" before "n"). */
export const IGBO_DIGRAPHS = ["ch", "gb", "gh", "gw", "kp", "kw", "nw", "ny", "sh"] as const;

const DIGRAPHS: ReadonlySet<string> = new Set(IGBO_DIGRAPHS);
const LETTERS: ReadonlySet<string> = new Set(IGBO_LETTERS);
const VOWELS: ReadonlySet<string> = new Set(["a", "e", "i", "ị", "o", "ọ", "u", "ụ"]);
/** Letters that can stand as a syllable on their own and carry tone (m̀, ǹ, ṅ). */
const NASALS: ReadonlySet<string> = new Set(["m", "n", "ṅ"]);
const TONE_CHARS: ReadonlySet<string> = new Set(Object.values(TONE_MARK));
const TONE_BY_CHAR: Readonly<Record<string, ToneName>> = { "́": "high", "̀": "low", "̄": "downstep" };

/** Vowel-harmony set: {a ị ọ ụ} ("a", the light or retracted set) and {e i o u} ("e"). */
export type HarmonyClass = "a" | "e";

export const HARMONY_OF: Readonly<Record<string, HarmonyClass>> = {
  a: "a",
  ị: "a",
  ọ: "a",
  ụ: "a",
  e: "e",
  i: "e",
  o: "e",
  u: "e",
};

/** The same vowel in the other harmony set (i ↔ ị, o ↔ ọ, u ↔ ụ, e ↔ a). */
export const HARMONY_PARTNER: Readonly<Record<string, string>> = {
  a: "e",
  e: "a",
  i: "ị",
  ị: "i",
  o: "ọ",
  ọ: "o",
  u: "ụ",
  ụ: "u",
};

export function isVowelLetter(letter: string): boolean {
  return VOWELS.has(letter);
}

export function isNasalLetter(letter: string): boolean {
  return NASALS.has(letter);
}

/** Remove the tone marks from one cluster and lower-case it, keeping dots ("Ọ̀" → "ọ"). */
function plainLower(cluster: string): string {
  return nfc(
    Array.from(nfd(cluster))
      .filter((ch) => !TONE_CHARS.has(ch))
      .join("")
  ).toLowerCase();
}

function toneOfCluster(cluster: string): ToneName | null {
  for (const ch of Array.from(nfd(cluster))) {
    const t = TONE_BY_CHAR[ch];
    if (t) return t;
  }
  return null;
}

/** Count of tone marks on one cluster (two marks on one letter is a content error). */
function toneMarkCount(cluster: string): number {
  return Array.from(nfd(cluster)).filter((ch) => TONE_CHARS.has(ch)).length;
}

export interface LetterToken {
  /**
   * The alphabet letter, lower-case, dots kept, tone marks removed ("ọ",
   * "kw", "ṅ"). For anything that is not an Igbo letter it is the cluster
   * itself, lower-cased and without tone marks ("c", "q", "?", " ").
   */
  letter: string;
  /** The source text of this token, NFC, case and tone marks as written. */
  text: string;
  /** The tone mark written on it, if any. */
  tone: ToneName | null;
  /** More than one tone mark on one letter. */
  doubleTone: boolean;
  /** One of the 36 Ọnwụ letters. */
  igbo: boolean;
  /** A letter of any script (as opposed to space, digit or punctuation). */
  isLetter: boolean;
  /** UTF-16 offsets into the NFC text. */
  start: number;
  end: number;
}

const LETTER_RE = /\p{L}/u;

/**
 * Split text into Igbo letters (digraphs as one token), keeping everything
 * else as single-cluster tokens. Input is normalised to NFC first; offsets
 * refer to the NFC string.
 */
export function tokenizeLetters(text: string): LetterToken[] {
  const source = nfc(text);
  const clusters = graphemes(source);
  const out: LetterToken[] = [];
  let offset = 0;
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i] as string;
    const lower = plainLower(cluster);
    const next = clusters[i + 1];
    // A digraph is two unmarked letters, e.g. "kw" or "Gb" (consonants never carry tone).
    if (next !== undefined && toneOfCluster(cluster) === null && toneOfCluster(next) === null) {
      const pair = lower + plainLower(next);
      if (DIGRAPHS.has(pair)) {
        const piece = cluster + next;
        out.push({ letter: pair, text: piece, tone: null, doubleTone: false, igbo: true, isLetter: true, start: offset, end: offset + piece.length });
        offset += piece.length;
        i++;
        continue;
      }
    }
    const base = Array.from(nfd(cluster))[0] ?? "";
    out.push({
      letter: lower,
      text: cluster,
      tone: toneOfCluster(cluster),
      doubleTone: toneMarkCount(cluster) > 1,
      igbo: LETTERS.has(lower) && !DIGRAPHS.has(lower),
      isLetter: LETTER_RE.test(base),
      start: offset,
      end: offset + cluster.length,
    });
    offset += cluster.length;
  }
  return out;
}

/** The Igbo letters of a text, lower-case, tone-free ("Àkwà" → ["a", "kw", "a"]). */
export function lettersOf(text: string): string[] {
  return tokenizeLetters(text)
    .filter((t) => t.isLetter)
    .map((t) => t.letter);
}

/** Remove dots (ị → i, ọ → o, ụ → u, ṅ → n), keeping tone marks. Never applied to stored content. */
export function stripDots(text: string): string {
  return nfc(
    Array.from(nfd(text))
      .filter((ch) => ch !== DOT_BELOW && ch !== DOT_ABOVE)
      .join("")
  );
}

/** True when the text has a dotted letter (ị ọ ụ ṅ, any case). */
export function hasDots(text: string): boolean {
  return Array.from(nfd(text)).some((ch) => ch === DOT_BELOW || ch === DOT_ABOVE);
}

export interface LetterIssue {
  /** The offending cluster as written. */
  text: string;
  start: number;
  kind: "lone-c" | "not-igbo" | "lookalike";
  /** The Igbo letter it probably stands for (look-alikes only). Never auto-applied. */
  suggestion?: string;
}

/**
 * Letters outside the Ọnwụ set: c outside ch, q, x, look-alikes such as ñ
 * for ṅ, and letters from other orthographies (ẹ, ş …). Tone marks are not
 * letter issues (a tone mark on a vowel is fine here; on the spelling layer
 * it is a separate lint rule).
 */
export function letterIssues(text: string): LetterIssue[] {
  const issues: LetterIssue[] = [];
  for (const t of tokenizeLetters(text)) {
    if (!t.isLetter || t.igbo) continue;
    const plain = plainLower(t.text);
    const look = LOOKALIKES[plain] ?? LOOKALIKES[t.text];
    if (look) {
      issues.push({ text: t.text, start: t.start, kind: "lookalike", suggestion: look.toLowerCase() });
    } else if (plain === "c") {
      issues.push({ text: t.text, start: t.start, kind: "lone-c" });
    } else {
      issues.push({ text: t.text, start: t.start, kind: "not-igbo" });
    }
  }
  return issues;
}

/** The harmony set of each vowel in a word, in order ("mere" → ["e", "e"]). */
export function vowelClasses(word: string): HarmonyClass[] {
  return tokenizeLetters(word)
    .map((t) => HARMONY_OF[t.letter])
    .filter((c): c is HarmonyClass => c !== undefined);
}

/** The harmony set of the first vowel of a word, or null when it has none. */
export function firstVowelClass(word: string): HarmonyClass | null {
  return vowelClasses(word)[0] ?? null;
}

/** Split into words on whitespace (NFC); punctuation stays attached. */
export function words(text: string): string[] {
  return nfc(text)
    .split(/\s+/u)
    .filter((w) => w.length > 0);
}

/** A word without leading/trailing punctuation ("mere?" → "mere"), keeping inner apostrophes and hyphens. */
export function bareWord(word: string): string {
  return word.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, "");
}
