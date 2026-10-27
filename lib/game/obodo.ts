// Obodo, the hometown (docs/CONTRACTS.md §3): seven places restored unit by
// unit (home, market, farm, stream, village square, wedding, homecoming).
// Each place climbs stages 0 → 3 as the lessons of its units are done:
// 1 when the first lesson is done, 2 at half, 3 when all are done. Stages
// only rise.
//
// Which place a lesson restores comes from a CourseMap that screens build
// from the content bundle (each Unit carries `obodoPlace`). Lessons the map
// does not know restore places in order, LESSONS_PER_PLACE_FALLBACK each.
import { LESSONS_PER_PLACE_FALLBACK, OBODO_PLACES } from "./rules";
import type { CourseMap, GameEffect, ObodoPlace, ObodoStage, ObodoState, ObodoView } from "./types";

export function isObodoPlace(p: unknown): p is ObodoPlace {
  return typeof p === "string" && (OBODO_PLACES as readonly string[]).includes(p);
}

/**
 * Build a CourseMap from units (structurally the content Unit: id, lessons,
 * obodoPlace). Unknown place names are ignored rather than trusted.
 */
export function courseMapFrom(units: readonly { id: string; lessons: readonly string[]; obodoPlace?: string }[]): CourseMap {
  const map: CourseMap = { lessons: {}, units: {} };
  for (const u of units) {
    map.units[u.id] = { place: isObodoPlace(u.obodoPlace) ? u.obodoPlace : null, lessons: u.lessons.length };
    for (const l of u.lessons) map.lessons[l] = { unit: u.id };
  }
  return map;
}

function stageFor(done: number, total: number): ObodoStage {
  if (done <= 0 || total <= 0) return 0;
  if (done >= total) return 3;
  return done * 2 >= total ? 2 : 1;
}

/** Lessons done and lessons in total, per place. */
export function placeProgress(lessonsDone: readonly string[], course: CourseMap | null): Record<ObodoPlace, { done: number; total: number }> {
  const out = Object.fromEntries(OBODO_PLACES.map((p) => [p, { done: 0, total: 0 }])) as Record<ObodoPlace, { done: number; total: number }>;
  if (course) {
    for (const u of Object.values(course.units)) if (u.place) out[u.place].total += u.lessons;
  }
  let unmapped = 0;
  for (const lesson of lessonsDone) {
    const unit = course?.lessons[lesson]?.unit;
    const place = unit ? course?.units[unit]?.place : null;
    if (place) {
      out[place].done += 1;
      continue;
    }
    const fallback = OBODO_PLACES[Math.min(OBODO_PLACES.length - 1, Math.floor(unmapped / LESSONS_PER_PLACE_FALLBACK))] as ObodoPlace;
    out[fallback].done += 1;
    unmapped += 1;
  }
  // Places restored by the fallback count need a total to measure against.
  for (const p of OBODO_PLACES) if (out[p].total === 0 && out[p].done > 0) out[p].total = LESSONS_PER_PLACE_FALLBACK;
  for (const p of OBODO_PLACES) out[p].total = Math.max(out[p].total, out[p].done);
  return out;
}

/** Recompute stages; any that rose become effects (in place order). */
export function restore(obodo: ObodoState, lessonsDone: readonly string[], course: CourseMap | null): { obodo: ObodoState; effects: GameEffect[] } {
  const progress = placeProgress(lessonsDone, course);
  const effects: GameEffect[] = [];
  const places = { ...obodo.places };
  for (const p of OBODO_PLACES) {
    const next = stageFor(progress[p].done, progress[p].total);
    if (next > places[p]) {
      places[p] = next;
      effects.push({ kind: "obodo", place: p, stage: next as 1 | 2 | 3 });
    }
  }
  return { obodo: { places }, effects };
}

export function obodoView(obodo: ObodoState, lessonsDone: readonly string[], course: CourseMap | null): ObodoView {
  const progress = placeProgress(lessonsDone, course);
  const places = OBODO_PLACES.map((place) => {
    const { done, total } = progress[place];
    return { place, stage: obodo.places[place], progress: obodo.places[place] >= 3 ? 1 : total > 0 ? Math.min(1, done / total) : 0 };
  });
  return {
    places,
    restored: places.filter((p) => p.stage >= 3).length,
    next: places.find((p) => p.stage < 3)?.place ?? null,
  };
}
