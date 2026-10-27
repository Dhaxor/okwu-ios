// Syllables and the tone layer.
//
// Igbo syllables are open: (C)V, or a syllabic nasal (m, n, ṅ) before a
// consonant or at the end of a word. Every syllable is a tone-bearing unit,
// so a long vowel is two syllables (daa-lụ → da·a·lụ) and nne is n·ne.
//
// The pronunciation layer is authored as tone-marked text, fully marked:
// acute = high (H), grave = low (L), macron = downstepped high (D). An
// unmarked syllable means "tone not authored yet", never "high". (Nkọwa
// okwu / Igbo API leave H unmarked; the Igbo API mapper converts.)
// Authors may force syllable breaks with "·" or "|" where the automatic
// split is wrong.
//
// Pure TypeScript, no react-native import; tested by bun (syllables.test.ts).
import { isNasalLetter, isVowelLetter, tokenizeLetters, type LetterToken } from "./letters";
import { nfc, setTone, stripTones, type ToneName } from "./text";

/** H high, L low, D downstepped high (structurally the same as content's `Tone`). */
export type ToneCode = "H" | "L" | "D";

export const TONE_CODE: Readonly<Record<ToneName, ToneCode>> = { high: "H", low: "L", downstep: "D" };
export const TONE_NAME: Readonly<Record<ToneCode, ToneName>> = { H: "high", L: "low", D: "downstep" };

/** Characters authors use to force a syllable break in tone-marked text. */
export const SYLLABLE_BREAKS = ["·", "|"] as const;
const BREAKS: ReadonlySet<string> = new Set(SYLLABLE_BREAKS);

/**
 * A syllable nucleus vowel: the eight Ọnwụ vowels, and for dialect forms
 * any other Latin vowel with marks (ẹ, ə̣, â …) so regional spellings still
 * split sensibly. The letter rule flags those letters separately.
 */
function isNucleusVowel(t: LetterToken): boolean {
  if (isVowelLetter(t.letter)) return true;
  if (t.igbo || !t.isLetter) return false;
  const base = Array.from(t.letter.normalize("NFD"))[0] ?? "";
  return "aeiouəɛɔ".includes(base);
}
/** Characters that split a word into parts without being part of a syllable. */
const INNER_BOUNDARY: ReadonlySet<string> = new Set(["'", "’", "ʼ", "-", "‐"]);

export interface SyllablePart {
  /** NFC spelling layer of the syllable: dots kept, tone marks removed, case as written. */
  text: string;
  /** As written, with its tone mark if any. */
  marked: string;
  /** Tone from the mark on the nucleus, or null when unmarked. */
  tone: ToneCode | null;
  nucleus: "vowel" | "nasal" | "none";
  /** Index of the space-separated word this syllable belongs to. */
  word: number;
  /** UTF-16 offsets into the NFC input. */
  start: number;
  end: number;
  /** Problems found while splitting (unusual cluster, stray tone mark …). */
  issues: string[];
}

interface Segment {
  tokens: LetterToken[];
  word: number;
  /** True when the author marked the syllable boundaries explicitly. */
  explicit: boolean;
}

const isSpace = (t: LetterToken) => /^\s+$/u.test(t.text);

/**
 * Group letters into words and the parts between inner boundaries
 * (apostrophe, hyphen, explicit breaks). A word that contains "·" or "|"
 * is split only where the author put them.
 */
function segments(text: string): Segment[] {
  const tokens = tokenizeLetters(text);
  // which space-separated chunks carry explicit breaks
  const explicitChunks: boolean[] = [];
  let chunk = 0;
  for (const t of tokens) {
    if (isSpace(t)) chunk++;
    else if (BREAKS.has(t.text)) explicitChunks[chunk] = true;
  }
  const out: Segment[] = [];
  let word = 0;
  chunk = 0;
  let current: LetterToken[] = [];
  let sawLetterInWord = false;
  const flush = () => {
    if (current.length > 0) out.push({ tokens: current, word, explicit: explicitChunks[chunk] === true });
    current = [];
  };
  for (const t of tokens) {
    if (isSpace(t)) {
      flush();
      chunk++;
      if (sawLetterInWord) word++;
      sawLetterInWord = false;
    } else if (BREAKS.has(t.text) || INNER_BOUNDARY.has(t.text)) {
      flush();
    } else if (t.isLetter) {
      current.push(t);
      sawLetterInWord = true;
    } else {
      // punctuation such as ? ! , . is not part of any syllable
      flush();
    }
  }
  flush();
  return out;
}

