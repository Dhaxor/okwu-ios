// Local day keys and market-day arithmetic for the game layer.
//
// Every rule that talks about "a day" uses the learner's own calendar date
// (YYYY-MM-DD on their clock), never UTC and never "24 hours ago": a lesson
// at 23:50 and one at 00:10 are two days, a 23- or 25-hour DST day is still
// one day, and flying across time zones never erases practice. Day
// arithmetic runs on the date keys themselves (UTC-day numbers), so it is
// immune to DST.
import { FESTIVALS, IZU, MARKET_DAYS } from "./rules";
import type { Festival, GameCalendar, LocalDate, MarketDay } from "./types";

const DAY_MS = 86_400_000;

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** The device's own clock (Date's local getters handle DST and the current zone). */
export const deviceCalendar: GameCalendar = {
  dayKey(at) {
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  },
  at(day, hour, minute) {
    const [y, m, d] = parseKey(day);
    // The Date constructor resolves a wall time that falls in a DST gap to the next valid instant.
    return new Date(y, m - 1, d, hour, minute, 0, 0);
  },
};

/**
 * A calendar for an IANA time zone via Intl. Used by tests to simulate DST
 * and travel; also usable on device where Intl time zones are available.
 */
export function zoneCalendar(timeZone: string): GameCalendar {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = (ms: number) => {
    const out: Record<string, number> = {};
    for (const p of fmt.formatToParts(new Date(ms))) if (p.type !== "literal") out[p.type] = Number(p.value);
    return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
  };
  /** Wall-clock minus UTC at an instant, in ms. */
  const offset = (ms: number) => {
    const p = parts(ms);
    const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
    return wall - Math.floor(ms / 1000) * 1000;
  };
  const cal: GameCalendar = {
    dayKey(at) {
      const p = parts(at.getTime());
      return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    },
    at(day, hour, minute) {
      const [y, m, d] = parseKey(day);
      const wall = Date.UTC(y, m - 1, d, hour, minute);
      let t = wall - offset(wall);
      t = wall - offset(t);
      // In a DST gap the wall time does not exist: move to the first instant at or after it.
      const want = hour * 60 + minute;
      for (let i = 0; i < 4; i++) {
        const p = parts(t);
        const sameDay = p.year === y && p.month === m && p.day === d;
        if (sameDay && p.hour * 60 + p.minute >= want) break;
        if (!sameDay && dayIndex(`${p.year}-${pad(p.month)}-${pad(p.day)}`) > dayIndex(day)) break;
        t += 30 * 60_000;
      }
      return new Date(t);
    },
  };
  return cal;
}

/** [year, month 1-12, day 1-31] of a key. Throws on a malformed key. */
export function parseKey(key: LocalDate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Not a local date key: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isDayKey(key: unknown): key is LocalDate {
  return typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

/** Whole days since 1970-01-01 for a local date (DST-free arithmetic). */
export function dayIndex(key: LocalDate): number {
  const [y, m, d] = parseKey(key);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function keyFromIndex(index: number): LocalDate {
  const d = new Date(index * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(key: LocalDate, days: number): LocalDate {
  return keyFromIndex(dayIndex(key) + days);
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return dayIndex(to) - dayIndex(from);
}

export function yearOf(key: LocalDate): number {
  return parseKey(key)[0];
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** How the izu lines up with the calendar: a verified anchor, or the learner's own cycle. */
export type IzuAlignment = { date: LocalDate; day: MarketDay };

/** The alignment in force: the verified anchor when there is one, else the learner's first day as the cycle's first day. */
export function alignment(anchor: IzuAlignment | null | undefined, startedOn: LocalDate): IzuAlignment {
  return anchor ?? { date: startedOn, day: "eke" };
}

export function marketDayOf(key: LocalDate, align: IzuAlignment): MarketDay {
  const offset = MARKET_DAYS.indexOf(align.day);
  return MARKET_DAYS[mod(dayIndex(key) - dayIndex(align.date) + offset, IZU.daysPerIzu)] as MarketDay;
}

/** The first day (Eke, or the cycle's first day) of the izu containing `key`. */
export function izuStartOf(key: LocalDate, align: IzuAlignment): LocalDate {
  const pos = MARKET_DAYS.indexOf(marketDayOf(key, align));
  return addDays(key, -pos);
}

/** ISO-8601 week of a local date, e.g. "2026-W43" (weeks start on Monday). */
export function weekKey(key: LocalDate): string {
  const idx = dayIndex(key);
  const weekday = mod(idx + 3, 7); // 1970-01-01 was a Thursday: Monday = 0
  const thursday = idx - weekday + 3;
  const year = new Date(thursday * DAY_MS).getUTCFullYear();
  const jan1 = Math.round(Date.UTC(year, 0, 1) / DAY_MS);
  const week = Math.floor((thursday - jan1) / 7) + 1;
  return `${year}-W${pad(week)}`;
}

/** Days left in the ISO week including today (Monday 7 … Sunday 1). */
export function daysLeftInWeek(key: LocalDate): number {
  return 7 - mod(dayIndex(key) + 3, 7);
}

/** The festival window a local date falls in, if any. */
export function festivalOn(key: LocalDate): Festival | null {
  const md = key.slice(5);
  for (const [name, w] of Object.entries(FESTIVALS) as [Festival, { from: string; to: string }][]) {
    const inside = w.from <= w.to ? md >= w.from && md <= w.to : md >= w.from || md <= w.to;
    if (inside) return name;
  }
  return null;
}
