// The Practice tab's sessions, pure (practice.test.ts):
//   reviewOverview      what today's review holds (due words, minutes, the next due time)
//   toneTrainerSession  a high-variability tone set: 20–30 trials over every
//                       minimal set, interleaved, members balanced, never the
//                       same word twice in a row, every recorded voice
//   trainerResults      the honest summary: right first time out of heard,
//                       per tone pattern (never a pronunciation score)
//   speakingSet         a "Say it" set: shadowing words and short phrases,
//                       due speaking cards first; self-assessed, never scored
// Everything here selects and arranges approved strings; nothing writes Igbo.
import { allowsUnreviewedAudio, hasPlayableAudio, hasTones, igboKey, isPlayable, isUsable, minimalSets, pitchLineFor, toneMarked, voicesOf } from "@/lib/content";
import type { ContentBundle, DialectId, Item, ItemId, Tone, VoiceId } from "@/lib/content/types";
import { dueCards, permutation, rng, seenItems, shuffle, subSeed, type CheckOutcome, type Exercise, type Progress, type Scheduler } from "@/lib/learning";
import { describeTones, graphemeCount, markTones } from "@/lib/igbo";

// ---------------------------------------------------------------------------
// Daily review
// ---------------------------------------------------------------------------

export interface ReviewOverview {
  /** Distinct words with at least one card due now. */
  dueWords: number;
  dueCards: number;
  /** Rough length of a review of up to `max` exercises (~20 s each). */
  estMinutes: number;
  /** Words learned so far (any card). */
  learnedWords: number;
  /** When the next card falls due, if none is due now. */
  nextDue: Date | null;
}

export const REVIEW_MAX_EXERCISES = 15;

export function reviewOverview(bundle: ContentBundle, progress: Progress, scheduler: Scheduler, now: Date, max = REVIEW_MAX_EXERCISES): ReviewOverview {
  const due = dueCards(bundle, progress, scheduler, now);
  const usable = Object.values(progress.cards).filter((c) => {
    const item = bundle.items[c.item];
    return item !== undefined && isUsable(bundle, item);
  });
  const later = usable
    .map((c) => Date.parse(c.due))
    .filter((t) => Number.isFinite(t) && t > now.getTime())
    .sort((a, b) => a - b);
  const exercises = Math.min(max, due.length);
  return {
    dueWords: new Set(due.map((c) => c.item)).size,
    dueCards: due.length,
    estMinutes: exercises === 0 ? 0 : Math.max(1, Math.ceil((exercises * 20) / 60)),
    learnedWords: new Set(usable.map((c) => c.item)).size,
    nextDue: due.length === 0 && later.length > 0 ? new Date(later[0] as number) : null,
  };
}

