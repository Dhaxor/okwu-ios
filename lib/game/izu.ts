// The izu chain (docs/CONTRACTS.md §3). Practise on 3 of the 4 market days
// of each izu to keep it; the fourth is a rest day. A miss opens a 48-hour
// repair window (3 lessons mend it) and the chain is held, not reset, while
// it is open. When the window passes the chain rests, and once a year the
// Homecoming revival brings a rested chain back. Nothing here is ever
// framed as a loss.
//
// All functions are pure: they take an IzuChain and return a new one plus
// effects, in the order things happened.
import { addDays, alignment, dayIndex, izuStartOf, marketDayOf, yearOf, type IzuAlignment } from "./calendar";
import { IZU, MARKET_DAYS } from "./rules";
import type { GameCalendar, GameEffect, IzuCell, IzuChain, IzuView, LocalDate, MarketDay } from "./types";

const HOUR_MS = 3_600_000;

export interface IzuContext {
  cal: GameCalendar;
  align: IzuAlignment;
  /** The learner's first day (their first izu may be partial). */
  startedOn: LocalDate;
}

export function izuContext(cal: GameCalendar, anchor: IzuAlignment | null | undefined, startedOn: LocalDate): IzuContext {
  return { cal, align: alignment(anchor, startedOn), startedOn };
}

/** Days needed to keep the izu starting at `start`: 3, or fewer when the learner joined part-way through it. */
export function daysNeeded(start: LocalDate, startedOn: LocalDate): number {
  const late = dayIndex(startedOn) - dayIndex(start);
  if (late <= 0) return IZU.daysRequired;
  return Math.max(1, Math.min(IZU.daysRequired, IZU.daysPerIzu - late));
}

/** The instant an izu ends: the start of the local day after its last day. */
function izuEnd(start: LocalDate, ctx: IzuContext): Date {
  return ctx.cal.at(addDays(start, IZU.daysPerIzu), 0, 0);
}

/** Practised days as dates (for realignment). */
function practisedDates(izu: IzuChain): LocalDate[] {
  return izu.current.practised.map((d) => addDays(izu.current.start, MARKET_DAYS.indexOf(d)));
}

/**
 * If a verified anchor arrived after the learner started, move the current
 * izu onto it, carrying practised days that fall inside the new izu.
 */
export function realign(izu: IzuChain, today: LocalDate, ctx: IzuContext): IzuChain {
  if (izuStartOf(izu.current.start, ctx.align) === izu.current.start) return izu;
  const start = izuStartOf(today, ctx.align);
  const end = dayIndex(start) + IZU.daysPerIzu;
  const carried = practisedDates(izu)
    .filter((d) => dayIndex(d) >= dayIndex(start) && dayIndex(d) < end)
    .map((d) => marketDayOf(d, ctx.align));
  return { ...izu, current: { start, practised: MARKET_DAYS.filter((d) => carried.includes(d)) } };
}

/** Let the chain rest (the repair window passed). */
function rest(izu: IzuChain, on: LocalDate, effects: GameEffect[]): IzuChain {
  if (izu.length > 0) effects.push({ kind: "izu-rested", length: izu.length });
  return { ...izu, length: 0, repair: null, rested: izu.length > 0 ? { length: izu.length, on } : izu.rested };
}

/**
 * Roll forward to `now`: close every izu that ended before today (opening
 * a repair window after a miss), and let an expired repair window rest.
 * A day key earlier than the current izu (travel west) never rolls back.
 */
export function rollIzu(input: IzuChain, now: Date, ctx: IzuContext): { izu: IzuChain; effects: GameEffect[] } {
  const effects: GameEffect[] = [];
  const today = ctx.cal.dayKey(now);
  let izu = realign(input, today, ctx);
  const todayIdx = dayIndex(today);
  let guard = 0;
  while (dayIndex(izu.current.start) + IZU.daysPerIzu <= todayIdx && guard++ < 2000) {
    const end = izuEnd(izu.current.start, ctx);
    const lastDay = addDays(izu.current.start, IZU.daysPerIzu - 1);
    // A repair window that closed inside this izu rests the chain first.
    if (izu.repair && Date.parse(izu.repair.deadline) <= end.getTime()) izu = rest(izu, lastDay, effects);
    const needed = daysNeeded(izu.current.start, ctx.startedOn);
    const kept = izu.current.practised.length >= needed;
    if (!kept && izu.length > 0 && !izu.repair) {
      const deadline = new Date(end.getTime() + IZU.repairWindowHours * HOUR_MS);
      if (deadline.getTime() > now.getTime()) {
        izu = { ...izu, repair: { deadline: deadline.toISOString(), lessonsDone: 0 } };
        effects.push({ kind: "izu-repair-open", deadline: deadline.toISOString() });
      } else {
        izu = rest(izu, lastDay, effects);
      }
    }
    izu = { ...izu, current: { start: addDays(izu.current.start, IZU.daysPerIzu), practised: [] } };
  }
  if (guard >= 2000) {
    // Years away: jump straight to today's izu (the chain has long since rested).
    izu = { ...izu, current: { start: izuStartOf(today, ctx.align), practised: [] } };
  }
  if (izu.repair && Date.parse(izu.repair.deadline) <= now.getTime()) izu = rest(izu, today, effects);
  return { izu, effects };
}

