// Durable progress (okwu.progress.v1) and the append-only review log
// (okwu.reviewlog.v1): defensive parsing, mastery and unit unlocking.
// Pure; the screens own AsyncStorage (lib/state) and call these.
import type { ContentBundle, ItemId, LessonId, TrackId, UnitId } from "@/lib/content/types";
import type { CardState, Facet, FsrsCard, LessonResult, Progress, Rating, ReviewLog, Scheduler } from "./types";

export const FACETS: readonly Facet[] = ["recognize", "recall", "listen", "speak", "tone"];
const STATES: readonly CardState[] = ["new", "learning", "review", "relearning"];

export function cardKey(item: ItemId | string, facet: Facet): string {
  return `${item}#${facet}`;
}

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, lessons: {}, unlocked: {}, minutesByDay: {} };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

function parseCard(v: unknown): FsrsCard | null {
  if (!isObj(v) || typeof v.item !== "string" || !FACETS.includes(v.facet as Facet) || !STATES.includes(v.state as CardState) || !isIso(v.due)) return null;
  const card: FsrsCard = {
    item: v.item as ItemId,
    facet: v.facet as Facet,
    state: v.state as CardState,
    due: v.due,
    stability: num(v.stability),
    difficulty: num(v.difficulty),
    elapsedDays: num(v.elapsedDays),
    scheduledDays: num(v.scheduledDays),
    step: num(v.step),
    reps: num(v.reps),
    lapses: num(v.lapses),
  };
  if (isIso(v.lastReview)) card.lastReview = v.lastReview;
  return card;
}

function parseLessonResult(v: unknown): LessonResult | null {
  if (!isObj(v) || typeof v.lesson !== "string" || !isIso(v.completedAt)) return null;
  return {
    lesson: v.lesson as LessonId,
    completedAt: v.completedAt,
    exercises: num(v.exercises),
    correctFirstTry: num(v.correctFirstTry),
    newItems: Array.isArray(v.newItems) ? (v.newItems.filter((x) => typeof x === "string") as ItemId[]) : [],
    minutes: num(v.minutes),
  };
}

/** Parse stored progress; anything unexpected falls back field by field, never throws. */
export function parseProgress(raw: string | null | undefined): Progress {
  if (!raw) return emptyProgress();
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  if (!isObj(v)) return emptyProgress();
  const out = emptyProgress();
  if (isObj(v.cards)) for (const [k, c] of Object.entries(v.cards)) {
    const card = parseCard(c);
    if (card && k === cardKey(card.item, card.facet)) out.cards[k] = card;
  }
  if (isObj(v.lessons)) for (const [k, l] of Object.entries(v.lessons)) {
    const r = parseLessonResult(l);
    if (r && r.lesson === k) out.lessons[k] = r;
  }
  if (isObj(v.unlocked)) for (const [k, u] of Object.entries(v.unlocked)) if (typeof u === "string") out.unlocked[k] = u as UnitId;
  if (isObj(v.minutesByDay)) for (const [k, m] of Object.entries(v.minutesByDay)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && num(m) > 0) out.minutesByDay[k] = num(m);
  if (isObj(v.placement) && isIso(v.placement.takenAt) && typeof v.placement.startUnit === "string") {
    out.placement = { takenAt: v.placement.takenAt, startUnit: v.placement.startUnit as UnitId };
  }
  return out;
}

export function serializeProgress(p: Progress): string {
  return JSON.stringify(p);
}

function parseLog(v: unknown): ReviewLog | null {
  if (!isObj(v) || typeof v.id !== "string" || typeof v.item !== "string" || !FACETS.includes(v.facet as Facet)) return null;
  if (![1, 2, 3, 4].includes(v.rating as number) || !STATES.includes(v.state as CardState) || !isIso(v.reviewedAt)) return null;
  const source = ["lesson", "review", "tone-trainer", "story"].includes(v.source as string) ? (v.source as ReviewLog["source"]) : "review";
  const log: ReviewLog = {
    id: v.id,
    item: v.item as ItemId,
    facet: v.facet as Facet,
    rating: v.rating as Rating,
    state: v.state as CardState,
    stability: num(v.stability),
    difficulty: num(v.difficulty),
    elapsedDays: num(v.elapsedDays),
    scheduledDays: num(v.scheduledDays),
    reviewedAt: v.reviewedAt,
    durationMs: num(v.durationMs),
    exercise: (str(v.exercise) ?? "listen-choose") as ReviewLog["exercise"],
    source,
    selfAssessed: v.selfAssessed === true,
  };
  if (typeof v.voice === "string") log.voice = v.voice as ReviewLog["voice"];
  return log;
}

/** Parse the stored review log, dropping malformed entries. */
export function parseReviewLog(raw: string | null | undefined): ReviewLog[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.map(parseLog).filter((l): l is ReviewLog => l !== null) : [];
  } catch {
    return [];
  }
}

/** Append-only: new entries go at the end; an id already present is never rewritten. */
export function appendReviewLogs(log: readonly ReviewLog[], add: readonly ReviewLog[]): ReviewLog[] {
  const ids = new Set(log.map((l) => l.id));
  const out = [...log];
  for (const l of add) {
    if (ids.has(l.id)) continue;
    ids.add(l.id);
    out.push(l);
  }
  return out;
}

export function serializeReviewLog(log: readonly ReviewLog[]): string {
  return JSON.stringify(log);
}

export function cardsOf(progress: Progress, item: ItemId | string): FsrsCard[] {
  return FACETS.map((f) => progress.cards[cardKey(item, f)]).filter((c): c is FsrsCard => c !== undefined);
}

