// Product rules for the game layer, as data. rules.test.ts locks the ones
// the plan decided; tune the numbers marked "tunable" with real data.
import type { MarketDay, ObodoPlace, QuestMetric, UbiCrop, XpSource } from "./types";

export const MARKET_DAYS: readonly MarketDay[] = ["eke", "orie", "afo", "nkwo"];

export const IZU = {
  /** Days practised per 4-day izu to keep the chain (one rest day built in). */
  daysRequired: 3,
  daysPerIzu: 4,
  /** A broken chain is repaired by this many lessons … */
  repairLessons: 3,
  /** … within this many hours of the miss. */
  repairWindowHours: 48,
  /** One Homecoming revival per calendar year. */
  revivalsPerYear: 1,
} as const;

/**
 * A known date and its market day, so the cycle can be computed offline.
 * Must come from a verified source (cultural advisor); until then the izu
 * runs on device-local 4-day cycles from the learner's first day.
 */
export const MARKET_DAY_ANCHOR: { date: string; day: MarketDay } | null = null;

/** What makes a day count toward the izu: one lesson or story chapter, or this many smaller practices (reviews, words spoken). Tunable. */
export const TOUCHES_PER_PRACTICE_DAY = 5;

/** XP weights: new learning and speaking count most; re-practice is capped. Tunable. */
export const XP: Record<XpSource, number> = {
  "new-item": 10,
  speaking: 8,
  lesson: 20,
  review: 2,
  story: 15,
  mission: 25,
};

/** Review XP per item per day stops after this many grants (no XP farming). Tunable. */
export const REVIEW_XP_PER_ITEM_PER_DAY = 2;

/** Speaking XP per item per day stops after this many grants. Tunable. */
export const SPEAKING_XP_PER_ITEM_PER_DAY = 2;

/** A lesson done again (after its first completion) earns this, once per lesson per day. Tunable. */
export const REPEAT_LESSON_XP = 5;

/** Garden growth points per stage. Tunable. */
export const GROWTH_POINTS_PER_STAGE = 30;

/** Ubi, the garden. Tunable except `crops` (from the plan) and that nothing ever wilts. */
export const UBI = {
  /** Mixed cropping, sown in this rotation: ji, ede, ugu, ọka. */
  crops: ["yam", "cocoyam", "pumpkin-leaf", "maize"] as readonly UbiCrop[],
  plots: 8,
  /** Growth points each practice gives every growing plant. */
  growth: { lesson: 10, "new-item": 2, speaking: 2, review: 1, story: 6, mission: 8 } as Record<XpSource, number>,
  /** A new seed is sown once the youngest growing plant reaches this stage (it staggers the garden). */
  sowAtStage: 1,
  maxGrowing: 4,
  /** After this many days away the garden shows as resting (never wilting). */
  restAfterDays: 3,
  /** In the Iri Ji window plants grow faster and each ripe plant gives this many at harvest. */
  festivalGrowth: 2,
  festivalYield: 2,
} as const;

/**
 * Seasonal windows as local month-day ranges (inclusive). Placeholder dates:
 * each community sets its own Iri Ji day, so a cultural advisor confirms
 * the window before launch. Homecoming wraps the new year.
 */
export const FESTIVALS = {
  "iri-ji": { from: "08-01", to: "10-15" },
  homecoming: { from: "12-15", to: "01-10" },
} as const;

/** The seven places of the obodo, restored in this order. */
export const OBODO_PLACES: readonly ObodoPlace[] = ["home", "market", "farm", "stream", "village-square", "wedding", "homecoming"];

/** Without a course map, lessons restore places in order, this many per place. Tunable. */
export const LESSONS_PER_PLACE_FALLBACK = 6;

/** Ọgbọ weekly quests: a shared target of `perMember` × members. Copy is English; tunable. */
export const QUESTS: readonly { id: string; metric: QuestMetric; perMember: number; title: string; detail: string }[] = [
  { id: "speak-together", metric: "speaking", perMember: 30, title: "Speak together", detail: "Say words aloud, all of you together." },
  { id: "lessons-together", metric: "lessons", perMember: 5, title: "Lessons together", detail: "Finish lessons as a cohort." },
  { id: "words-together", metric: "new-words", perMember: 20, title: "New words together", detail: "Learn new words between you." },
  { id: "story-circle", metric: "stories", perMember: 3, title: "Story circle", detail: "Read story chapters together." },
  { id: "market-days", metric: "practice-days", perMember: 4, title: "Market days together", detail: "Practise on as many days as you can." },
];

/** Notifications: at most one a day, never written to make anyone feel guilty. */
export const MAX_NOTIFICATIONS_PER_DAY = 1;

/** Away this long, reminders thin out (every 3rd day, then weekly), and they stop after `stopAfterDays`. */
export const NOTIFICATION_CADENCE = { dailyUntilDays: 7, everyThirdUntilDays: 30, weeklyUntilDays: 90, stopAfterDays: 90 } as const;

/** Words our copy never uses (guilt, loss, pressure). notifications.test.ts and copy tests check every string. */
export const GUILT_WORDS = [
  "miss",
  "missed",
  "lose",
  "lost",
  "losing",
  "broke",
  "broken",
  "fail",
  "failed",
  "don't let",
  "hurry",
  "last chance",
  "disappoint",
  "sad",
  "forgot",
  "forget",
  "shame",
  "guilt",
  "streak",
  "die",
  "dead",
  "wilt",
] as const;

/** Mechanics Okwu never ships (RESEARCH §5, PLAN). */
export const BANNED_MECHANICS = ["hearts", "energy", "paid-boosts", "loot-boxes", "paid-streak-repair", "leaderboard-by-default"] as const;
