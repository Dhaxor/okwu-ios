// The one place learning meets the game (CONTRACTS §2 seam): an answer is
// recorded on the cards and the review log, its LearningEvents go to
// GameEngine.apply, and the effects come back for the screen to celebrate.
// Pure (tested against the real bundle); the hooks in ./AppState persist.
import {
  appendReviewLogs,
  applyPlacement,
  completeLesson,
  recordAnswer,
  storyChapterRead,
  type CheckOutcome,
  type Exercise,
  type LearningEvent,
  type LessonResult,
  type PlacementResult,
  type Progress,
  type ReviewLog,
  type Scheduler,
} from "@/lib/learning";
import { courseMapFrom, createGameEngine, type GameEffect, type GameEngine, type GameEngineOptions, type GameLabels, type GameState } from "@/lib/game";
import type { CollectionCatalog, MarketDay, ObodoPlace, PlantKind } from "@/lib/game/types";
import { isUsable } from "@/lib/content";
import type { ContentBundle, Item, LessonId, TrackId } from "@/lib/content/types";

export interface LearningData {
  progress: Progress;
  log: ReviewLog[];
}

/**
 * Which approved items are proverbs (Ilu) and names (Aha), and which
 * stories (Akụkọ) have chapters: a story's chapters are the `story`
 * exercises of the bundle's lessons, counted up to the highest chapter.
 */
export function catalogFrom(bundle: ContentBundle): CollectionCatalog {
  const usable = Object.values(bundle.items).filter((i) => isUsable(bundle, i));
  const chapters = new Map<string, number>();
  for (const lesson of Object.values(bundle.lessons)) {
    for (const ex of lesson.exercises) {
      if (ex.type !== "story" || !ex.items.every((id) => bundle.items[id] && isUsable(bundle, bundle.items[id] as Item))) continue;
      chapters.set(ex.story, Math.max(chapters.get(ex.story) ?? 0, ex.chapter));
    }
  }
  return {
    ilu: usable.filter((i) => i.kind === "proverb").map((i) => i.id).sort(),
    aha: usable.filter((i) => i.kind === "name").map((i) => i.id).sort(),
    akuko: [...chapters].sort(([a], [b]) => (a < b ? -1 : 1)).map(([story, n]) => ({ story, chapters: n })),
  };
}

/** The game engine for a bundle: Obodo places from the units, collections from the items. */
export function engineFor(bundle: ContentBundle, options: Omit<GameEngineOptions, "course" | "catalog"> = {}): GameEngine {
  return createGameEngine({ ...options, course: courseMapFrom(Object.values(bundle.units)), catalog: catalogFrom(bundle) });
}

const MARKET_DAYS: readonly MarketDay[] = ["eke", "orie", "afo", "nkwo"];
const PLACES: readonly ObodoPlace[] = ["home", "market", "farm", "stream", "village-square", "wedding", "homecoming"];
const CROPS: readonly PlantKind[] = ["yam", "cocoyam", "maize", "okra", "pepper", "pumpkin-leaf", "bitterleaf", "oil-palm"];

/**
 * Igbo display names for the game (market days, places, crops), taken only
 * from approved content: an item tagged `market-day:eke`, `place:market` or
 * `crop:yam` names that thing. Until such items exist the game shows its
 * English fallbacks ("Day 1", "market", "yam"). Drafts count only in a
 * development bundle, like everything else.
 */
export function gameLabelsFrom(bundle: ContentBundle): GameLabels {
  const labels: GameLabels = {};
  const tagged = (prefix: string) => {
    const out: Record<string, string> = {};
    for (const item of Object.values(bundle.items) as Item[]) {
      if (!isUsable(bundle, item)) continue;
      for (const t of item.tags) if (t.startsWith(prefix)) out[t.slice(prefix.length)] = item.spelling;
    }
    return out;
  };
  const days = tagged("market-day:");
  const places = tagged("place:");
  const crops = tagged("crop:");
  const md = Object.fromEntries(MARKET_DAYS.filter((d) => days[d]).map((d) => [d, days[d] as string]));
  const pl = Object.fromEntries(PLACES.filter((p) => places[p]).map((p) => [p, places[p] as string]));
  const cr = Object.fromEntries(CROPS.filter((c) => crops[c]).map((c) => [c, crops[c] as string]));
  if (Object.keys(md).length) labels.marketDays = md;
  if (Object.keys(pl).length) labels.places = pl;
  if (Object.keys(cr).length) labels.crops = cr;
  return labels;
}

export interface AnswerPlay {
  bundle: ContentBundle;
  learning: LearningData;
  game: GameState;
  engine: GameEngine;
  scheduler: Scheduler;
  exercise: Exercise;
  outcome: CheckOutcome;
  now: Date;
  durationMs: number;
  source: ReviewLog["source"];
}

export interface PlayResult {
  learning: LearningData;
  game: GameState;
  events: LearningEvent[];
  effects: GameEffect[];
}

function applyAll(engine: GameEngine, game: GameState, events: readonly LearningEvent[], now: Date): { game: GameState; effects: GameEffect[] } {
  let g = game;
  const effects: GameEffect[] = [];
  for (const e of events) {
    const r = engine.apply(g, e, now);
    g = r.state;
    effects.push(...r.effects);
  }
  return { game: g, effects };
}

/** One checked answer: cards, review log, then the game. A skip changes nothing. */
export function playAnswer(input: AnswerPlay): PlayResult {
  const { bundle, learning, exercise, outcome, now } = input;
  if (outcome.skipped) return { learning, game: input.game, events: [], effects: [] };
  const r = recordAnswer({ bundle, progress: learning.progress, exercise, outcome, now, durationMs: input.durationMs, source: input.source, scheduler: input.scheduler });
  const events = [...r.events];
  if (exercise.spec.type === "story") events.push(storyChapterRead(exercise.spec.story, exercise.spec.chapter, now));
  const g = applyAll(input.engine, input.game, events, now);
  return { learning: { progress: r.progress, log: appendReviewLogs(learning.log, r.logs) }, game: g.game, events, effects: g.effects };
}

export interface LessonPlay {
  bundle: ContentBundle;
  learning: LearningData;
  game: GameState;
  engine: GameEngine;
  track: TrackId | string;
  lesson: LessonId;
  startedAt: Date;
  now: Date;
  exercises: number;
  correctFirstTry: number;
  utcOffsetMinutes: number;
}

/** Finish a lesson: record it (unlocking what follows), count the minutes, tell the game. */
export function playLessonComplete(input: LessonPlay): PlayResult & { result: LessonResult } {
  const c = completeLesson({
    bundle: input.bundle,
    progress: input.learning.progress,
    track: input.track,
    lesson: input.lesson,
    startedAt: input.startedAt,
    now: input.now,
    exercises: input.exercises,
    correctFirstTry: input.correctFirstTry,
    utcOffsetMinutes: input.utcOffsetMinutes,
  });
  const g = applyAll(input.engine, input.game, c.events, input.now);
  return { learning: { ...input.learning, progress: c.progress }, game: g.game, events: c.events, effects: g.effects, result: c.result };
}

/** Store a placement: the start unit opens on the chosen track. */
export function playPlacement(learning: LearningData, placement: PlacementResult, now: Date): LearningData {
  return { ...learning, progress: applyPlacement(learning.progress, placement, now.toISOString()) };
}

/** The device's UTC offset in minutes (e.g. +60 for BST), for local practice days. */
export function utcOffsetMinutes(now: Date): number {
  return -now.getTimezoneOffset();
}
