// Kind feedback for a checked answer (CONTRACTS §2, DESIGN §States). Pure
// (tested). The words are English; any Igbo in them is an approved string
// from the bundle, marked `igbo` so the screen sets it with <T igbo>.
//   correct   leaf: "Yes, that's it."
//   almost    ochre: "Almost: mind the dot" (still correct)
//   not-yet   ochre, never red: the right answer and its tones, "low, then high"
//   self      speaking: no verdict, no score
// A recognised regional form from outside the learner's profile is
// accepted with "Also said as …" and an offer to add that dialect.
import { describeTones } from "@/lib/igbo";
import { toneMarked } from "@/lib/content";
import type { ContentBundle, DialectId, Item, ItemId, Tone } from "@/lib/content/types";
import type { CheckOutcome, Exercise } from "@/lib/learning";

export type FeedbackTone = "correct" | "almost" | "not-yet" | "self";

/** A run of text; `igbo` runs render with <T igbo>, `strong` in bold. */
export interface Part {
  text: string;
  igbo?: boolean;
  strong?: boolean;
}

export interface Feedback {
  tone: FeedbackTone;
  title: string;
  lines: Part[][];
  /** Offer to add the dialect a regional answer came from. */
  offerDialect?: { id: DialectId; label: string };
}

const CORRECT_TITLES = ["Yes, that's it.", "Well heard.", "Exactly.", "That's right."] as const;
const DOTTED = ["ị", "ọ", "ụ", "ṅ"];

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const word = (text: string): Part => ({ text, igbo: true, strong: true });
const plain = (text: string): Part => ({ text });

/** How an item is written for feedback: with tone marks when the learner shows them (or always, for tone work). */
export function shownForm(item: Item, withTones: boolean): string {
  return (withTones ? toneMarked(item) : null) ?? item.spelling;
}

function tonesOf(item: Item | undefined): Tone[] {
  return item && !item.tone.pending ? item.tone.syllables.map((s) => s.tone) : [];
}

/** "low, then high", or null while tones are pending. */
export function toneWords(tones: readonly Tone[]): string | null {
  return tones.length > 0 ? describeTones(tones) : null;
}

/** The dotted letters in a spelling (ị ọ ụ ṅ), for "mind the dot" notes. */
export function dottedLetters(spelling: string): string[] {
  const lower = spelling.normalize("NFC").toLowerCase();
  return DOTTED.filter((d) => lower.includes(d));
}

function targetOf(ex: Exercise): ItemId | null {
  const s = ex.spec;
  switch (s.type) {
    case "listen-choose":
      return s.prompt;
    case "tone-pair":
    case "type-it":
    case "build-sentence":
    case "say-it":
      return s.target;
    default:
      return null;
  }
}

export interface FeedbackInput {
  bundle: ContentBundle;
  exercise: Exercise;
  outcome: CheckOutcome;
  /** The learner shows tone marks. */
  showTones: boolean;
  /** Dialect id → display label (from the dictionary's registry). */
  dialectLabels?: Record<string, string>;
  /** The item the learner chose, for choice exercises. */
  chosen?: ItemId | null;
}

export function feedbackFor(input: FeedbackInput): Feedback {
  const { bundle, exercise, outcome } = input;
  const spec = exercise.spec;
  const id = targetOf(exercise);
  const item = id ? bundle.items[id] : undefined;
  const toneWork = spec.type === "tone-pair";
  const form = item ? shownForm(item, input.showTones || toneWork) : "";

  if (outcome.selfAssessed) {
    return outcome.correct
      ? { tone: "self", title: "Lovely.", lines: [[plain("Saying it out loud is how it sticks. We'll bring it back to keep it fresh.")]] }
      : { tone: "self", title: "That's how it's learned.", lines: [[plain("Every try trains your ear and your voice. We'll come back to it soon.")]] };
  }

  if (spec.type === "story") return { tone: "correct", title: "Chapter read.", lines: [[plain("Well done reading to the end.")]] };

  if (outcome.correct) {
    const title = outcome.almost === "dot" || outcome.dotTip ? "Almost: mind the dot" : outcome.almost ? "Almost there" : (CORRECT_TITLES[exercise.seed % CORRECT_TITLES.length] ?? CORRECT_TITLES[0]);
    const lines: Part[][] = [];
    let offerDialect: Feedback["offerDialect"];
    if (item && (outcome.almost || outcome.dotTip)) {
      const dots = dottedLetters(item.spelling);
      if (outcome.dotKind === "extra") lines.push([plain("It's written "), word(item.spelling), plain(", with no dot there.")]);
      else if (dots.length > 0) lines.push([plain("It's written "), word(item.spelling), plain(", with "), ...dots.flatMap((d, i) => [...(i > 0 ? [plain(i === dots.length - 1 ? " and " : ", ")] : []), word(d)]), plain(".")]);
      else lines.push([plain("It's written "), word(item.spelling), plain(".")]);
    } else if (item && spec.type === "listen-choose" && spec.answer === "gloss") {
      lines.push([word(form), plain(` means “${item.gloss.en}”.`)]);
    } else if (item && toneWork) {
      const tw = toneWords(tonesOf(item));
      lines.push([word(form), plain(` is ${item.gloss.en}${tw ? `: ${tw}` : ""}.`)]);
    } else if (item && (spec.type === "build-sentence" || spec.type === "type-it") && !(outcome.matchedVariant && outcome.matchedVariant !== "standard")) {
      lines.push([word(form), plain(` · ${item.gloss.en}`)]);
    }
    if (outcome.toneTip && item && !toneWork) lines.push([plain("Tone marks are optional here. Ours: "), word(toneMarked(item) ?? item.spelling), plain(".")]);
    if (item && outcome.matchedVariant && outcome.matchedVariant !== "standard") {
      const v = item.dialects.find((d) => d.dialect === outcome.matchedVariant);
      const label = input.dialectLabels?.[outcome.matchedVariant] ?? v?.note?.replace(/^Igbo API:\s*/, "") ?? outcome.matchedVariant;
      lines.push([plain("Also said as "), word(v?.spelling ?? ""), plain(" in "), { text: label, igbo: true }, plain(`. The standard form is `), word(item.spelling), plain(".")]);
      if (outcome.outsideProfile) offerDialect = { id: outcome.matchedVariant, label };
    }
    return { tone: outcome.almost || outcome.dotTip ? "almost" : "correct", title, lines, ...(offerDialect ? { offerDialect } : {}) };
  }

  // Not yet: show the right answer, kindly, with its tones named.
  const lines: Part[][] = [];
  if (item) {
    const tw = toneWords(tonesOf(item));
    if (toneWork) {
      const chosen = input.chosen ? bundle.items[input.chosen] : undefined;
      if (chosen && chosen.id !== item.id) {
        const cw = toneWords(tonesOf(chosen));
        lines.push([word(shownForm(chosen, true)), plain(` is ${chosen.gloss.en}${cw ? `: ${cw}` : ""}.`)]);
      }
      lines.push([plain(`${cap(item.gloss.en)} is `), word(form), plain(tw ? `: ${tw}.` : ".")]);
    } else if (spec.type === "listen-choose") {
      lines.push([plain("You heard "), word(form), plain(`, “${item.gloss.en}”.`)]);
    } else {
      lines.push([plain("It's "), word(form), plain(`, “${item.gloss.en}”.`)]);
    }
  }
  return { tone: "not-yet", title: toneWork ? "So close." : "Not yet.", lines };
}
