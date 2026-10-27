// The session planner: what a lesson, a review or a tone-trainer set
// contains. It asks the scheduler what is due and the generator to build
// the exercises. Pure and seeded.
import { allowsUnreviewedAudio, isUsable, minimalSets, storyOf, voicesOf } from "@/lib/content/bundle";
import type { ContentBundle, ExerciseSpec, ExerciseType, Item, ItemId, Lesson, LessonId, VoiceId } from "@/lib/content/types";
import { generate } from "./generator";
import { seenItems } from "./progress";
import { permutation, rng, shuffle, subSeed } from "./rng";
import type { Exercise, FsrsCard, LearnerSettings, Progress, Scheduler } from "./types";

export type SessionMode = "lesson" | "review" | "tone-trainer";

export interface PlanInput {
  bundle: ContentBundle;
  progress: Progress;
  settings: LearnerSettings;
  scheduler: Scheduler;
  now: Date;
  seed: number;
  mode: SessionMode;
  lesson?: LessonId;
  /** Defaults: lesson 16, review 15, tone trainer 10. */
  maxExercises?: number;
  /** Reviews mixed into a lesson (default 4). */
  maxReviewsInLesson?: number;
}

export interface SessionPlan {
  mode: SessionMode;
  exercises: Exercise[];
  /** Items introduced for the first time. */
  newItems: ItemId[];
  /** Cards this session reviews. */
  reviewCards: FsrsCard[];
  /** How long this session takes, by its exercises (`sessionMinutes`). */
  estMinutes: number;
}

/**
 * Session caps. A lesson's cap is soft: it never cuts the introduction of
 * a new item (the generator grows the session to hold every new item's
 * first hearing plus one practice), it only stops the fill.
 */
export const SESSION_CAPS: Readonly<Record<SessionMode, number>> = { lesson: 16, review: 15, "tone-trainer": 10 };
const DEFAULT_MAX = SESSION_CAPS;
/** Due reviews mixed into a lesson, at most. */
export const LESSON_REVIEWS = 4;

/** Rough seconds per exercise, from a careful learner's pace (listen, think, answer, read the feedback). */
export const EXERCISE_SECONDS: Readonly<Record<ExerciseType, number>> = {
  "listen-choose": 15,
  "tone-pair": 15,
  "type-it": 30,
  "build-sentence": 25,
  "say-it": 25,
  dialogue: 12,
  story: 20,
};
/** Seconds for the lesson's opening card: the pattern note, or just the objectives. */
export const INTRO_SECONDS = { note: 40, plain: 10 } as const;
/** A due review mixed into a lesson, on average (mostly hearing, some recall). */
export const REVIEW_SECONDS = 18;

/** Seconds one exercise takes: dialogues by their lines; stories by their lines and English paragraphs; a story question reads first. */
export function exerciseSeconds(spec: ExerciseSpec, bundle?: Pick<ContentBundle, "stories">): number {
  switch (spec.type) {
    case "dialogue":
      return EXERCISE_SECONDS.dialogue + spec.lines.length * 8;
    case "story": {
      const story = bundle ? storyOf(bundle, spec.story) : null;
      return EXERCISE_SECONDS.story + spec.items.length * 12 + (story ? story.narrative.length * 8 : 0);
    }
    case "listen-choose":
      return EXERCISE_SECONDS["listen-choose"] + (spec.comprehension ? 5 : 0);
    default:
      return EXERCISE_SECONDS[spec.type];
  }
}

