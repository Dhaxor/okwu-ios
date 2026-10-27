// Placement: route a learner to the New or Heritage track, and to a start
// unit. Heritage learners "understand but can't speak" (RESEARCH §2), so
// the check is listening only, kindly framed, and a low score is never a
// failure: it means starting with the sounds, where they will move fast.
import { isUsable } from "@/lib/content/bundle";
import type { ContentBundle, IsoTime, Track, TrackId, UnitId } from "@/lib/content/types";
import { permutation, rng, subSeed } from "./rng";
import type { Exercise, Progress } from "./types";

/** Below this share of correct answers the New track fits better (chance with 4 options is 25%). */
export const HERITAGE_MIN_ACCURACY = 0.5;

export interface PlacementInput {
  bundle: ContentBundle;
  /** Onboarding: "I understand some Igbo already". */
  understandsSome: boolean;
  /** Answers to the placement check, if taken (in any order). */
  answers?: readonly { correct: boolean }[];
}

export type PlacementReason =
  /** Said they are new: New track from the start. */
  | "self-report-new"
  /** Said they understand some but skipped the check: Heritage track from its start. */
  | "heritage-no-check"
  /** The check went well: Heritage track, possibly skipping ahead. */
  | "heritage-placed"
  /** The check suggests starting with the sounds on the New track. */
  | "start-with-sounds";

export interface PlacementResult {
  track: TrackId;
  kind: Track["kind"];
  startUnit: UnitId;
  correct: number;
  total: number;
  reason: PlacementReason;
}

function trackOf(bundle: ContentBundle, kind: Track["kind"]): Track | undefined {
  return Object.values(bundle.tracks).find((t) => t.kind === kind);
}

/** The placement check for the heritage track: its authored listening exercises, option order seeded. */
export function placementQuiz(bundle: ContentBundle, seed: number): Exercise[] {
  const track = trackOf(bundle, "heritage");
  const lesson = track?.placement ? bundle.lessons[track.placement.lesson] : undefined;
  if (!lesson) return [];
  const usable = (id: string) => {
    const item = bundle.items[id];
    return item !== undefined && isUsable(bundle, item);
  };
  return lesson.exercises
    .filter((spec) => spec.type === "listen-choose" && usable(spec.prompt) && spec.options.every(usable))
    .map((spec, i) => {
      const s = subSeed(seed, `placement:${i}`);
      const n = spec.type === "listen-choose" ? spec.options.length : 0;
      return { id: `placement-${i}`, spec, order: permutation(n, rng(s)), seed: s };
    });
}

export function placeLearner(input: PlacementInput): PlacementResult {
  const fresh = trackOf(input.bundle, "new-learner");
  const heritage = trackOf(input.bundle, "heritage");
  const answers = input.answers ?? [];
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const start = (t: Track | undefined) => (t?.units[0] ?? Object.values(input.bundle.units)[0]?.id ?? ("" as UnitId)) as UnitId;
  const result = (t: Track | undefined, reason: PlacementReason, startUnit?: UnitId): PlacementResult => ({
    track: (t?.id ?? "") as TrackId,
    kind: t?.kind ?? "new-learner",
    startUnit: startUnit ?? start(t),
    correct,
    total,
    reason,
  });
  if (!input.understandsSome || !heritage) return result(fresh ?? heritage, "self-report-new");
  if (total === 0) return result(heritage, "heritage-no-check");
  if (correct / total < HERITAGE_MIN_ACCURACY) return result(fresh ?? heritage, "start-with-sounds");
  const skips = Object.entries(heritage.placement?.skipsTo ?? {})
    .map(([k, unit]) => ({ at: Number(k), unit }))
    .filter((s) => Number.isFinite(s.at) && s.at <= correct && heritage.units.includes(s.unit))
    .sort((a, b) => b.at - a.at);
  return result(heritage, "heritage-placed", skips[0]?.unit ?? start(heritage));
}

/** Store the placement: the start unit is unlocked on the chosen track. */
export function applyPlacement(progress: Progress, placement: PlacementResult, takenAt: IsoTime): Progress {
  return {
    ...progress,
    placement: { takenAt, startUnit: placement.startUnit },
    unlocked: { ...progress.unlocked, [placement.track]: progress.unlocked[placement.track] ?? placement.startUnit },
  };
}
