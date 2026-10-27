// Builders for game-layer tests and the dev gallery: LearningEvents and
// times on a chosen calendar. Not used by the app at runtime.
import type { ItemId, LessonId } from "@/lib/content/types";
import type { LearningEvent } from "@/lib/learning/types";
import { zoneCalendar } from "./calendar";
import type { GameCalendar, LocalDate } from "./types";

/** Lagos: no DST, so tests about rules are not tests about clocks. */
export const LAGOS = zoneCalendar("Africa/Lagos");

/** The instant of a local wall time on a calendar. */
export function at(cal: GameCalendar, day: LocalDate, hour = 19, minute = 0): Date {
  return cal.at(day, hour, minute);
}

export function lessonDone(lesson: string, newItems: string[] = [], when = "2026-01-01T00:00:00.000Z"): LearningEvent {
  return {
    kind: "lesson-complete",
    result: { lesson: lesson as LessonId, completedAt: when, exercises: 10, correctFirstTry: 8, newItems: newItems as ItemId[], minutes: 6 },
    at: when,
  };
}

export function reviewed(item: string, correct = true, when = "2026-01-01T00:00:00.000Z"): LearningEvent {
  return {
    kind: "review",
    correct,
    at: when,
    log: {
      id: `log-${item}`,
      item: item as ItemId,
      facet: "recall",
      rating: correct ? 3 : 1,
      state: "review",
      stability: 3,
      difficulty: 5,
      elapsedDays: 2,
      scheduledDays: 3,
      reviewedAt: when,
      durationMs: 4000,
      exercise: "listen-choose",
      source: "review",
      selfAssessed: false,
    },
  };
}

export function metItem(item: string, when = "2026-01-01T00:00:00.000Z"): LearningEvent {
  return { kind: "new-item", item: item as ItemId, at: when };
}

export function spoke(item: string, when = "2026-01-01T00:00:00.000Z"): LearningEvent {
  return { kind: "spoke", item: item as ItemId, at: when };
}

export function chapterRead(story: string, chapter: number, when = "2026-01-01T00:00:00.000Z"): LearningEvent {
  return { kind: "story-chapter", story, chapter, at: when };
}
