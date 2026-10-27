// Keeping the social server up to date from the phone. Pure and tested
// (communitySync.test.ts); the hook that runs it is ./useCommunitySync.ts.
//
// 1. Progress counts (POST /api/progress): this week's reviews, lessons,
//    minutes and new words, as week-to-date totals (the server keeps the
//    highest it has seen, so a repeat changes nothing). Counts only, never
//    which words or what was said. They feed friend streaks, the Ọgbọ cohort
//    quest and the Family Circle challenge. The week is the server's:
//    Monday 00:00 UTC (lib/social/weekly).
// 2. The Expo push token, for community notifications (a voice note, a
//    friend request, a guardian request, a finished family challenge).
//    Registered only once the learner has turned notifications on (the
//    daily-reminder switch, whose permission is asked at that moment); this
//    module never asks. Turning them off unregisters it; signing out tells
//    the server to forget it. Re-registered weekly so the server knows the
//    phone is still there (it forgets tokens not refreshed for 120 days).
import type { Progress, ReviewLog } from "@/lib/learning/types";
import { mondayOf, type ProgressInput } from "@/lib/social";

/** At most one progress post a minute (the server allows 120 an hour). */
export const PROGRESS_MIN_GAP_MS = 60_000;
/** Re-register the push token this often even when nothing changed. */
export const PUSH_REFRESH_MS = 7 * 86_400_000;
export const PUSH_CACHE_KEY = "okwu.pushtoken.v1";

/** This week's counts, for POST /api/progress. `day` is the phone's own date (the server checks it is near today). */
export function weekTotals(progress: Progress, reviewLog: readonly ReviewLog[], now: Date, day: string): ProgressInput {
  const monday = mondayOf(now.getTime());
  const start = Date.parse(`${monday}T00:00:00Z`);
  const end = now.getTime();
  const inWeek = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= start && t <= end;
  };
  let reviews = 0;
  // A new word is one whose first review ever falls in this week.
  const first = new Map<string, number>();
  for (const l of reviewLog) {
    if (inWeek(l.reviewedAt)) reviews++;
    const t = Date.parse(l.reviewedAt);
    if (!Number.isFinite(t)) continue;
    const seen = first.get(l.item);
    if (seen === undefined || t < seen) first.set(l.item, t);
  }
  let words = 0;
  for (const t of first.values()) if (t >= start && t <= end) words++;
  const lessons = Object.values(progress.lessons ?? {}).filter((r) => inWeek(r.completedAt)).length;
  let minutes = 0;
  for (const [d, m] of Object.entries(progress.minutesByDay ?? {})) if (d >= monday && d <= day && Number.isFinite(m)) minutes += Math.max(0, m);
  return { day, reviews, lessons, minutes: Math.round(minutes), words };
}

/** What changed since the last post (the week and the counts; the day alone doesn't matter). */
export function progressKey(t: ProgressInput, now: Date): string {
  return [mondayOf(now.getTime()), t.reviews, t.lessons, t.minutes, t.words ?? 0].join(":");
}

/** Worth posting? Something to report, and different from what was last posted. */
export function shouldPostProgress(t: ProgressInput, now: Date, lastKey: string | null): boolean {
  if (t.reviews + t.lessons + t.minutes + (t.words ?? 0) === 0) return false;
  return progressKey(t, now) !== lastKey;
}

export interface PushCache {
  token: string;
  /** The account the token was registered for. */
  account: string;
  at: number;
}

export function parsePushCache(raw: unknown): PushCache | null {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return typeof o.token === "string" && typeof o.account === "string" && typeof o.at === "number" ? { token: o.token, account: o.account, at: o.at } : null;
}

export type PushAction = { kind: "register"; token: string } | { kind: "unregister"; token: string } | { kind: "none" };

/**
 * What to tell the server about this phone's push token.
 * `wanted`: notifications are on (the switch, and the permission granted
 * when the learner chose them) and there is an account.
 */
export function pushAction(input: { wanted: boolean; token: string | null; account: string | null; cached: PushCache | null; now: number }): PushAction {
  const { wanted, token, account, cached, now } = input;
  if (!wanted || !account) return cached && (!wanted || cached.account === account) ? { kind: "unregister", token: cached.token } : { kind: "none" };
  if (!token) return { kind: "none" };
  if (!cached || cached.token !== token || cached.account !== account || now - cached.at > PUSH_REFRESH_MS) return { kind: "register", token };
  return { kind: "none" };
}

/** The language tag the server keeps with a token ("en", "en-GB"): the server only accepts this shape. */
export function deviceLang(locale: string | undefined): string {
  const m = /^([a-z]{2})(?:[-_]([A-Za-z]{2})(?![A-Za-z]))?/.exec(locale ?? "");
  return m ? (m[2] ? `${m[1]}-${m[2].toUpperCase()}` : m[1]!) : "en";
}
