// A lesson run: which exercise is showing, what the learner answered, and
// where the bar is. Pure reducer (tested); the lesson player renders it.
//
// Kind by design:
// - A missed exercise comes back once at the end, re-shuffled (retrieval
//   after feedback), as a second attempt. It never comes back twice.
// - Speaking, dialogues and stories are self-assessed and never retried.
// - A skip ("Can't listen now") moves on and schedules nothing.
// - The bar counts answered exercises over everything queued, so a retry
//   adds a little to the end instead of moving the learner backwards.
import { permutation, rng, subSeed } from "@/lib/learning";
import type { CheckOutcome, Exercise } from "@/lib/learning";

export type RunPhase = "answering" | "feedback" | "done";

export interface RunItem {
  exercise: Exercise;
  /** 1 for the first try, 2 for the retry at the end. */
  attempt: number;
}

export interface LessonRun {
  items: RunItem[];
  /** Index of the exercise showing (=== items.length when done). */
  at: number;
  phase: RunPhase;
  /** The outcome of the exercise showing, in the feedback phase. */
  outcome: CheckOutcome | null;
  /** Exercises answered right the first time (skips excluded). */
  correctFirstTry: number;
  /** First tries answered (not skipped): the denominator for a summary. */
  firstTries: number;
  startedAt: string;
}

const NO_RETRY = new Set(["say-it", "dialogue", "story"]);

export function startRun(exercises: readonly Exercise[], now: Date): LessonRun {
  return {
    items: exercises.map((exercise) => ({ exercise, attempt: 1 })),
    at: 0,
    phase: exercises.length === 0 ? "done" : "answering",
    outcome: null,
    correctFirstTry: 0,
    firstTries: 0,
    startedAt: now.toISOString(),
  };
}

export function current(run: LessonRun): RunItem | null {
  return run.phase === "done" ? null : (run.items[run.at] ?? null);
}

/** The same exercise with a fresh option order, for a second try. */
export function reshuffled(ex: Exercise): Exercise {
  const seed = subSeed(ex.seed, "retry");
  const n = ex.order.length;
  return { ...ex, id: `${ex.id}-again`, order: n > 0 ? permutation(n, rng(seed)) : [], seed };
}

/** Record the checked outcome of the exercise showing. */
export function answer(run: LessonRun, outcome: CheckOutcome): LessonRun {
  const item = current(run);
  if (!item || run.phase !== "answering") return run;
  const first = item.attempt === 1;
  const items = [...run.items];
  const retry = !outcome.correct && !outcome.skipped && !outcome.selfAssessed && first && !NO_RETRY.has(item.exercise.spec.type);
  if (retry) items.push({ exercise: reshuffled(item.exercise), attempt: 2 });
  return {
    ...run,
    items,
    phase: "feedback",
    outcome,
    firstTries: run.firstTries + (first && !outcome.skipped ? 1 : 0),
    correctFirstTry: run.correctFirstTry + (first && outcome.correct && !outcome.skipped ? 1 : 0),
  };
}

/** Move past the feedback to the next exercise (or the end). */
export function advance(run: LessonRun): LessonRun {
  if (run.phase === "done") return run;
  const at = run.at + 1;
  return { ...run, at, outcome: null, phase: at >= run.items.length ? "done" : "answering" };
}

/** A skip moves straight on (no feedback panel, nothing scheduled). */
export function skip(run: LessonRun): LessonRun {
  const item = current(run);
  if (!item || run.phase !== "answering") return run;
  return advance({ ...run, phase: "feedback", outcome: { correct: false, rating: 1, skipped: true } });
}

/** 0..1 for the progress bar: exercises finished over everything queued. */
export function progressOf(run: LessonRun): number {
  if (run.items.length === 0) return 1;
  const done = run.phase === "answering" ? run.at : run.at + 1;
  return Math.min(1, done / run.items.length);
}

/** Distinct first-try exercises (the lesson's own length, retries excluded). */
export function lessonLength(run: LessonRun): number {
  return run.items.filter((i) => i.attempt === 1).length;
}
