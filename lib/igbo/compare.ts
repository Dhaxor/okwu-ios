// Comparing what a learner typed with an approved spelling.
//
// Kind by design (RESEARCH §3, CONTRACTS §2): case, punctuation and tone
// marks never make an answer wrong outside tone exercises; a missing dot
// (o for ọ) or a look-alike letter (ñ for ṅ) is "almost", with a gentle
// note. The learner's text is never rewritten; this only classifies it.
//
// Pure TypeScript, no react-native import; tested by bun (compare.test.ts).
import { hasDots, letterIssues, stripDots, tokenizeLetters } from "./letters";
import { graphemes, nfc, setTone, stripTones, toneOf } from "./text";

/**
 * The comparable form of an answer: NFC, lower-case, curly quotes unified,
 * apostrophes dropped (n'ụlọ ~ nụlọ), hyphens and dashes as spaces,
 * punctuation removed, whitespace collapsed. Tone marks and dots are kept.
 */
export function canonicalAnswer(text: string): string {
  return nfc(
    nfc(text)
      .toLowerCase()
      .replace(/[’‘ʼ`´']/gu, "")
      .replace(/[-‐‑–—]/gu, " ")
      .replace(/[^\p{L}\p{M}\s]/gu, "")
      .replace(/\s+/gu, " ")
      .trim()
  );
}

/** Replace look-alike letters (ñ, ŋ, i̩ …) with the Igbo letter they stand for, keeping tone marks. */
function mapLookalikes(text: string): { text: string; changed: boolean } {
  const issues = letterIssues(text).filter((i) => i.kind === "lookalike");
  if (issues.length === 0) return { text, changed: false };
  const byStart = new Map(issues.map((i) => [i.start, i]));
  let out = "";
  for (const t of tokenizeLetters(text)) {
    const issue = byStart.get(t.start);
    out += issue?.suggestion ? setTone(issue.suggestion, t.tone) : t.text;
  }
  return { text: nfc(out), changed: true };
}

export interface AnswerComparison {
  /**
   * exact: same letters (tone marks aside).
   * dots: same apart from dots (o for ọ, or a dot too many): "almost".
   * spacing: same letters, words joined or split differently: "almost".
   * none: a different answer.
   */
  match: "exact" | "dots" | "spacing" | "none";
  /** A dot the answer needs is missing (o for ọ). */
  dotsMissing: boolean;
  /** A dot where the answer has none (ị for i). */
  dotsExtra: boolean;
  /** The learner used a look-alike letter (ñ for ṅ). */
  lookalike: boolean;
  /** The learner typed tone marks that differ from the expected ones. Never makes an answer wrong outside tone exercises. */
  toneDiffers: boolean;
}

function dotDiff(typed: string, expected: string): { missing: boolean; extra: boolean } {
  const a = graphemes(typed);
  const b = graphemes(expected);
  let missing = false;
  let extra = false;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const ta = hasDots(a[i] as string);
    const tb = hasDots(b[i] as string);
    if (tb && !ta) missing = true;
    if (ta && !tb) extra = true;
  }
  return { missing, extra };
}

/** Did the learner mark any syllable with a tone that differs from the expected tone-marked text? */
function tonesDiffer(typed: string, expectedMarked: string | null | undefined): boolean {
  if (!expectedMarked) return false;
  const a = tokenizeLetters(typed).filter((t) => t.isLetter);
  const b = tokenizeLetters(canonicalAnswer(expectedMarked)).filter((t) => t.isLetter);
  if (a.length !== b.length) return false;
  return a.some((t, i) => {
    if (t.tone === null) return false;
    const want = toneOf((b[i] as { text: string }).text);
    return want !== null && want !== t.tone;
  });
}

/**
 * Compare a typed answer with an expected spelling (the spelling layer).
 * `expectedMarked` is the pronunciation layer, when authored; it is used
 * only to notice tone marks the learner typed differently (a tip).
 */
export function compareAnswer(typed: string, expected: string, expectedMarked?: string | null): AnswerComparison {
  const looked = mapLookalikes(canonicalAnswer(typed));
  const t = stripTones(looked.text);
  const e = stripTones(canonicalAnswer(expected));
  const base: AnswerComparison = { match: "none", dotsMissing: false, dotsExtra: false, lookalike: looked.changed, toneDiffers: false };
  if (t.length === 0) return { ...base, lookalike: false };
  const toneDiffers = tonesDiffer(looked.text, expectedMarked);
  if (t === e) return { ...base, match: "exact", toneDiffers };
  if (stripDots(t) === stripDots(e)) {
    const d = dotDiff(t, e);
    return { ...base, match: "dots", dotsMissing: d.missing, dotsExtra: d.extra, toneDiffers };
  }
  const tj = t.replace(/\s/gu, "");
  const ej = e.replace(/\s/gu, "");
  if (stripDots(tj) === stripDots(ej)) {
    const d = tj === ej ? { missing: false, extra: false } : dotDiff(tj, ej);
    return { ...base, match: "spacing", dotsMissing: d.missing, dotsExtra: d.extra };
  }
  return base;
}