/** Today's key, clamped so travel west never lands in an izu already closed. */
export function clampedToday(izu: IzuChain, now: Date, ctx: IzuContext): LocalDate {
  const today = ctx.cal.dayKey(now);
  return dayIndex(today) < dayIndex(izu.current.start) ? izu.current.start : today;
}

/** Record a practice day (call after rollIzu). */
export function practiseDay(input: IzuChain, now: Date, ctx: IzuContext): { izu: IzuChain; effects: GameEffect[] } {
  const effects: GameEffect[] = [];
  const day = marketDayOf(clampedToday(input, now, ctx), ctx.align);
  if (input.current.practised.includes(day)) return { izu: input, effects };
  const practised = MARKET_DAYS.filter((d) => d === day || input.current.practised.includes(d));
  let izu: IzuChain = { ...input, current: { ...input.current, practised } };
  effects.push({ kind: "izu-day", day });
  const needed = daysNeeded(izu.current.start, ctx.startedOn);
  if (input.current.practised.length < needed && practised.length >= needed) {
    const length = izu.length + 1;
    izu = { ...izu, length, longest: Math.max(izu.longest, length) };
    effects.push({ kind: "izu-kept", length });
  }
  return { izu, effects };
}

/** A lesson finished: count it toward an open repair window (call after rollIzu). */
export function repairLesson(input: IzuChain, now: Date): { izu: IzuChain; effects: GameEffect[]; repaired: boolean } {
  const r = input.repair;
  if (!r || Date.parse(r.deadline) <= now.getTime()) return { izu: input, effects: [], repaired: false };
  const lessonsDone = r.lessonsDone + 1;
  if (lessonsDone >= IZU.repairLessons) {
    // Mended: the missed izu counts as kept, and the chain carries on.
    const length = input.length + 1;
    return {
      izu: { ...input, repair: null, length, longest: Math.max(input.longest, length) },
      effects: [{ kind: "izu-repaired", length }],
      repaired: true,
    };
  }
  return {
    izu: { ...input, repair: { ...r, lessonsDone } },
    effects: [{ kind: "izu-repair-progress", lessonsDone, needed: IZU.repairLessons }],
    repaired: false,
  };
}

/** The Homecoming revival is available: a chain rested, no repair is open, and this year's revival is unused. */
export function canRevive(izu: IzuChain, today: LocalDate): boolean {
  return !!izu.rested && izu.rested.length > 0 && !izu.repair && izu.revivalYear !== yearOf(today);
}

/** Bring the rested chain home (adds to any chain begun since). */
export function revive(izu: IzuChain, today: LocalDate): { izu: IzuChain; effects: GameEffect[] } {
  if (!canRevive(izu, today) || !izu.rested) return { izu, effects: [] };
  const length = izu.rested.length + izu.length;
  return {
    izu: { ...izu, length, longest: Math.max(izu.longest, length), rested: null, revivalYear: yearOf(today) },
    effects: [{ kind: "izu-revived", length }],
  };
}

/** The four cells and status the IzuChain widget draws. Call on a rolled-forward chain. */
export function izuView(izu: IzuChain, now: Date, ctx: IzuContext, provisional: boolean): IzuView {
  const today = clampedToday(izu, now, ctx);
  const needed = daysNeeded(izu.current.start, ctx.startedOn);
  const practised = izu.current.practised.length;
  const kept = practised >= needed;
  const todayIdx = dayIndex(today);
  const startIdx = dayIndex(izu.current.start);
  const firstIdx = dayIndex(ctx.startedOn);
  const cells: IzuCell[] = MARKET_DAYS.map((day, i) => {
    const date = addDays(izu.current.start, i);
    const idx = startIdx + i;
    const done = izu.current.practised.includes(day);
    const isToday = idx === todayIdx;
    let state: IzuCell["state"];
    if (done) state = "practised";
    else if (kept) state = "rest";
    else if (isToday) state = "today";
    else if (idx < todayIdx) state = idx < firstIdx ? "rest" : "missed";
    else state = "open";
    return { day, date, state, isToday };
  });
  const r = izu.repair;
  return {
    cells,
    length: izu.length,
    longest: izu.longest,
    practised,
    needed,
    kept,
    repair: r
      ? { deadline: r.deadline, lessonsDone: r.lessonsDone, needed: IZU.repairLessons, hoursLeft: Math.max(0, Math.ceil((Date.parse(r.deadline) - now.getTime()) / HOUR_MS)) }
      : null,
    revival: canRevive(izu, today) && izu.rested ? { length: izu.rested.length } : null,
    provisional,
  };
}

export type { MarketDay };
