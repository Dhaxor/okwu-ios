// Answer checking (CONTRACTS §2). Kind by design:
// - NFC, case, punctuation and spacing differences never make an answer wrong.
// - Tone marks matter only in tone-pair exercises; elsewhere a tone slip
//   is a tip.
// - A missing (or extra) dot is "almost: mind the dot": correct, with a
//   gentle note and a Hard rating, never a hard wrong.
// - Recognised dialect variants are accepted; a form from outside the
//   learner's home-dialect profile is accepted too, with an offer to add it.
// - Speaking is self-assessed and never scored.
// Nothing here produces Igbo text: it compares against approved strings.
import { audioFor, toneMarked } from "@/lib/content/bundle";
import type { ContentBundle, DialectId, Item, ItemId, Tone } from "@/lib/content/types";
import { compareAnswer, type AnswerComparison } from "@/lib/igbo/compare";
import { markTones } from "@/lib/igbo/syllables";
import type { AnswerChecker, Exercise, LearnerSettings, Outcome, Rating, Response } from "./types";

/** Extra, optional facts the screen knows about an answer. */
export interface AnswerMeta {
  /** Time from prompt to answer. */
  latencyMs?: number;
  /** Hints shown (letters revealed, slow audio …). */
  hintsUsed?: number;
  /** 1 for a first try. */
  attempt?: number;
}

/** What screens get back: the contract Outcome plus the details for kind feedback. */
export interface CheckOutcome extends Outcome {
  /** "Almost": right word, one small thing to mind. Still correct. */
  almost?: "dot" | "spacing" | "lookalike";
  /** A dot was missing (o for ọ) or added (ị for i). */
  dotKind?: "missing" | "extra";
  /** The learner skipped (e.g. can't listen now): nothing is scheduled. */
  skipped?: true;
  /** Self-assessed speaking ("matched" / "not yet"). */
  selfAssessed?: true;
  /** The item that was right, for the "Not yet" panel (render it; never generated text). */
  expected?: ItemId;
  /** Accepted regional form from outside the learner's profile: offer to add `matchedVariant`. */
  outsideProfile?: true;
  /** Tone feedback for tone exercises: the target's tones, and the chosen item's. */
  tones?: { expected: Tone[]; chosen?: Tone[] };
}

const EASY_MS: Record<string, number> = { choice: 2500, tiles: 6000, text: 7000 };

/** Suggested FSRS rating: Again when wrong; Hard for "almost", hints or a retry; Easy when fast and clean; else Good. */
export function suggestRating(correct: boolean, opts: { almost?: boolean; meta?: AnswerMeta; kind: "choice" | "tiles" | "text" | "self" }): Rating {
  if (!correct) return 1;
  const m = opts.meta ?? {};
  if (opts.almost || (m.hintsUsed ?? 0) > 0 || (m.attempt ?? 1) > 1) return 2;
  if (opts.kind !== "self" && m.latencyMs !== undefined && m.latencyMs < (EASY_MS[opts.kind] ?? 0)) return 4;
  return 3;
}

/** The option the learner chose: `index` is the position as shown. */
export function shownChoice<T>(exercise: Exercise, options: readonly T[], index: number): T | undefined {
  const at = exercise.order[index];
  return at === undefined ? undefined : options[at];
}

const tonesOf = (item: Item | undefined): Tone[] => (item && !item.tone.pending ? item.tone.syllables.map((s) => s.tone) : []);

function variantMarked(v: Item["dialects"][number]): string | null {
  return v.tone && !v.tone.pending && v.tone.syllables.length > 0 ? markTones(v.spelling, v.tone.syllables) : null;
}

interface TextVerdict {
  outcome: CheckOutcome;
}

function judgeText(item: Item, typed: string, settings: LearnerSettings, meta: AnswerMeta | undefined): TextVerdict {
  const candidates: { comparison: AnswerComparison; dialect?: DialectId; inProfile: boolean }[] = [];
  candidates.push({ comparison: compareAnswer(typed, item.spelling, toneMarked(item)), inProfile: true });
  for (const v of item.dialects) {
    if (!v.acceptAsAnswer) continue;
    candidates.push({ comparison: compareAnswer(typed, v.spelling, variantMarked(v)), dialect: v.dialect, inProfile: settings.dialects.includes(v.dialect) });
  }
  const rank = (c: AnswerComparison) => (c.match === "exact" ? (c.lookalike ? 1 : 0) : c.match === "dots" ? 2 : c.match === "spacing" ? 3 : 9);
  // prefer the best match; between equals, the standard form, then forms in the learner's profile
  const best = [...candidates].sort((a, b) => rank(a.comparison) - rank(b.comparison) || Number(b.inProfile) - Number(a.inProfile))[0];
  if (!best || best.comparison.match === "none") {
    return { outcome: { correct: false, rating: 1, expected: item.id } };
  }
  const c = best.comparison;
  const almost: CheckOutcome["almost"] = c.match === "dots" ? "dot" : c.match === "spacing" ? (c.dotsMissing || c.dotsExtra ? "dot" : "spacing") : c.lookalike ? "lookalike" : undefined;
  const out: CheckOutcome = { correct: true, rating: suggestRating(true, { almost: almost !== undefined, meta, kind: "text" }) };
  if (almost) out.almost = almost;
  if (c.dotsMissing || c.dotsExtra) {
    out.dotTip = true;
    out.dotKind = c.dotsMissing ? "missing" : "extra";
  }
  if (c.lookalike) out.dotTip = true;
  if (c.toneDiffers) out.toneTip = true;
  if (best.dialect) {
    out.matchedVariant = best.dialect;
    if (!best.inProfile) out.outsideProfile = true;
  }
  return { outcome: out };
}