function partFrom(tokens: LetterToken[], word: number, nucleusIndex: number, issues: string[]): SyllablePart {
  const first = tokens[0] as LetterToken;
  const last = tokens[tokens.length - 1] as LetterToken;
  const nucleus = tokens[nucleusIndex];
  const kind: SyllablePart["nucleus"] = !nucleus ? "none" : isNucleusVowel(nucleus) ? "vowel" : isNasalLetter(nucleus.letter) ? "nasal" : "none";
  const marked = tokens.map((t) => t.text).join("");
  const marks = tokens.filter((t) => t.tone !== null);
  const tone = nucleus?.tone ? TONE_CODE[nucleus.tone] : null;
  const extra = [...issues];
  for (const t of marks) {
    if (t !== nucleus) extra.push(`tone mark on "${t.text}", which is not the syllable's vowel or nasal`);
    if (t.doubleTone) extra.push(`two tone marks on "${t.text}"`);
  }
  if (kind === "none") extra.push(`"${marked}" has no vowel or syllabic nasal`);
  return { text: stripTones(marked), marked: nfc(marked), tone, nucleus: kind, word, start: first.start, end: last.end, issues: extra };
}

/** Split one run of letters into syllables automatically. */
function autoSplit(seg: Segment): SyllablePart[] {
  const out: SyllablePart[] = [];
  const toks = seg.tokens;
  let onset: LetterToken[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i] as LetterToken;
    const next = toks[i + 1];
    if (isNucleusVowel(t)) {
      const issues = onset.length > 1 ? [`unusual consonant cluster "${onset.map((o) => o.text).join("")}"`] : [];
      out.push(partFrom([...onset, t], seg.word, onset.length, issues));
      onset = [];
    } else if (isNasalLetter(t.letter) && !(next && isNucleusVowel(next))) {
      // syllabic nasal: before a consonant or at the end of the part
      const issues = onset.length > 0 ? [`consonant "${onset.map((o) => o.text).join("")}" before a syllabic nasal`] : [];
      out.push(partFrom([...onset, t], seg.word, onset.length, issues));
      onset = [];
    } else {
      onset.push(t);
    }
  }
  if (onset.length > 0) {
    const prev = out.pop();
    if (prev) {
      // a closed syllable (loanwords): keep it, but say so
      const merged = toks.slice(toks.findIndex((x) => x.start === prev.start));
      const nucleusIndex = merged.findIndex((x) => isNucleusVowel(x) || isNasalLetter(x.letter));
      out.push(partFrom(merged, seg.word, Math.max(0, nucleusIndex), [...prev.issues, `closed syllable "${merged.map((x) => x.text).join("")}"`]));
    } else {
      out.push(partFrom(onset, seg.word, -1, []));
    }
  }
  return out;
}

/** An explicitly marked syllable: the whole part is one syllable. */
function explicitPart(seg: Segment): SyllablePart {
  const vowelAt = seg.tokens.findIndex(isNucleusVowel);
  const nasalAt = seg.tokens.findIndex((t) => isNasalLetter(t.letter));
  const nucleus = vowelAt >= 0 ? vowelAt : nasalAt;
  const vowels = seg.tokens.filter(isNucleusVowel).length;
  const issues = vowels > 1 ? [`"${seg.tokens.map((t) => t.text).join("")}" has ${vowels} vowels; each vowel is its own syllable in Igbo`] : [];
  // A mark on a later vowel of a long syllable still counts as the syllable's tone.
  const markedAt = seg.tokens.findIndex((t) => t.tone !== null);
  const at = markedAt >= 0 && isNucleusVowel(seg.tokens[markedAt] as LetterToken) ? markedAt : nucleus;
  return partFrom(seg.tokens, seg.word, at, issues);
}

/**
 * Split Igbo text (spelling or tone-marked) into syllables. Spaces separate
 * words; punctuation, apostrophes and hyphens are boundaries and belong to
 * no syllable. When the text contains "·" or "|", those breaks are taken
 * as the author's syllable boundaries.
 */
export function syllabify(text: string): SyllablePart[] {
  const out: SyllablePart[] = [];
  for (const seg of segments(text)) {
    if (seg.explicit) out.push(explicitPart(seg));
    else out.push(...autoSplit(seg));
  }
  return out;
}

/** Text with the author's syllable-break characters removed. */
export function withoutBreaks(text: string): string {
  return nfc(
    Array.from(nfc(text))
      .filter((ch) => !BREAKS.has(ch))
      .join("")
  );
}

export interface ToneSyllable {
  text: string;
  tone: ToneCode;
}

export interface ParsedToneText {
  /** One entry per syllable; `tone` is null where the author has not marked it yet. */
  syllables: { text: string; tone: ToneCode | null }[];
  /** Every syllable carries a tone. */
  complete: boolean;
  /** The marked text with breaks removed and tones stripped: should equal the spelling. */
  spelling: string;
  issues: string[];
}

/** Read an authored tone-marked string ("à·kwà", "Kèdụ́ …") into syllables. */
export function parseToneText(marked: string): ParsedToneText {
  const parts = syllabify(marked);
  const issues = parts.flatMap((p) => p.issues);
  const syllables = parts.map((p) => ({ text: p.text, tone: p.tone }));
  return {
    syllables,
    complete: syllables.length > 0 && syllables.every((s) => s.tone !== null),
    spelling: stripTones(withoutBreaks(marked)),
    issues,
  };
}