/** Items the learner has met (any facet practised). */
export function seenItems(progress: Progress): Set<string> {
  return new Set(Object.values(progress.cards).map((c) => c.item));
}

/** Local calendar day for a time, given the device's UTC offset in minutes (e.g. +60 for BST). */
export function localDay(now: Date, utcOffsetMinutes: number): string {
  return new Date(now.getTime() + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function addMinutes(progress: Progress, day: string, minutes: number): Progress {
  if (!(minutes > 0)) return progress;
  return { ...progress, minutesByDay: { ...progress.minutesByDay, [day]: Math.round(((progress.minutesByDay[day] ?? 0) + minutes) * 10) / 10 } };
}

export type MasteryLevel = 0 | 1 | 2 | 3 | 4;
export const MASTERY_LABELS: Record<MasteryLevel, string> = { 0: "new", 1: "learning", 2: "familiar", 3: "strong", 4: "mastered" };

export interface ItemMastery {
  level: MasteryLevel;
  label: string;
  /** Lowest probability of recall across the practised skills, now. */
  retrievability: number;
  facets: Partial<Record<Facet, { state: CardState; stability: number; retrievability: number }>>;
}

/**
 * Mastery of one item from its cards: new (never practised) → learning
 * (in steps, or stability under a day) → familiar (< 7 days) → strong
 * (< 30 days) → mastered (every practised skill holds 30+ days, and it has
 * been both heard and produced).
 */
export function itemMastery(progress: Progress, item: ItemId | string, now: Date, scheduler: Scheduler): ItemMastery {
  const cards = cardsOf(progress, item);
  const facets: ItemMastery["facets"] = {};
  for (const c of cards) facets[c.facet] = { state: c.state, stability: c.stability, retrievability: scheduler.retrievability(c, now) };
  if (cards.length === 0) return { level: 0, label: MASTERY_LABELS[0], retrievability: 0, facets };
  const r = Math.min(...cards.map((c) => scheduler.retrievability(c, now)));
  const minS = Math.min(...cards.map((c) => c.stability));
  const inSteps = cards.some((c) => c.state !== "review");
  let level: MasteryLevel;
  if (inSteps || minS < 1) level = 1;
  else if (minS < 7) level = 2;
  else if (minS < 30) level = 3;
  else {
    const heard = cards.some((c) => c.facet === "listen" || c.facet === "recognize" || c.facet === "tone");
    const produced = cards.some((c) => c.facet === "recall" || c.facet === "speak");
    level = heard && produced ? 4 : 3;
  }
  return { level, label: MASTERY_LABELS[level], retrievability: r, facets };
}

export interface UnitProgress {
  unit: UnitId;
  lessonsDone: number;
  lessonsTotal: number;
  /** 0..1: average item mastery over the unit's items. */
  mastery: number;
  complete: boolean;
}

export function unitProgress(progress: Progress, bundle: ContentBundle, unitId: UnitId | string, now: Date, scheduler: Scheduler): UnitProgress {
  const unit = bundle.units[unitId];
  const lessons = unit?.lessons ?? [];
  const items = [...new Set(lessons.flatMap((l) => bundle.lessons[l]?.introduces ?? []))];
  const done = lessons.filter((l) => progress.lessons[l] !== undefined).length;
  const mastery = items.length === 0 ? 0 : items.reduce((sum, id) => sum + itemMastery(progress, id, now, scheduler).level / 4, 0) / items.length;
  return { unit: unitId as UnitId, lessonsDone: done, lessonsTotal: lessons.length, mastery: Math.round(mastery * 1000) / 1000, complete: lessons.length > 0 && done === lessons.length };
}

/** Units of a track in order. */
export function trackUnits(bundle: ContentBundle, trackId: TrackId | string): UnitId[] {
  return bundle.tracks[trackId]?.units ?? [];
}

/** The furthest unit open on a track: what was unlocked, else the placement start, else the first. */
export function furthestUnlocked(progress: Progress, bundle: ContentBundle, trackId: TrackId | string): UnitId | undefined {
  return progress.unlocked[trackId] ?? progress.placement?.startUnit ?? trackUnits(bundle, trackId)[0];
}

export function isUnitUnlocked(progress: Progress, bundle: ContentBundle, trackId: TrackId | string, unitId: UnitId | string): boolean {
  const units = trackUnits(bundle, trackId);
  const furthest = furthestUnlocked(progress, bundle, trackId);
  const at = units.indexOf(unitId as UnitId);
  return at >= 0 && furthest !== undefined && at <= units.indexOf(furthest);
}

/** Record a finished lesson and unlock the next unit of the track when its unit is complete. */
export function recordLesson(progress: Progress, bundle: ContentBundle, trackId: TrackId | string, result: LessonResult): Progress {
  const lessons = { ...progress.lessons, [result.lesson]: result };
  let next: Progress = { ...progress, lessons };
  const unitId = bundle.lessons[result.lesson]?.unit;
  const units = trackUnits(bundle, trackId);
  const unit = unitId ? bundle.units[unitId] : undefined;
  if (unit && unit.lessons.length > 0 && unit.lessons.every((l) => lessons[l] !== undefined)) {
    const at = units.indexOf(unit.id);
    const following = at >= 0 ? units[at + 1] : undefined;
    const current = furthestUnlocked(next, bundle, trackId);
    if (following && (current === undefined || units.indexOf(following) > units.indexOf(current))) {
      next = { ...next, unlocked: { ...next.unlocked, [trackId]: following } };
    }
  }
  return next;
}
