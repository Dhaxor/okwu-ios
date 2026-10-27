// The notification plan: at most one positive notification per local day,
// as data (copy and timing). Screens (D) schedule local notifications from
// it and the server (C) counts its push "daily-reminder" against the same
// one-a-day limit. Re-plan on every app open and after any practice: the
// stable per-day ids make a re-plan replace, never stack.
//
// Rules:
// - Nothing on a day already practised, nothing on a rest day (the izu is
//   kept), nothing in the past.
// - Away a while, reminders thin out: daily for a week, then every third
//   day, then weekly, and they stop after 90 days.
// - Teens get no chain nudges (no reward-loop pressure for under-18s).
// - Copy is English, warm and specific. It never uses the words in
//   GUILT_WORDS (tested).
import { addDays, dayIndex, daysBetween, festivalOn, weekKey } from "./calendar";
import { questTotal } from "./cohort";
import { daysNeeded, type IzuContext } from "./izu";
import { IZU, NOTIFICATION_CADENCE } from "./rules";
import type { GameState, LocalDate, NotificationKind, NotificationPrefs, PlannedNotification } from "./types";

type Copy = { title: string; body: string };

/** Variants rotate by date so the same words do not repeat day after day. `{…}` slots are filled in. */
export const NOTIFICATION_COPY: Record<NotificationKind, readonly Copy[]> = {
  repair: [
    { title: "Your chain can carry on", body: "Three short lessons by the end of {deadlineDay} mend it." },
    { title: "A little mending", body: "Three short lessons keep your market-day chain going." },
  ],
  "izu-one-more": [
    { title: "One more market day", body: "A short lesson today keeps your chain going." },
    { title: "Nearly a full market week", body: "One more day of practice and this one is kept." },
  ],
  harvest: [
    { title: "Your garden is ready", body: "Ripe crops are waiting to be gathered." },
    { title: "Harvest time", body: "Something in your garden is ready to bring in." },
  ],
  quest: [
    { title: "Your cohort is on its way", body: "Together you are {percent}% of the way to this week's goal." },
    { title: "Practising together", body: "Your cohort is {percent}% there. Every lesson adds to it." },
  ],
  festival: [
    { title: "{festival}", body: "{festivalLine}" },
  ],
  "welcome-back": [
    { title: "Welcome back, whenever you like", body: "Your garden waited for you. Five minutes is plenty." },
    { title: "Your words are still here", body: "Pick up right where you were, at your own pace." },
  ],
  word: [
    { title: "A little Igbo today", body: "Hear a word, say it once, and that counts." },
    { title: "Your next lesson is ready", body: "It takes about five minutes." },
    { title: "Five calm minutes", body: "A short lesson is ready when you are." },
  ],
};

const FESTIVAL_COPY = {
  "iri-ji": { name: "New Yam season", line: "Your garden grows twice as fast this season." },
  homecoming: { name: "Homecoming season", line: "A good time to learn words to use with family." },
} as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function weekdayOf(key: LocalDate): string {
  return WEEKDAYS[(((dayIndex(key) + 4) % 7) + 7) % 7] as string;
}

function fill(text: string, slots: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? "");
}

/** May a reminder go out on `date`, given how long the learner has been away? */
export function cadenceAllows(lastPractice: LocalDate, date: LocalDate): boolean {
  const away = daysBetween(lastPractice, date);
  const c = NOTIFICATION_CADENCE;
  if (away <= c.dailyUntilDays) return true;
  if (away > c.stopAfterDays) return false;
  if (away <= c.everyThirdUntilDays) return away % 3 === 0;
  return away % 7 === 0;
}

/** Which kind of notification fits a day, or null for none. */
export function kindFor(s: GameState, date: LocalDate, ctx: IzuContext, prefs: NotificationPrefs): { kind: NotificationKind; slots: Record<string, string> } | null {
  const adult = prefs.audience === "adult";
  const izuStart = dayIndex(s.izu.current.start);
  const izuEnd = izuStart + IZU.daysPerIzu - 1;
  const idx = dayIndex(date);
  const inIzu = idx >= izuStart && idx <= izuEnd;
  const needed = daysNeeded(s.izu.current.start, ctx.startedOn);
  const practised = s.izu.current.practised.length;
  // A kept izu: its remaining days are rest days. No nudge at all.
  if (inIzu && practised >= needed) return null;

  const r = s.izu.repair;
  if (adult && r) {
    const lastDay = ctx.cal.dayKey(new Date(Date.parse(r.deadline) - 1));
    if (idx <= dayIndex(lastDay)) return { kind: "repair", slots: { deadlineDay: weekdayOf(lastDay) } };
  }
  const left = needed - practised;
  if (adult && inIzu && s.izu.length > 0 && left === 1) return { kind: "izu-one-more", slots: {} };

  const last = s.lastPractice ?? s.startedOn;
  if (daysBetween(last, date) > NOTIFICATION_CADENCE.dailyUntilDays) return { kind: "welcome-back", slots: {} };
  if (s.ubi.plants.some((p) => p.stage >= 4)) return { kind: "harvest", slots: {} };
  const q = s.cohort;
  if (q && !q.completedAt && q.week === weekKey(date) && q.target > 0) {
    const pct = Math.floor((questTotal(q) / q.target) * 100);
    if (pct >= 50) return { kind: "quest", slots: { percent: String(Math.min(99, pct)) } };
  }
  const fest = festivalOn(date);
  if (fest) return { kind: "festival", slots: { festival: FESTIVAL_COPY[fest].name, festivalLine: FESTIVAL_COPY[fest].line } };
  return { kind: "word", slots: {} };
}

export function planNotifications(s: GameState, now: Date, prefs: NotificationPrefs, ctx: IzuContext): PlannedNotification[] {
  if (!prefs.enabled) return [];
  const today = ctx.cal.dayKey(now);
  const horizon = Math.max(1, Math.min(7, prefs.days ?? 3));
  const hour = Math.max(0, Math.min(23, Math.floor(prefs.time.hour)));
  const minute = Math.max(0, Math.min(59, Math.floor(prefs.time.minute)));
  const practisedToday = s.day.date === today && s.day.counted;
  const out: PlannedNotification[] = [];
  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i);
    const at = ctx.cal.at(date, hour, minute);
    if (at.getTime() <= now.getTime()) continue;
    if (i === 0 && practisedToday) continue;
    if (!cadenceAllows(s.lastPractice ?? s.startedOn, date)) continue;
    const pick = kindFor(s, date, ctx, prefs);
    if (!pick) continue;
    const variants = NOTIFICATION_COPY[pick.kind];
    const copy = variants[dayIndex(date) % variants.length] as Copy;
    out.push({
      id: `okwu-daily-${date}`,
      date,
      at: at.toISOString(),
      kind: pick.kind,
      title: fill(copy.title, pick.slots),
      body: fill(copy.body, pick.slots),
      push: "daily-reminder",
    });
  }
  return out;
}

/** Every string the plan can produce, for the guilt-word test. */
export function allNotificationCopy(): string[] {
  const out: string[] = [];
  for (const variants of Object.values(NOTIFICATION_COPY)) for (const c of variants) out.push(c.title, c.body);
  for (const f of Object.values(FESTIVAL_COPY)) out.push(f.name, f.line);
  return out;
}
