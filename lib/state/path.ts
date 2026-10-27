// The Learn tab's path: a track's units in order, each framed by the
// Obodo place it restores, with its lessons and whether they are done,
// next, open or still locked. Also the word of the day. Pure (tested).
import { hasTones, isUsable, lessonsOfUnit, needsDraftTag } from "@/lib/content";
import type { ContentBundle, Item, Lesson, LessonId, TrackId, Unit, UnitId } from "@/lib/content/types";
import { isUnitUnlocked, planSession, seedFrom, trackUnits, type LearnerSettings, type Progress, type Scheduler } from "@/lib/learning";
import type { ObodoPlace } from "@/lib/game/types";

export type PathStatus = "done" | "next" | "open" | "locked";

export interface PathLesson {
  id: LessonId;
  title: string;
  /** 1-based position in its unit. */
  number: number;
  estMinutes: number;
  status: PathStatus;
  /** Shows a "Draft · pending native review" tag. */
  draft: boolean;
}

export interface PathUnit {
  id: UnitId;
  /** 1-based position in the track. */
  number: number;
  title: string;
  theme: string;
  cefr: Unit["cefr"];
  free: boolean;
  place: ObodoPlace | null;
  status: PathStatus;
  lessons: PathLesson[];
  done: number;
}

export interface LearnPath {
  track: TrackId | null;
  units: PathUnit[];
  /** What "Continue" opens: the first lesson not done in an open unit (null when all are done). */
  next: { unit: PathUnit; lesson: PathLesson } | null;
  lessonsDone: number;
  lessonsTotal: number;
}

const PLACES: readonly string[] = ["home", "market", "farm", "stream", "village-square", "wedding", "homecoming"];

/** The track to show: the learner's, else the bundle's track of that kind, else the first. */
export function resolveTrack(bundle: ContentBundle, wanted: string): TrackId | null {
  if (wanted && bundle.tracks[wanted]) return wanted as TrackId;
  const byKind = Object.values(bundle.tracks).find((t) => t.kind === wanted);
  if (byKind) return byKind.id;
  return (Object.values(bundle.tracks)[0]?.id ?? null) as TrackId | null;
}

/** A lesson needs the draft tag when it, or anything it teaches, is not approved yet. */
export function lessonIsDraft(bundle: ContentBundle, lesson: Lesson): boolean {
  if (lesson.status !== "approved") return true;
  return lesson.introduces.some((id) => {
    const item = bundle.items[id];
    return !item || needsDraftTag(item);
  });
}

export function buildPath(bundle: ContentBundle, progress: Progress, wantedTrack: string): LearnPath {
  const track = resolveTrack(bundle, wantedTrack);
  if (!track) return { track: null, units: [], next: null, lessonsDone: 0, lessonsTotal: 0 };
  const units: PathUnit[] = [];
  let next: LearnPath["next"] = null;
  let lessonsDone = 0;
  let lessonsTotal = 0;
  trackUnits(bundle, track).forEach((unitId, i) => {
    const unit = bundle.units[unitId];
    if (!unit) return;
    const unlocked = isUnitUnlocked(progress, bundle, track, unitId);
    const lessons: PathLesson[] = lessonsOfUnit(bundle, unitId).map((l, j) => ({
      id: l.id,
      title: l.title,
      number: j + 1,
      estMinutes: l.estMinutes,
      status: progress.lessons[l.id] ? "done" : unlocked ? "open" : "locked",
      draft: lessonIsDraft(bundle, l),
    }));
    const done = lessons.filter((l) => l.status === "done").length;
    lessonsDone += done;
    lessonsTotal += lessons.length;
    const pathUnit: PathUnit = {
      id: unit.id,
      number: i + 1,
      title: unit.title,
      theme: unit.theme,
      cefr: unit.cefr,
      free: unit.free,
      place: unit.obodoPlace && PLACES.includes(unit.obodoPlace) ? (unit.obodoPlace as ObodoPlace) : null,
      status: !unlocked ? "locked" : lessons.length > 0 && done === lessons.length ? "done" : "open",
      lessons,
      done,
    };
    units.push(pathUnit);
  });
  // "Continue" starts where the placement put the learner (6 of 8 skips Units 0-1);
  // the earlier units stay open, and come back as next once everything after is done.
  const startAt = progress.placement ? units.findIndex((u) => u.id === progress.placement?.startUnit) : -1;
  const order = startAt > 0 ? [...units.slice(startAt), ...units.slice(0, startAt)] : units;
  for (const unit of order) {
    if (unit.status === "locked") continue;
    const first = unit.lessons.find((l) => l.status === "open");
    if (first) {
      first.status = "next";
      unit.status = "next";
      next = { unit, lesson: first };
      break;
    }
  }
  return { track, units, next, lessonsDone, lessonsTotal };
}

/**
 * The path with its next lesson's "About N min" taken from the session its
 * lesson screen will plan (`planSession`, as `app/lesson/[id]` calls it).
 * The stamped `Lesson.estMinutes` assumes a returning learner with due
 * reviews mixed in; with none due (the very first lessons) the path said 7
 * while the intro said 5. Other lessons keep the stamped estimate.
 */
export function withPlannedNext(path: LearnPath, input: { bundle: ContentBundle; progress: Progress; settings: LearnerSettings; scheduler: Scheduler; now: Date }): LearnPath {
  const next = path.next;
  if (!next || !input.bundle.lessons[next.lesson.id]) return path;
  const plan = planSession({ ...input, seed: seedFrom(`estimate:${next.lesson.id}`), mode: "lesson", lesson: next.lesson.id });
  const minutes = plan.estMinutes;
  if (minutes <= 0 || minutes === next.lesson.estMinutes) return path;
  const lesson: PathLesson = { ...next.lesson, estMinutes: minutes };
  const unit: PathUnit = { ...next.unit, lessons: next.unit.lessons.map((l) => (l.id === lesson.id ? lesson : l)) };
  return { ...path, units: path.units.map((u) => (u.id === unit.id ? unit : u)), next: { unit, lesson } };
}

/** Days since 1970 for a local YYYY-MM-DD. */
function dayNumber(day: string): number {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
}

/**
 * The word of the day: a usable word, name or short phrase with authored
 * tones, the same all day and different from yesterday's. Items the
 * learner has met come first, so the card reinforces; then the rest.
 */
export function wordOfTheDay(bundle: ContentBundle, day: string, seen: ReadonlySet<string> = new Set()): Item | null {
  const pool = Object.values(bundle.items)
    .filter((i) => isUsable(bundle, i) && hasTones(i) && (i.kind === "word" || i.kind === "name" || i.kind === "phrase"))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (pool.length === 0) return null;
  const met = pool.filter((i) => seen.has(i.id));
  const from = met.length >= 3 ? met : pool;
  return from[dayNumber(day) % from.length] ?? null;
}