/** "in 3 hours", "tomorrow", "in 4 days": when the next review comes, in words. */
export function nextDueWords(next: Date, now: Date): string {
  const ms = next.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return minutes <= 1 ? "in a minute" : `in ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  const sameDay = next.toDateString() === now.toDateString();
  if (sameDay) return hours <= 1 ? "in about an hour" : `in about ${hours} hours`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (next.toDateString() === tomorrow.toDateString()) return "tomorrow";
  const days = Math.max(2, Math.round(ms / 86_400_000));
  return `in ${days} days`;
}

// ---------------------------------------------------------------------------
// Tone trainer
// ---------------------------------------------------------------------------

/** A tone-trainer set is 20–30 short trials (HVPT: short sessions, many voices). */
export const TRAINER_TRIALS = 24;
export const TRAINER_MIN = 20;
export const TRAINER_MAX = 30;

export interface ToneSetView {
  /** Shared spelling, e.g. "akwa". */
  spelling: string;
  members: { id: ItemId; marked: string; gloss: string; tones: Tone[] }[];
  /** Distinct recorded voices across the set (0 while recordings are pending). */
  voices: number;
  met: boolean;
}

/** Every minimal set in the bundle, for the trainer's intro (sets the learner has met first). */
export function toneSets(bundle: ContentBundle, progress: Progress): ToneSetView[] {
  const seen = seenItems(progress);
  const allow = allowsUnreviewedAudio(bundle);
  const sets = minimalSets(bundle).map((ids) => {
    const items = ids.map((id) => bundle.items[id] as Item);
    return {
      spelling: (items[0]?.spelling ?? "").toLowerCase(),
      members: items.map((i) => ({ id: i.id, marked: toneMarked(i) ?? i.spelling, gloss: i.gloss.en, tones: i.tone.syllables.map((s) => s.tone) })),
      voices: new Set(items.flatMap((i) => voicesOf(i, allow))).size,
      met: ids.some((id) => seen.has(id)),
    };
  });
  return sets.sort((a, b) => Number(b.met) - Number(a.met) || (a.spelling < b.spelling ? -1 : a.spelling > b.spelling ? 1 : 0));
}

/**
 * One tone-trainer session: `trials` tone-pair exercises over every minimal
 * set (all of them, so a learner hears more than the pairs a lesson
 * taught), dealt round-robin across sets so confusables interleave; within
 * a set each word comes up equally often; never the same word twice in a
 * row. Each trial lists every recorded voice of its set, so "Hear another
 * voice" rotates through them (high-variability practice).
 */
export function toneTrainerSession(bundle: ContentBundle, progress: Progress, seed: number, trials = TRAINER_TRIALS): Exercise[] {
  const n = Math.max(0, Math.min(TRAINER_MAX, Math.round(trials)));
  const views = toneSets(bundle, progress);
  const sets = views.map((v) => v.members.map((m) => m.id));
  if (sets.length === 0 || n === 0) return [];
  const r = rng(seed);
  const allow = allowsUnreviewedAudio(bundle);
  const order = shuffle(
    sets.map((_, i) => i),
    r
  );
  const decks = sets.map((set) => {
    const deck: ItemId[] = [];
    while (deck.length < Math.ceil(n / sets.length) + set.length) deck.push(...shuffle(set, r));
    return deck;
  });
  const out: Exercise[] = [];
  let last = "";
  for (let turn = 0; out.length < n; turn++) {
    const s = order[turn % order.length] as number;
    const set = sets[s] as ItemId[];
    const deck = decks[s] as ItemId[];
    let at = deck.findIndex((id) => id !== last);
    if (at < 0) at = 0;
    const target = deck.splice(at, 1)[0] as ItemId;
    const voices = [...new Set(set.flatMap((id) => voicesOf(bundle.items[id] as Item, allow)))].sort() as VoiceId[];
    const exSeed = subSeed(seed, `trainer:${out.length}`);
    out.push({
      id: `trainer-${(seed >>> 0).toString(36)}-${out.length}`,
      spec: { type: "tone-pair", items: [target], set, target, voices },
      order: permutation(set.length, rng(exSeed)),
      seed: exSeed,
    });
    last = target;
  }
  return out;
}

export interface TrainerAnswer {
  exercise: Exercise;
  outcome: Pick<CheckOutcome, "correct" | "skipped">;
  /** 1 first try, 2 the retry at the end of the set. */
  attempt: number;
}

export interface PatternResult {
  /** "L-L", "H-D", … */
  pattern: string;
  tones: Tone[];
  /** "low, then low". */
  label: string;
  /** The words heard with this pattern, tone-marked. */
  words: string[];
  correct: number;
  total: number;
}

export interface TrainerResults {
  /** Right on the first try. */
  correct: number;
  /** Trials heard (skips left out). */
  total: number;
  skipped: number;
  /** Words that came back for a second try and were right then. */
  rightOnRetry: number;
  patterns: PatternResult[];
}

/**
 * The honest end of a tone-trainer set: how many trials were heard right the
 * first time, overall and per tone pattern. Perception only; speaking is
 * never measured, so there is no pronunciation score anywhere.
 */
export function trainerResults(bundle: ContentBundle, answers: readonly TrainerAnswer[]): TrainerResults {
  const byPattern = new Map<string, PatternResult>();
  let correct = 0;
  let total = 0;
  let skipped = 0;
  let rightOnRetry = 0;
  for (const a of answers) {
    const spec = a.exercise.spec;
    if (spec.type !== "tone-pair") continue;
    if (a.outcome.skipped) {
      if (a.attempt === 1) skipped++;
      continue;
    }
    if (a.attempt !== 1) {
      if (a.outcome.correct) rightOnRetry++;
      continue;
    }
    const item = bundle.items[spec.target];
    const pitch = item ? pitchLineFor(item) : null;
    if (!item || !pitch) continue;
    total++;
    if (a.outcome.correct) correct++;
    const key = pitch.tones.join("-");
    const row = byPattern.get(key) ?? { pattern: key, tones: pitch.tones, label: pitch.label, words: [], correct: 0, total: 0 };
    row.total++;
    if (a.outcome.correct) row.correct++;
    const marked = toneMarked(item) ?? item.spelling;
    if (!row.words.includes(marked)) row.words.push(marked);
    byPattern.set(key, row);
  }
  // Hardest first (the lowest share right), then the pattern, so the summary leads with what to listen for.
  const patterns = [...byPattern.values()].sort((a, b) => a.correct / a.total - b.correct / b.total || (a.pattern < b.pattern ? -1 : 1));
  return { correct, total, skipped, rightOnRetry, patterns };
}

export interface RegionalRecording {
  /** The dialect to ask the player for (the first, alphabetically, that has this clip). */
  dialect: DialectId;
  /** Tone-marked when the source marks it, else the spelling. */
  shown: string;
  /** "Afiikpo", "Mbaise, Owere" (alphabetical; dialects are never ranked). */
  places: string;
  /** The source marks a tone pattern different from the item's own. */
  toneDiffers: boolean;
}

const placeKey = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * The same word recorded by speakers from other areas (a regional form
 * spelled like the item), one entry per recording: high-variability
 * listening across dialects, offered after a tone-pair answer, never
 * tested. A form spelled differently is a different "Also said as" and is
 * left out here.
 */
export function regionalRecordings(item: Pick<Item, "spelling" | "tone" | "dialects">, labels: Record<string, string>, allowUnreviewed = false): RegionalRecording[] {
  const own = item.tone.syllables.map((s) => s.tone).join("");
  const byClip = new Map<string, { dialects: string[]; variant: Item["dialects"][number] }>();
  for (const v of item.dialects) {
    if (igboKey(v.spelling) !== igboKey(item.spelling)) continue;
    const clip = v.audio.find((a) => isPlayable(a, allowUnreviewed));
    if (!clip) continue;
    const entry = byClip.get(clip.id) ?? { dialects: [], variant: v };
    entry.dialects.push(v.dialect);
    byClip.set(clip.id, entry);
  }
  return [...byClip.values()].map(({ dialects, variant }) => {
    const named = dialects.map((d) => ({ id: d, label: labels[d] ?? d })).sort((a, b) => placeKey(a.label).localeCompare(placeKey(b.label)));
    const marked = variant.tone && !variant.tone.pending && variant.tone.syllables.length > 0 ? markTones(variant.spelling, variant.tone.syllables) : null;
    const theirs = variant.tone?.syllables.map((s) => s.tone).join("") ?? "";
    return {
      dialect: named[0]?.id as DialectId,
      shown: marked ?? variant.spelling,
      places: named.map((n) => n.label).join(", "),
      toneDiffers: theirs !== "" && own !== "" && theirs !== own,
    };
  });
}

// ---------------------------------------------------------------------------
// Speaking ("Say it" set)
// ---------------------------------------------------------------------------

export const SPEAKING_SET_SIZE = 8;
/** Shadowing with an overlay is for words and short phrases only (RESEARCH §4). */
const MAX_GRAPHEMES = 24;
const MAX_WORDS = 3;

/** Words and short phrases a learner can shadow: usable, with authored tones (the pitch line). */
export function speakable(bundle: ContentBundle, item: Item): boolean {
  if (!isUsable(bundle, item) || !hasTones(item)) return false;
  if (item.kind !== "word" && item.kind !== "phrase" && item.kind !== "name") return false;
  return graphemeCount(item.spelling) <= MAX_GRAPHEMES && item.spelling.trim().split(/\s+/).length <= MAX_WORDS;
}

/**
 * A "Say it" set: speaking cards that are due first, then words the learner
 * has met, then the rest; recorded words before ones still waiting for a
 * recording. Never scored: the learner says "matched" or "not yet".
 */
export function speakingSet(bundle: ContentBundle, progress: Progress, scheduler: Scheduler, now: Date, seed: number, size = SPEAKING_SET_SIZE): Exercise[] {
  const allow = allowsUnreviewedAudio(bundle);
  const pool = Object.values(bundle.items).filter((i) => speakable(bundle, i));
  if (pool.length === 0 || size <= 0) return [];
  const due = new Set(dueCards(bundle, progress, scheduler, now).filter((c) => c.facet === "speak").map((c) => c.item as string));
  const seen = seenItems(progress);
  const r = rng(seed);
  const rank = (i: Item) => (due.has(i.id) ? 0 : seen.has(i.id) ? 2 : 4) + (hasPlayableAudio(i, allow) ? 0 : 1);
  const picked = shuffle(pool, r)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, size);
  return picked.map((item, i) => {
    const s = subSeed(seed, `say:${i}`);
    return { id: `say-${(seed >>> 0).toString(36)}-${i}`, spec: { type: "say-it", items: [item.id], target: item.id, overlay: false }, order: [], seed: s };
  });
}

/** For the speaking end card: how many words were said, and which the learner marked "not yet" (no verdict of ours). */
export function spokenSummary(answers: readonly TrainerAnswer[]): { said: number; matched: number; notYet: number; notYetItems: ItemId[] } {
  let matched = 0;
  const notYetItems: ItemId[] = [];
  for (const a of answers) {
    const spec = a.exercise.spec;
    if (spec.type !== "say-it" || a.outcome.skipped) continue;
    if (a.outcome.correct) matched++;
    else if (!notYetItems.includes(spec.target)) notYetItems.push(spec.target);
  }
  return { said: matched + notYetItems.length, matched, notYet: notYetItems.length, notYetItems };
}

export { describeTones };
