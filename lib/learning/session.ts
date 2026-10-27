// Recording what happened in a session: answers update the cards and the
// review log, and every change is announced as a LearningEvent. Events are
// the only seam to the game layer (CONTRACTS §2): screens pass them to
// GameEngine.apply. This module never imports lib/game. Pure.
import { allowsUnreviewedAudio, hasPlayableAudio } from "@/lib/content/bundle";
import type { ContentBundle, ItemId, LessonId, TrackId } from "@/lib/content/types";
import type { CheckOutcome } from "./checker";
import { addMinutes, cardKey, localDay, recordLesson, seenItems } from "./progress";
import type { Exercise, Facet, FsrsCard, LearningEvent, LessonResult, Progress, ReviewLog, Scheduler } from "./types";

/** Which cards an exercise reviews: (item, facet) pairs. Stories schedule nothing. */
export function facetsFor(exercise: Exercise, bundle: ContentBundle): { item: ItemId; facet: Facet }[] {
  const spec = exercise.spec;
  const allow = allowsUnreviewedAudio(bundle);
  const audible = (id: ItemId) => {
    const item = bundle.items[id];
    return !!item && hasPlayableAudio(item, allow);
  };
  switch (spec.type) {
    case "listen-choose":
      // Without a recording the learner read the word: that trains recognition, not listening.
      return [{ item: spec.prompt, facet: audible(spec.prompt) ? "listen" : "recognize" }];
    case "tone-pair":
      return [{ item: spec.target, facet: "tone" }];
    case "type-it":
      return [{ item: spec.target, facet: spec.prompt === "audio" ? "listen" : "recall" }];
    case "build-sentence":
      return [{ item: spec.target, facet: "recall" }];
    case "say-it":
      return [{ item: spec.target, facet: "speak" }];
    case "dialogue":
      return spec.items.map((item) => ({ item, facet: "speak" as const }));
    case "story":
      return [];
  }
}

export interface AnswerInput {
  bundle: ContentBundle;
  progress: Progress;
  exercise: Exercise;
  outcome: CheckOutcome;
  now: Date;
  durationMs: number;
  source: ReviewLog["source"];
  scheduler: Scheduler;
}

export interface AnswerResult {
  progress: Progress;
  /** Append these to the review log (appendReviewLogs). */
  logs: ReviewLog[];
  /** Pass these to the game layer. */
  events: LearningEvent[];
}

/**
 * Apply one checked answer. A skip changes nothing. Otherwise each card
 * the exercise trains is reviewed with the outcome's rating; the first
 * time an item is met a "new-item" event fires; every review fires
 * "review"; speaking fires "spoke" (self-assessed, whatever the answer).
 */
export function recordAnswer(input: AnswerInput): AnswerResult {
  const { bundle, exercise, outcome, now, scheduler } = input;
  if (outcome.skipped) return { progress: input.progress, logs: [], events: [] };
  const at = now.toISOString();
  const seen = seenItems(input.progress);
  const cards = { ...input.progress.cards };
  const logs: ReviewLog[] = [];
  const events: LearningEvent[] = [];
  const spoken = exercise.spec.type === "say-it" || exercise.spec.type === "dialogue";
  for (const { item, facet } of facetsFor(exercise, bundle)) {
    if (!seen.has(item)) {
      events.push({ kind: "new-item", item, at });
      seen.add(item);
    }
    const key = cardKey(item, facet);
    const card: FsrsCard = cards[key] ?? scheduler.newCard(item, facet, now);
    const { card: next, log } = scheduler.review(card, outcome.rating, now, {
      durationMs: input.durationMs,
      exercise: exercise.spec.type,
      source: input.source,
      selfAssessed: spoken,
    });
    cards[key] = next;
    logs.push(log);
    events.push({ kind: "review", log, correct: outcome.correct, at });
    if (spoken) events.push({ kind: "spoke", item, at });
  }
  return { progress: { ...input.progress, cards }, logs, events };
}

export interface LessonCompletion {
  bundle: ContentBundle;
  progress: Progress;
  track: TrackId | string;
  lesson: LessonId;
  startedAt: Date;
  now: Date;
  exercises: number;
  correctFirstTry: number;
  /** The device's UTC offset in minutes, for the practice-minutes day. */
  utcOffsetMinutes: number;
}

/** Finish a lesson: record it, count the minutes, unlock what follows, and say so to the game layer. */
export function completeLesson(input: LessonCompletion): { progress: Progress; result: LessonResult; events: LearningEvent[] } {
  const lesson = input.bundle.lessons[input.lesson];
  const minutes = Math.max(0, Math.round(((input.now.getTime() - input.startedAt.getTime()) / 60_000) * 10) / 10);
  const result: LessonResult = {
    lesson: input.lesson,
    completedAt: input.now.toISOString(),
    exercises: input.exercises,
    correctFirstTry: Math.min(input.correctFirstTry, input.exercises),
    newItems: (lesson?.introduces ?? []) as ItemId[],
    minutes,
  };
  let progress = recordLesson(input.progress, input.bundle, input.track, result);
  progress = addMinutes(progress, localDay(input.now, input.utcOffsetMinutes), minutes);
  return { progress, result, events: [{ kind: "lesson-complete", result, at: result.completedAt }] };
}

/** A story chapter read to the end. */
export function storyChapterRead(story: string, chapter: number, now: Date): LearningEvent {
  return { kind: "story-chapter", story, chapter, at: now.toISOString() };
}

/** Practice minutes outside lessons (reviews, tone trainer). */
export function recordPractice(progress: Progress, now: Date, utcOffsetMinutes: number, minutes: number): Progress {
  return addMinutes(progress, localDay(now, utcOffsetMinutes), minutes);
}