/** Letters of a text for alignment: lower-case, tone-free, dots kept. */
function alignLetters(text: string): LetterToken[] {
  return tokenizeLetters(text).filter((t) => t.isLetter);
}

/** Do the syllables, joined, spell exactly the letters of `spelling` (case, spaces and punctuation aside)? */
export function syllablesMatchSpelling(spelling: string, syllables: readonly { text: string }[]): boolean {
  const a = alignLetters(spelling).map((t) => t.letter);
  const b = syllables.flatMap((s) => alignLetters(s.text).map((t) => t.letter));
  return a.length === b.length && a.every((l, i) => l === b[i]);
}

export interface MarkOptions {
  /** "acute" marks every high (our pronunciation layer); "unmarked" leaves highs bare (Nkọwa okwu convention). */
  high?: "acute" | "unmarked";
}

/**
 * Put a tone layer back onto the spelling: the pronunciation layer for
 * display, recording scripts and reviewer sheets. Case, spaces and
 * punctuation come from the spelling. Returns null if the syllables do not
 * spell the same letters.
 */
export function markTones(spelling: string, syllables: readonly ToneSyllable[], options: MarkOptions = {}): string | null {
  const high = options.high ?? "acute";
  const tokens = tokenizeLetters(spelling);
  const letters = tokens.filter((t) => t.isLetter);
  const tones = new Map<LetterToken, ToneCode>();
  let k = 0;
  for (const syl of syllables) {
    const sylLetters = alignLetters(syl.text);
    if (sylLetters.length === 0) return null;
    const vowelAt = sylLetters.findIndex(isNucleusVowel);
    const nucleus = vowelAt >= 0 ? vowelAt : Math.max(0, sylLetters.findIndex((t) => isNasalLetter(t.letter)));
    for (let j = 0; j < sylLetters.length; j++) {
      if (letters[k + j]?.letter !== (sylLetters[j] as LetterToken).letter) return null;
    }
    tones.set(letters[k + nucleus] as LetterToken, syl.tone);
    k += sylLetters.length;
  }
  if (k !== letters.length) return null;
  let out = "";
  for (const t of tokens) {
    const tone = tones.get(t);
    if (!tone || (tone === "H" && high === "unmarked")) out += stripTones(t.text);
    else out += setTone(stripTones(t.text), TONE_NAME[tone]);
  }
  return nfc(out);
}

/** Each syllable with its tone mark, for setting under the pitch line ("à", "kwà"). */
export function markedSyllables(syllables: readonly ToneSyllable[]): string[] {
  return syllables.map((s) => markTones(s.text, [s]) ?? s.text);
}

const SPOKEN: Readonly<Record<ToneCode, string>> = { H: "high", L: "low", D: "downstepped high" };

/** The tones in words: "low, then high"; "high, low, then high". */
export function describeTones(tones: readonly ToneCode[]): string {
  const names = tones.map((t) => SPOKEN[t]);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")}, then ${names[names.length - 1]}`;
}

/**
 * Relative pitch targets for a pitch line, 0 = top of the register, 1 =
 * bottom. Highs start at the top; each downstep lowers the high register
 * for the rest of the run (never below 0.6); lows sit near the floor.
 * Matches `pitchContour` in components/art/geometry, which draws them.
 */
export function pitchLevels(tones: readonly ToneCode[]): number[] {
  let high = 0;
  return tones.map((t) => {
    if (t === "D") high = Math.min(high + 0.22, 0.6);
    return t === "L" ? 0.92 : Math.round(high * 100) / 100;
  });
}

export interface PitchPoint {
  /** 0..1 across the word, at the centre of the syllable's column. */
  x: number;
  /** 0 = high, 1 = low. */
  y: number;
}

/** Pitch-line points in unit space, one per syllable, centred in equal columns. */
export function pitchPoints(tones: readonly ToneCode[]): PitchPoint[] {
  const levels = pitchLevels(tones);
  const n = levels.length;
  return levels.map((y, i) => ({ x: Math.round(((i + 0.5) / n) * 1000) / 1000, y }));
}

/**
 * Tone-sequence problems that hold for any Igbo text: a downstep must
 * follow a high (or another downstep); it cannot start an utterance or
 * follow a low.
 */
export function toneSequenceIssues(tones: readonly (ToneCode | null)[]): string[] {
  const issues: string[] = [];
  tones.forEach((t, i) => {
    if (t !== "D") return;
    const prev = i > 0 ? tones[i - 1] : undefined;
    if (prev === undefined) issues.push(`syllable ${i + 1}: a downstep cannot start the text`);
    else if (prev === "L") issues.push(`syllable ${i + 1}: a downstep cannot follow a low tone`);
  });
  return issues;
}
