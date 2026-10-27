// The Practice trainers' daily allowance, pure (trainers.test.ts). The hook
// is ./useTrainerSessions.ts.
//
// Okwu Plus's rule (lib/state/plus.ts): the tone trainer and the speaking
// trainer each give FREE_TRAINER_SESSIONS_PER_DAY free sessions a day; Plus
// takes the limit away. Daily review and the dictionary are never limited.
// A session counts when it starts; the check happens only before a session,
// so nothing ever stops a learner mid-session (the paywall opens softly
// from the trainer's start screen instead).
import type { PlusFeature, PlusUse } from "@/lib/state/plus";

export const TRAINER_SESSIONS_KEY = "okwu.trainersessions.v1";

export type TrainerKind = Extract<PlusFeature, "tone-trainer" | "speaking-trainer">;
export const TRAINER_KINDS: readonly TrainerKind[] = ["tone-trainer", "speaking-trainer"];

export interface TrainerSessions {
  /** The local day the counts are for (YYYY-MM-DD); a new day starts from zero. */
  date: string;
  counts: Partial<Record<TrainerKind, number>>;
}

export const EMPTY_SESSIONS: TrainerSessions = { date: "", counts: {} };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseTrainerSessions(raw: string | null | undefined): TrainerSessions {
  if (!raw) return { date: "", counts: {} };
  try {
    const v = JSON.parse(raw) as { date?: unknown; counts?: Record<string, unknown> };
    if (typeof v?.date !== "string" || !DAY.test(v.date) || typeof v.counts !== "object" || v.counts === null) return { date: "", counts: {} };
    const counts: TrainerSessions["counts"] = {};
    for (const k of TRAINER_KINDS) {
      const n = v.counts[k];
      if (typeof n === "number" && Number.isInteger(n) && n > 0) counts[k] = n;
    }
    return { date: v.date, counts };
  } catch {
    return { date: "", counts: {} };
  }
}

/** Sessions of a trainer already started today. */
export function sessionsToday(s: TrainerSessions, kind: TrainerKind, today: string): number {
  return s.date === today ? (s.counts[kind] ?? 0) : 0;
}

/** Count a session that is starting now. */
export function countSession(s: TrainerSessions, kind: TrainerKind, today: string): TrainerSessions {
  const base = s.date === today ? s.counts : {};
  return { date: today, counts: { ...base, [kind]: (base[kind] ?? 0) + 1 } };
}

export type TrainerGate = "open" | "plus";

/**
 * May a new session start? Asks Plus with the exact feature names and
 * today's count (usePlus().can). "plus": open /paywall?from=trainer from the
 * start screen, never mid-session.
 */
export function trainerGate(can: (feature: PlusFeature, use?: PlusUse) => boolean, kind: TrainerKind, today: number): TrainerGate {
  return can(kind, { sessionsToday: today }) ? "open" : "plus";
}

/** The start screen's note once the free session is used, kind and plain. */
export function allowanceNote(kind: TrainerKind): { title: string; body: string } {
  const what = kind === "tone-trainer" ? "tone trainer" : "speaking session";
  return {
    title: "Today's free session is done",
    body: `Your free ${what} comes back tomorrow. With Okwu Plus you can practise as long as you like. Daily review and the dictionary are always free.`,
  };
}
