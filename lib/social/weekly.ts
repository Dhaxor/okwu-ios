// Weeks and the weekly shared goals, in one place for the server
// (server/src), the development stand-in (lib/state/mockSocial) and the
// screens. Pure; tested in weekly.test.ts.
//
// A week is the calendar week the server already uses for Ọgbọ cohorts:
// Monday 00:00 UTC to the next Monday (`mondayOf`, keyed "YYYY-MM-DD").
// Everything weekly rolls over together: the cohort quest and the Family
// Circle challenge.
//
// Both goals are co-op only. Nobody is ranked, nothing is lost when a week
// ends unfinished, and a new goal simply starts on Monday.
import type { CohortQuest } from "./types";
import type { FamilyChallengeKind } from "./protocol";

export const WEEK_DAY_MS = 86_400_000;
const WEEK_MS = 7 * WEEK_DAY_MS;

/** Monday 00:00 UTC of the week containing `ms`, as YYYY-MM-DD. */
export function mondayOf(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDay() || 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1))).toISOString().slice(0, 10);
}

/** Monday 00:00 UTC after `ms` (when this week's goals end). */
export function nextMonday(ms: number): number {
  return Date.parse(`${mondayOf(ms)}T00:00:00Z`) + WEEK_MS;
}

/** Weeks since 1970 for a week key (a stable rotation index). */
function weekIndex(week: string): number {
  return Math.floor(Date.parse(`${week}T00:00:00Z`) / WEEK_MS);
}

// ---------------------------------------------------------------------------
// Ọgbọ cohort quest
// ---------------------------------------------------------------------------

export type CohortGoalKind = CohortQuest["goal"]["kind"];

/** Per-member weekly cohort goals; the kind rotates week by week. */
export const COHORT_GOALS: readonly { kind: CohortGoalKind; perMember: number }[] = [
  { kind: "reviews", perMember: 60 },
  { kind: "lessons", perMember: 5 },
  { kind: "minutes", perMember: 45 },
];

export function cohortGoalFor(week: string, members: number): CohortQuest["goal"] {
  const g = COHORT_GOALS[weekIndex(week) % COHORT_GOALS.length] ?? COHORT_GOALS[0]!;
  return { kind: g.kind, target: g.perMember * Math.max(1, members) };
}

// ---------------------------------------------------------------------------
// Family Circle weekly challenge
// ---------------------------------------------------------------------------

/** Per member, and the most any one week asks of a circle. */
export const FAMILY_CHALLENGES: Record<FamilyChallengeKind, { perMember: number; max: number }> = {
  lessons: { perMember: 3, max: 30 },
  words: { perMember: 8, max: 80 },
  "voice-replies": { perMember: 2, max: 20 },
};

/** A stable number for a circle id (FNV-1a), so circles don't all get the same challenge the same week. */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The kinds a circle may be offered this week. Voice-reply challenges need
 * voice notes switched on (`flags.voiceNotes`) and someone to reply to.
 */
export function familyChallengeKinds(opts: { voiceNotes: boolean; members: number }): FamilyChallengeKind[] {
  return opts.voiceNotes && opts.members >= 2 ? ["lessons", "words", "voice-replies"] : ["lessons", "words"];
}

/**
 * This week's challenge for a circle: the kind rotates week by week (offset
 * per circle), and the target is fixed when the week's challenge starts, so
 * someone joining mid-week never pushes the finish line away.
 */
export function familyChallengeFor(circle: string, week: string, opts: { voiceNotes: boolean; members: number }): { kind: FamilyChallengeKind; target: number } {
  const kinds = familyChallengeKinds(opts);
  const kind = kinds[(weekIndex(week) + (seedOf(circle) % kinds.length)) % kinds.length] ?? "lessons";
  return { kind, target: familyTarget(kind, opts.members) };
}

export function familyTarget(kind: FamilyChallengeKind, members: number): number {
  const c = FAMILY_CHALLENGES[kind];
  return Math.min(c.max, c.perMember * Math.max(1, Math.floor(members)));
}
