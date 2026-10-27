// Learning engine (owner A): docs/CONTRACTS.md §2. Screens import from here.
//
//   const scheduler = createScheduler();
//   const plan = planSession({ bundle, progress, settings, scheduler, now, seed, mode: "lesson", lesson });
//   const checker = createChecker(bundle);
//   const outcome = checker.check(exercise, response, settings, { latencyMs });
//   const { progress, logs, events } = recordAnswer({ bundle, progress, exercise, outcome, now, durationMs, source: "lesson", scheduler });
//   events.forEach((e) => game.apply(state, e, now));        // the only seam to the game layer
//   completeLesson({ … }) → { progress, result, events }       // lesson-complete
//
// Pure TypeScript throughout; persistence is the screens' job (lib/state)
// with the parsers here.
import { fsrsScheduler } from "./fsrs";
import { createGenerator as makeGenerator } from "./generator";
import type { ExerciseGenerator, FsrsParams, Progress, Scheduler } from "./types";

export type * from "./types";
export { createChecker, needsPendingAudio, shownChoice, suggestRating, type AnswerMeta, type CheckOutcome, type OkwuChecker } from "./checker";
export { FSRS6_DEFAULT_W, FsrsModel, fuzzInterval } from "./fsrs";
export { LISTEN_OPTIONS, MAX_OPEN_NEW, heardIn, itemsUsedBy } from "./generator";
export {
  EXERCISE_SECONDS,
  LESSON_REVIEWS,
  SESSION_CAPS,
  dueCards,
  exerciseSeconds,
  lessonMinutes,
  planSession,
  sessionMinutes,
  toneTrainerSet,
  type PlanInput,
  type SessionMode,
  type SessionPlan,
} from "./planner";
export { HERITAGE_MIN_ACCURACY, applyPlacement, placeLearner, placementQuiz, type PlacementInput, type PlacementReason, type PlacementResult } from "./placement";
export {
  FACETS,
  MASTERY_LABELS,
  addMinutes,
  appendReviewLogs,
  cardKey,
  cardsOf,
  emptyProgress,
  furthestUnlocked,
  isUnitUnlocked,
  itemMastery,
  localDay,
  parseProgress,
  parseReviewLog,
  recordLesson,
  seenItems,
  serializeProgress,
  serializeReviewLog,
  trackUnits,
  unitProgress,
  type ItemMastery,
  type MasteryLevel,
  type UnitProgress,
} from "./progress";
export { completeLesson, facetsFor, recordAnswer, recordPractice, storyChapterRead, type AnswerInput, type AnswerResult, type LessonCompletion } from "./session";
export { permutation, rng, seedFrom, shuffle, subSeed } from "./rng";

/** Defaults; `w` is the FSRS-6 default set (FSRS6_DEFAULT_W) until we optimise on our own logs. */
export const DEFAULT_FSRS: Omit<FsrsParams, "w"> = {
  requestRetention: 0.9,
  maximumInterval: 365,
  enableFuzz: true,
  learningSteps: [1, 10],
  relearningSteps: [10],
};

export const EMPTY_PROGRESS: Progress = { version: 1, cards: {}, lessons: {}, unlocked: {}, minutesByDay: {} };

/** AsyncStorage keys the engine owns. */
export const LEARNING_KEYS = {
  progress: "okwu.progress.v1",
  reviewLog: "okwu.reviewlog.v1",
} as const;

/** The FSRS scheduler (our implementation of FSRS-6; no dependency). */
export function createScheduler(params?: Partial<FsrsParams>): Scheduler {
  return fsrsScheduler({ ...DEFAULT_FSRS, ...params });
}

export function createGenerator(): ExerciseGenerator {
  return makeGenerator();
}
