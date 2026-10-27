// The market-day calendar's pure logic (calendar.test.ts), on lib/game's
// market-day arithmetic. Which day is "today" uses MARKET_DAY_ANCHOR when a
// cultural advisor has supplied a verified date. Until then it is null, and
// the calendar follows the learner's own izu from their first day (the same
// alignment the izu chain uses), and the screen says plainly that it is not
// the market day of any particular town.
import { MARKET_DAYS, MARKET_DAY_ANCHOR, addDays, dayIndex, marketDayOf } from "@/lib/game";
import type { LocalDate, MarketDay } from "@/lib/game/types";

export interface MarketAlignment {
  date: LocalDate;
  day: MarketDay;
}

export interface CalendarBasis {
  align: MarketAlignment;
  /** True only with a verified anchor; false means "your own izu". */
  verified: boolean;
}

/** The anchor in force: the verified one, else the learner's first day counted as Eke (as the izu chain does). */
export function calendarBasis(startedOn: LocalDate, anchor: MarketAlignment | null = MARKET_DAY_ANCHOR): CalendarBasis {
  return anchor ? { align: anchor, verified: true } : { align: { date: startedOn, day: "eke" }, verified: false };
}

export function marketDayOn(key: LocalDate, align: MarketAlignment): MarketDay {
  return marketDayOf(key, align);
}

/** The first day of the izu containing `key`. */
export function izuStart(key: LocalDate, align: MarketAlignment): LocalDate {
  return addDays(key, -MARKET_DAYS.indexOf(marketDayOn(key, align)));
}

/** Days from `today` until the next `day` (0 when today is that day). */
export function daysUntil(today: LocalDate, align: MarketAlignment, day: MarketDay): number {
  const now = MARKET_DAYS.indexOf(marketDayOn(today, align));
  const want = MARKET_DAYS.indexOf(day);
  return (want - now + MARKET_DAYS.length) % MARKET_DAYS.length;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface CalendarCell {
  date: LocalDate;
  day: MarketDay;
  weekday: (typeof WEEKDAYS)[number];
  dayOfMonth: number;
  month: (typeof MONTHS)[number];
  /** The first of a month, or the first cell shown: print the month. */
  showMonth: boolean;
  isToday: boolean;
  /** Before today (shown quietly, to complete the first izu row). */
  isPast: boolean;
}

/** Weekday and month of a local date key, from its day number (no Date, no time zone). */
export function dateParts(key: LocalDate): { weekday: CalendarCell["weekday"]; dayOfMonth: number; month: CalendarCell["month"] } {
  const idx = dayIndex(key);
  const [, m, d] = key.split("-").map(Number) as [number, number, number];
  // 1970-01-01 was a Thursday.
  return { weekday: WEEKDAYS[(((idx + 4) % 7) + 7) % 7] as CalendarCell["weekday"], dayOfMonth: d, month: MONTHS[m - 1] as CalendarCell["month"] };
}

/**
 * Today and the next `ahead` days (28 by default, seven izu), laid out as
 * rows of one izu each (Eke, Orie, Afọ, Nkwọ). The first row starts at the
 * beginning of today's izu, so it may hold a few past days.
 */
export function calendarRows(today: LocalDate, align: MarketAlignment, ahead = 28): CalendarCell[][] {
  const start = izuStart(today, align);
  const last = addDays(today, ahead);
  const rows: CalendarCell[][] = [];
  let first = true;
  for (let d = start; dayIndex(d) <= dayIndex(last); d = addDays(d, MARKET_DAYS.length)) {
    const row: CalendarCell[] = MARKET_DAYS.map((day, i) => {
      const date = addDays(d, i);
      const parts = dateParts(date);
      const cell: CalendarCell = {
        date,
        day,
        ...parts,
        showMonth: first || parts.dayOfMonth === 1,
        isToday: date === today,
        isPast: dayIndex(date) < dayIndex(today),
      };
      first = false;
      return cell;
    });
    rows.push(row);
  }
  return rows;
}
