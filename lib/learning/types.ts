// Learning-engine contract (owner A). docs/CONTRACTS.md §2.
//
// Scheduling is FSRS (MIT). Every review is active recall with feedback,
// never a re-read. A card is one item practised through one facet, so
// hearing a word and saying it are scheduled separately.
import type { ContentBundle, DialectId, ExerciseSpec, ExerciseType, IsoTime, ItemId, LessonId, UnitId, VoiceId } from "@/lib/content/types";

/** The skill a card trains. */
export type Facet = "recognize" | "recall" | "listen" | "speak" | "tone";

/** FSRS ratings: 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Rating = 1 | 2 | 3 | 4;

export type CardState = "new" | "learning" | "review" | "relearning";

export interface FsrsCard {
  item: ItemId;
  facet: Facet;
  state: CardState;
  due: IsoTime;
  /** Days for retrievability to fall to 90%. */
  stability: number;
  /** 1 (easy) to 10 (hard). */
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  /** Position in the (re)learning steps. */
  step: number;
  reps: number;
  lapses: number;
  lastReview?: IsoTime;
}

export interface FsrsParams {
  /** FSRS model weights (FSRS-6 has 21). Default set until we have data to optimise on. */
  w: readonly number[];
  /** Target retention, default 0.9. */
  requestRetention: number;
  /** Days. */
  maximumInterval: number;
  enableFuzz: boolean;
  /** Minutes, e.g. [1, 10]. */
  learningSteps: readonly number[];
  relearningSteps: readonly number[];
}

/** One review, append-only. Kept on device and synced; the optimiser trains on these. */
export interface ReviewLog {
  id: string;
  item: ItemId;
  facet: Facet;
  rating: Rating;
  /** Card state before this review. */
  state: CardState;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reviewedAt: IsoTime;
  durationMs: number;
  exercise: ExerciseType;
  source: "lesson" | "review" | "tone-trainer" | "story";
  /** Speaking is self-assessed ("matched" / "not yet"); never machine-scored. */
  selfAssessed: boolean;
  voice?: VoiceId;
}

export interface Scheduler {
  newCard(item: ItemId, facet: Facet, now: Date): FsrsCard;
  /** Apply a rating; returns the updated card and its log entry. */
  review(card: FsrsCard, rating: Rating, now: Date, meta: Pick<ReviewLog, "durationMs" | "exercise" | "source" | "selfAssessed" | "voice">): { card: FsrsCard; log: ReviewLog };
  /** What each rating would do (for "next review in …" hints). */
  preview(card: FsrsCard, now: Date): Record<Rating, FsrsCard>;
  /** Probability of recall now, 0..1. */
  retrievability(card: FsrsCard, now: Date): number;
  /** Cards due at `now`, most overdue (lowest retrievability) first. */
  due(cards: readonly FsrsCard[], now: Date, limit?: number): FsrsCard[];
}

/** What the learner has told us that changes checking and generation. */
export interface LearnerSettings {
  track: "new-learner" | "heritage";
  /** Dialect variants accepted as answers ("standard" always included). */
  dialects: DialectId[];
  /** Pronunciation layer on by default at A0–A1. */
  showTones: boolean;
  dailyGoalMinutes: 5 | 10 | 15;
}

/** A concrete, renderable exercise: a spec plus the shuffled order and the seed it came from. */
export interface Exercise {
  id: string;
  spec: ExerciseSpec;
  /** Option/tile order as shown. */
  order: number[];
  seed: number;
}

export interface GeneratorInput {
  bundle: ContentBundle;
  settings: LearnerSettings;
  lesson?: LessonId;
  due: readonly FsrsCard[];
  seed: number;
  maxExercises: number;
}

/**
 * Builds a session. Rules: interleave confusables (tone pairs) instead of
 * blocking them; distractors only from approved items; never generate Igbo
 * text (only select and arrange approved strings); new items before their
 * reviews in the same session; speaking after hearing.
 */
export interface ExerciseGenerator {
  generate(input: GeneratorInput): Exercise[];
}

export type Response =
  | { type: "choice"; index: number }
  | { type: "tiles"; order: number[] }
  | { type: "text"; text: string }
  | { type: "self"; matched: boolean }
  | { type: "skip" };

export interface Outcome {
  correct: boolean;
  /** Suggested FSRS rating from correctness, latency and hints used. */
  rating: Rating;
  /** The dialect variant that matched, when the answer was a regional form. */
  matchedVariant?: DialectId;
  /** Spelling right but tone marks differ: shown as a tip, never as wrong (outside tone exercises). */
  toneTip?: boolean;
  /** Dots missing (o for ọ): a gentle literacy note. */
  dotTip?: boolean;
}

export interface AnswerChecker {
  check(exercise: Exercise, response: Response, settings: LearnerSettings): Outcome;
}

export interface LessonResult {
  lesson: LessonId;
  completedAt: IsoTime;
  exercises: number;
  correctFirstTry: number;
  newItems: ItemId[];
  minutes: number;
}

/** Durable learning progress (device-first, synced when signed in). */
export interface Progress {
  version: 1;
  cards: Record<string, FsrsCard>;
  lessons: Record<string, LessonResult>;
  /** Furthest unit unlocked per track. */
  unlocked: Record<string, UnitId>;
  /** Minutes practised per local date (YYYY-MM-DD). */
  minutesByDay: Record<string, number>;
  placement?: { takenAt: IsoTime; startUnit: UnitId };
}

/** Events the engine emits; the game layer (B) turns them into XP, izu days, garden growth. */
export type LearningEvent =
  | { kind: "lesson-complete"; result: LessonResult; at: IsoTime }
  | { kind: "review"; log: ReviewLog; correct: boolean; at: IsoTime }
  | { kind: "new-item"; item: ItemId; at: IsoTime }
  | { kind: "spoke"; item: ItemId; at: IsoTime }
  | { kind: "story-chapter"; story: string; chapter: number; at: IsoTime };