/** The checker. It needs the bundle to look up the approved strings. */
export interface OkwuChecker extends AnswerChecker {
  check(exercise: Exercise, response: Response, settings: LearnerSettings, meta?: AnswerMeta): CheckOutcome;
}

export function createChecker(bundle: ContentBundle): OkwuChecker {
  const get = (id: ItemId) => bundle.items[id];
  return {
    check(exercise: Exercise, response: Response, settings: LearnerSettings, meta?: AnswerMeta): CheckOutcome {
      const spec = exercise.spec;
      if (response.type === "skip") return { correct: false, rating: 1, skipped: true };
      switch (spec.type) {
        case "listen-choose": {
          if (response.type !== "choice") return { correct: false, rating: 1, expected: spec.prompt };
          const chosen = shownChoice(exercise, spec.options, response.index);
          const prompt = get(spec.prompt);
          const pick = chosen ? get(chosen) : undefined;
          const same =
            chosen === spec.prompt ||
            (spec.answer === "gloss" && !!prompt && !!pick && prompt.gloss.en.trim().toLowerCase() === pick.gloss.en.trim().toLowerCase());
          const out: CheckOutcome = { correct: same, rating: suggestRating(same, { meta, kind: "choice" }) };
          if (!same) out.expected = spec.prompt;
          return out;
        }
        case "tone-pair": {
          if (response.type !== "choice") return { correct: false, rating: 1, expected: spec.target };
          const chosen = shownChoice(exercise, spec.set, response.index);
          const ok = chosen === spec.target;
          const out: CheckOutcome = { correct: ok, rating: suggestRating(ok, { meta, kind: "choice" }), tones: { expected: tonesOf(get(spec.target)) } };
          if (!ok) {
            out.expected = spec.target;
            if (chosen && out.tones) out.tones.chosen = tonesOf(get(chosen));
          }
          return out;
        }
        case "type-it": {
          const item = get(spec.target);
          if (!item || response.type !== "text") return { correct: false, rating: 1, expected: spec.target };
          return judgeText(item, response.text, settings, meta).outcome;
        }
        case "build-sentence": {
          if (response.type !== "tiles") return { correct: false, rating: 1, expected: spec.target };
          const shown = exercise.order.map((i) => [...spec.tiles, ...spec.distractorTiles][i] ?? "");
          const built = response.order.map((i) => shown[i] ?? "").join(" ");
          const item = get(spec.target);
          const ok = !!item && compareAnswer(built, spec.tiles.join(" ")).match === "exact";
          const out: CheckOutcome = { correct: ok, rating: suggestRating(ok, { meta, kind: "tiles" }) };
          if (!ok) out.expected = spec.target;
          return out;
        }
        case "say-it":
        case "dialogue": {
          if (response.type !== "self") return { correct: false, rating: 1, skipped: true };
          // Self-assessed and never scored: "not yet" schedules it sooner (Again), nothing else.
          return { correct: response.matched, rating: response.matched ? 3 : 1, selfAssessed: true };
        }
        case "story":
          return { correct: true, rating: 3 };
      }
    },
  };
}

/** True when the exercise needs audio the bundle cannot play yet (show the "Recording coming soon" note). */
export function needsPendingAudio(bundle: ContentBundle, exercise: Exercise, allowUnreviewed: boolean): boolean {
  const spec = exercise.spec;
  const ids: ItemId[] =
    spec.type === "listen-choose" ? [spec.prompt] : spec.type === "tone-pair" ? [spec.target] : spec.type === "say-it" ? [spec.target] : spec.type === "dialogue" ? spec.lines.map((l) => l.item) : spec.type === "type-it" && spec.prompt === "audio" ? [spec.target] : [];
  return ids.some((id) => {
    const item = bundle.items[id];
    return !item || audioFor(item, { allowUnreviewed }).state !== "ready";
  });
}