/** Minutes a session takes (at least 1): its exercises, the lesson's opening card, and any extra seconds. */
export function sessionMinutes(exercises: readonly Exercise[], opts: { bundle?: Pick<ContentBundle, "stories">; lesson?: Pick<Lesson, "note"> | null; extraSeconds?: number } = {}): number {
  const intro = opts.lesson ? (opts.lesson.note ? INTRO_SECONDS.note : INTRO_SECONDS.plain) : 0;
  const seconds = exercises.reduce((n, e) => n + exerciseSeconds(e.spec, opts.bundle), intro + (opts.extraSeconds ?? 0));
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * A lesson's "About N min": the session the planner really builds for it,
 * with due reviews filling the room left under the cap (up to
 * LESSON_REVIEWS), as for a returning learner. The compile step stamps it
 * into `Lesson.estMinutes`. Seed-independent: which exercises a lesson
 * gets does not depend on the seed, only their order does.
 */
export function lessonMinutes(bundle: ContentBundle, lessonId: LessonId | string): number {
  const lesson = bundle.lessons[lessonId];
  if (!lesson) return 0;
  const exercises = generate({ bundle, settings: ESTIMATE_SETTINGS, lesson: lesson.id, due: [], seed: 1, maxExercises: DEFAULT_MAX.lesson });
  const reviews = Math.min(LESSON_REVIEWS, Math.max(0, DEFAULT_MAX.lesson - exercises.length));
  return sessionMinutes(exercises, { bundle, lesson, extraSeconds: reviews * REVIEW_SECONDS });
}

const ESTIMATE_SETTINGS: LearnerSettings = { track: "new-learner", dialects: ["standard"], showTones: true, dailyGoalMinutes: 10 };

/** Due cards of items the bundle can still use, most urgent first. */
export function dueCards(bundle: ContentBundle, progress: Progress, scheduler: Scheduler, now: Date, limit?: number): FsrsCard[] {
  const cards = Object.values(progress.cards).filter((c) => {
    const item = bundle.items[c.item];
    return item !== undefined && isUsable(bundle, item);
  });
  return scheduler.due(cards, now, limit);
}

/**
 * A short tone-trainer set (high-variability perception practice): tone-pair
 * trials over the minimal sets the learner has met (all sets if none yet),
 * interleaved across sets and members, every member equally often, never
 * the same target twice in a row, many voices where recordings exist.
 */
export function toneTrainerSet(bundle: ContentBundle, progress: Progress, seed: number, trials = DEFAULT_MAX["tone-trainer"]): Exercise[] {
  const seen = seenItems(progress);
  const all = minimalSets(bundle);
  const met = all.filter((set) => set.some((id) => seen.has(id)));
  const sets = met.length > 0 ? met : all;
  if (sets.length === 0 || trials <= 0) return [];
  const r = rng(seed);
  const allow = allowsUnreviewedAudio(bundle);
  // a balanced deck of targets per set, shuffled, then dealt round-robin across sets
  const decks = sets.map((set) => {
    const deck: ItemId[] = [];
    while (deck.length < Math.ceil(trials / sets.length) + set.length) deck.push(...shuffle(set, r));
    return deck;
  });
  const out: Exercise[] = [];
  let last = "";
  let turn = 0;
  while (out.length < trials) {
    const s = turn % sets.length;
    const deck = decks[s] as ItemId[];
    const set = sets[s] as ItemId[];
    turn++;
    let at = deck.findIndex((id) => id !== last);
    if (at < 0) at = 0;
    const target = deck.splice(at, 1)[0] as ItemId;
    const voices = [...new Set(set.flatMap((id) => voicesOf(bundle.items[id] as Item, allow)))].sort() as VoiceId[];
    const exSeed = subSeed(seed, `tt:${out.length}`);
    out.push({
      id: `${(seed >>> 0).toString(36)}-${out.length}-tone-pair`,
      spec: { type: "tone-pair", items: [target], set, target, voices },
      order: permutation(set.length, rng(exSeed)),
      seed: exSeed,
    });
    last = target;
  }
  return out;
}

export function planSession(input: PlanInput): SessionPlan {
  const max = input.maxExercises ?? DEFAULT_MAX[input.mode];
  if (input.mode === "tone-trainer") {
    const exercises = toneTrainerSet(input.bundle, input.progress, input.seed, max);
    return { mode: input.mode, exercises, newItems: [], reviewCards: [], estMinutes: Math.ceil((exercises.length * 12) / 60) };
  }
  const lesson = input.mode === "lesson" && input.lesson ? input.bundle.lessons[input.lesson] : undefined;
  const introducing = new Set<string>(lesson?.introduces ?? []);
  const seen = seenItems(input.progress);
  const limit = input.mode === "lesson" ? (input.maxReviewsInLesson ?? LESSON_REVIEWS) : max;
  const due = dueCards(input.bundle, input.progress, input.scheduler, input.now).filter((c) => !introducing.has(c.item)).slice(0, limit);
  const exercises = generate({
    bundle: input.bundle,
    settings: input.settings,
    ...(lesson ? { lesson: lesson.id } : {}),
    due,
    seed: input.seed,
    maxExercises: max,
  });
  const used = new Set<string>(exercises.flatMap((e) => e.spec.items));
  return {
    mode: input.mode,
    exercises,
    newItems: [...introducing].filter((id) => !seen.has(id) && used.has(id)) as ItemId[],
    reviewCards: due.filter((c) => used.has(c.item)),
    estMinutes: exercises.length === 0 ? 0 : sessionMinutes(exercises, { bundle: input.bundle, lesson: lesson ?? null }),
  };
}
