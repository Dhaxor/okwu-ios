// The weekly progress report, pure (report.test.ts), from what is already
// on the device: progress (okwu.progress.v1), the review log
// (okwu.reviewlog.v1) and the game (okwu.game.v1). Nothing is sent anywhere.
//
//   minutes      lesson minutes (progress.minutesByDay) plus practice
//                outside lessons (each answer's time, capped)
//   lessons      lessons finished that week
//   words        met (first practised) and strong (every practised skill's
//                FSRS stability at a week or more, rebuilt from the log)
//   reviews      answers recorded, and how many were recalled; speaking is
//                self-assessed and never counted as right or wrong
//   tones        heard right the first time each day, per tone pattern: a
//                count of perception trials, never a pronunciation score
//   chain/places the market-day chain and the hometown, as the game has them
//
// Weeks are local calendar weeks, Monday to Sunday. Comparisons are kind:
// more than last week is "+N", fewer is "Last week: N", never red.
import { isUsable, pitchLineFor, toneMarked } from "@/lib/content";
import type { ContentBundle, Tone } from "@/lib/content/types";
import { addDays, dayIndex } from "@/lib/game";
import type { GameState, GameView, ObodoPlace } from "@/lib/game/types";
import { cardKey, itemMastery, seenItems, type MasteryLevel, type Progress, type ReviewLog, type Scheduler } from "@/lib/learning";
import { courseUnits, unitRefs } from "./decks";

/** A word is strong when every skill practised holds for a week or more (FSRS stability, in days). */
export const STRONG_DAYS = 7;
/** One answer counts at most this long toward practice minutes (a phone left on the table is not practice). */
export const MAX_ANSWER_MS = 120_000;
/** Weeks looked back for "your best week". */
export const BEST_WEEK_LOOKBACK = 12;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;

const mod = (n: number, m: number) => ((n % m) + m) % m;

export interface ReportInput {
  bundle: ContentBundle;
  progress: Progress;
  log: readonly ReviewLog[];
  game: GameState | null;
  view: GameView | null;
  scheduler: Scheduler;
  now: Date;
  /** The learner's local calendar day of an instant (the game's deviceCalendar.dayKey). */
  dayKey: (at: Date) => string;
  /** The learner's track, so units come in the order they learn them. */
  track?: string;
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

export interface WeekRange {
  /** Monday, YYYY-MM-DD. */
  start: string;
  /** Sunday. */
  end: string;
  days: string[];
  /** "Oct 19 – 25", "Sep 29 – Oct 5". */
  label: string;
  /** The week that holds today. */
  current: boolean;
  /** Days of it that have begun (7 for a past week). */
  daysSoFar: number;
}

export function mondayOf(day: string): string {
  return addDays(day, -mod(dayIndex(day) + 3, 7));
}

function dateLabel(day: string, withMonth: boolean): string {
  const [, m, d] = day.split("-").map(Number) as [number, number, number];
  return withMonth ? `${MONTHS[m - 1]} ${d}` : String(d);
}

export function weekLabel(start: string, end: string): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const year = start.slice(0, 4) !== end.slice(0, 4) ? ` ${end.slice(0, 4)}` : "";
  return `${dateLabel(start, true)} – ${dateLabel(end, !sameMonth)}${year}`;
}

/** The week `offset` weeks from the one holding `today` (0 this week, -1 last week). */
export function weekOf(today: string, offset = 0): WeekRange {
  const start = addDays(mondayOf(today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6] as string;
  const current = today >= start && today <= end;
  const daysSoFar = current ? dayIndex(today) - dayIndex(start) + 1 : today > end ? 7 : 0;
  return { start, end, days, label: weekLabel(start, end), current, daysSoFar };
}

export function weekdayName(i: number): string {
  return WEEKDAYS[mod(i, 7)] as string;
}

// ---------------------------------------------------------------------------
// One week's numbers
// ---------------------------------------------------------------------------

export interface WeekStats {
  /** Whole minutes (anything practised shows as at least 1). */
  minutes: number;
  /** Minutes per day, Monday first, to one decimal. */
  minutesByDay: number[];
  lessons: number;
  /** Words practised for the first time. */
  newWords: number;
  /** Every answer recorded on a card. */
  reviews: number;
  /** Answers that can be right or not (speaking is left out). */
  graded: number;
  /** Graded answers rated Hard, Good or Easy. */
  recalled: number;
  /** Words said aloud (self-assessed, never scored). */
  spoken: number;
  daysPractised: number;
  xp: number;
}

interface Indexed {
  input: ReportInput;
  logs: { log: ReviewLog; day: string; t: number }[];
  firstDay: Map<string, string>;
  byCard: Map<string, { day: string; stability: number }[]>;
}

const indexCache = new WeakMap<ReportInput, Indexed>();

function indexed(input: ReportInput): Indexed {
  const hit = indexCache.get(input);
  if (hit) return hit;
  const logs = input.log
    .map((log) => ({ log, t: Date.parse(log.reviewedAt) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t)
    .map((x) => ({ ...x, day: input.dayKey(new Date(x.t)) }));
  const firstDay = new Map<string, string>();
  const byCard = new Map<string, { day: string; stability: number }[]>();
  for (const { log, day } of logs) {
    if (!firstDay.has(log.item)) firstDay.set(log.item, day);
    const k = cardKey(log.item, log.facet);
    const list = byCard.get(k) ?? [];
    list.push({ day, stability: log.stability });
    byCard.set(k, list);
  }
  const out = { input, logs, firstDay, byCard };
  indexCache.set(input, out);
  return out;
}

export function weekStats(input: ReportInput, week: WeekRange): WeekStats {
  const ix = indexed(input);
  const inWeek = new Set(week.days);
  const minutesByDay = week.days.map((d) => input.progress.minutesByDay[d] ?? 0);
  const practised = new Set<string>();
  let reviews = 0;
  let graded = 0;
  let recalled = 0;
  let spoken = 0;
  for (const { log, day } of ix.logs) {
    if (!inWeek.has(day)) continue;
    reviews++;
    practised.add(day);
    if (log.facet === "speak") spoken++;
    else {
      graded++;
      if (log.rating > 1) recalled++;
    }
    if (log.source !== "lesson") {
      const i = week.days.indexOf(day);
      minutesByDay[i] = (minutesByDay[i] ?? 0) + Math.min(MAX_ANSWER_MS, Math.max(0, log.durationMs)) / 60_000;
    }
  }
  week.days.forEach((d, i) => {
    if ((minutesByDay[i] ?? 0) > 0 || (input.game?.xp.byDay[d] ?? 0) > 0) practised.add(d);
  });
  const total = minutesByDay.reduce((a, b) => a + b, 0);
  let newWords = 0;
  for (const day of ix.firstDay.values()) if (inWeek.has(day)) newWords++;
  const lessons = Object.values(input.progress.lessons).filter((l) => inWeek.has(input.dayKey(new Date(l.completedAt)))).length;
  const xp = week.days.reduce((n, d) => n + (input.game?.xp.byDay[d] ?? 0), 0);
  return {
    minutes: total > 0 ? Math.max(1, Math.round(total)) : 0,
    minutesByDay: minutesByDay.map((m) => Math.round(m * 10) / 10),
    lessons,
    newWords,
    reviews,
    graded,
    recalled,
    spoken,
    daysPractised: practised.size,
    xp,
  };
}

// ---------------------------------------------------------------------------
// Words: met and strong
// ---------------------------------------------------------------------------

/**
 * Words strong at the end of a local day: every skill practised by then
 * had a stability of STRONG_DAYS or more after its last review. Rebuilt
 * from the log (each entry holds the stability before that review; the
 * next entry, or the card itself, holds what followed).
 */
export function strongWordsBy(input: ReportInput, lastDay: string): number {
  const ix = indexed(input);
  const items = new Map<string, boolean>();
  for (const [key, list] of ix.byCard) {
    let i = -1;
    for (let j = 0; j < list.length && (list[j] as { day: string }).day <= lastDay; j++) i = j;
    if (i < 0) continue;
    const item = key.slice(0, key.lastIndexOf("#"));
    const after = list[i + 1]?.stability ?? input.progress.cards[key]?.stability ?? (list[i] as { stability: number }).stability;
    items.set(item, (items.get(item) ?? true) && after >= STRONG_DAYS);
  }
  let n = 0;
  for (const strong of items.values()) if (strong) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Tones
// ---------------------------------------------------------------------------

export interface ToneRow {
  /** "L-H". */
  pattern: string;
  tones: Tone[];
  /** "low, then high". */
  label: string;
  /** A word heard with this pattern, tone-marked (from approved content). */
  example: string | null;
  /** Heard right the first time that day. */
  right: number;
  heard: number;
}

/** Tone-pair trials of the week: the first hearing of each word each day, grouped by tone pattern. */
export function toneRows(input: ReportInput, week: WeekRange): ToneRow[] {
  const ix = indexed(input);
  const inWeek = new Set(week.days);
  const firsts = new Map<string, ReviewLog>();
  for (const { log, day } of ix.logs) {
    if (log.facet !== "tone" || !inWeek.has(day)) continue;
    const k = `${log.item}@${day}`;
    if (!firsts.has(k)) firsts.set(k, log);
  }
  const rows = new Map<string, ToneRow>();
  for (const log of firsts.values()) {
    const item = input.bundle.items[log.item];
    const pitch = item ? pitchLineFor(item) : null;
    if (!item || !pitch) continue;
    const key = pitch.tones.join("-");
    const row = rows.get(key) ?? { pattern: key, tones: pitch.tones, label: pitch.label, example: toneMarked(item), right: 0, heard: 0 };
    row.heard++;
    if (log.rating > 1) row.right++;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.tones.length - b.tones.length || (a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface UnitRow {
  id: string;
  index: number;
  title: string;
  place: string | null;
  free: boolean;
  lessonsDone: number;
  lessonsTotal: number;
  words: number;
  /** Words at each mastery level: new, learning, familiar, strong, mastered. */
  levels: Record<MasteryLevel, number>;
  /** 0..1, the course's own unit mastery (average item level / 4). */
  mastery: number;
}

export function unitRows(input: ReportInput): UnitRow[] {
  const { bundle, progress, scheduler, now } = input;
  return courseUnits(bundle, input.track)
    .map((u) => {
      const refs = unitRefs(bundle, u.id);
      const levels: Record<MasteryLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      let sum = 0;
      for (const r of refs) {
        const l = itemMastery(progress, r, now, scheduler).level;
        levels[l]++;
        sum += l;
      }
      return {
        id: u.id as string,
        index: u.index,
        title: u.title,
        place: u.obodoPlace ?? null,
        free: u.free,
        lessonsDone: u.lessons.filter((l) => progress.lessons[l] !== undefined).length,
        lessonsTotal: u.lessons.length,
        words: refs.length,
        levels,
        mastery: refs.length ? Math.round((sum / (refs.length * 4)) * 1000) / 1000 : 0,
      };
    })
    .filter((r) => r.words > 0 || r.lessonsTotal > 0);
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export interface Comparison {
  value: number;
  last: number;
  /** "+12 on last week", "Same as last week", "Last week: 40". */
  note: string;
  up: boolean;
}

export function compare(value: number, last: number, unit = ""): Comparison {
  const u = unit ? ` ${unit}` : "";
  if (value > last) return { value, last, note: last === 0 ? "New this week" : `+${value - last}${u} on last week`, up: true };
  if (value === last) return { value, last, note: value === 0 ? "Nothing yet" : "Same as last week", up: false };
  return { value, last, note: `Last week: ${last}${u}`, up: false };
}

export interface WeeklyReport {
  week: WeekRange;
  stats: WeekStats;
  last: WeekStats;
  minutes: Comparison;
  lessons: Comparison;
  newWords: Comparison;
  reviews: Comparison;
  /** Share of graded answers recalled, 0..1 (null with none). */
  recall: number | null;
  words: { met: number; strong: number; strongBefore: number; strongGain: number };
  tones: ToneRow[];
  tonesTotal: { right: number; heard: number };
  chain: { length: number; longest: number; practised: number; needed: number; kept: boolean } | null;
  /** The hometown: places fully restored, places being rebuilt, and how far along all of it is (0..1, by stage). */
  places: { restored: number; rebuilding: number; total: number; progress: number; workedOn: string[] } | null;
  units: UnitRow[];
  /** More minutes than any of the previous BEST_WEEK_LOOKBACK weeks (with some practice before). */
  bestWeek: boolean;
  /** Nothing practised in the week. */
  empty: boolean;
}

export function weeklyReport(input: ReportInput, offset = 0): WeeklyReport {
  const today = input.dayKey(input.now);
  const week = weekOf(today, offset);
  const lastWeek = weekOf(today, offset - 1);
  const stats = weekStats(input, week);
  const last = weekStats(input, lastWeek);
  const strong = strongWordsBy(input, week.current ? today : week.end);
  const strongBefore = strongWordsBy(input, lastWeek.end);
  const tones = toneRows(input, week);
  const inWeek = new Set(week.days);
  const workedOn: string[] = [];
  for (const l of Object.values(input.progress.lessons)) {
    if (!inWeek.has(input.dayKey(new Date(l.completedAt)))) continue;
    const unit = input.bundle.units[input.bundle.lessons[l.lesson]?.unit ?? ""];
    const place = unit?.obodoPlace;
    if (place && !workedOn.includes(place)) workedOn.push(place);
  }
  let best = stats.minutes > 0;
  let earlier = false;
  for (let i = 1; best && i <= BEST_WEEK_LOOKBACK; i++) {
    const m = weekStats(input, weekOf(today, offset - i)).minutes;
    if (m > 0) earlier = true;
    if (m >= stats.minutes) best = false;
  }
  const view = input.view;
  const metAtEnd = week.current ? seenItems(input.progress).size : countMetBy(input, week.end);
  return {
    week,
    stats,
    last,
    minutes: compare(stats.minutes, last.minutes, "min"),
    lessons: compare(stats.lessons, last.lessons),
    newWords: compare(stats.newWords, last.newWords),
    reviews: compare(stats.reviews, last.reviews),
    recall: stats.graded > 0 ? stats.recalled / stats.graded : null,
    words: { met: metAtEnd, strong, strongBefore, strongGain: Math.max(0, strong - strongBefore) },
    tones,
    tonesTotal: { right: tones.reduce((n, r) => n + r.right, 0), heard: tones.reduce((n, r) => n + r.heard, 0) },
    chain: view ? { length: view.izu.length, longest: view.izu.longest, practised: view.izu.practised, needed: view.izu.needed, kept: view.izu.kept } : null,
    places: view
      ? {
          restored: view.obodo.restored,
          rebuilding: view.obodo.places.filter((p) => p.stage > 0 && p.stage < 3).length,
          total: view.obodo.places.length,
          progress: view.obodo.places.length ? view.obodo.places.reduce((n, p) => n + p.stage, 0) / (view.obodo.places.length * 3) : 0,
          workedOn: workedOn as ObodoPlace[],
        }
      : null,
    units: unitRows(input),
    bestWeek: best && earlier,
    empty: stats.reviews === 0 && stats.lessons === 0 && stats.minutes === 0,
  };
}

function countMetBy(input: ReportInput, day: string): number {
  let n = 0;
  for (const d of indexed(input).firstDay.values()) if (d <= day) n++;
  return n;
}

/** The headline over the numbers: calm, never a comparison that stings. */
export function headline(r: WeeklyReport): string {
  if (r.empty) return r.week.current ? "Your week starts with one lesson" : "A quiet week";
  if (r.bestWeek) return "Your best week yet";
  if (r.stats.daysPractised >= 5) return `${r.stats.daysPractised} days of Igbo`;
  return r.week.current ? "Your week so far" : "Your week";
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n1 = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The report as plain text for the share sheet. English only; no Igbo is written here. */
export function shareText(r: WeeklyReport, placeName: (p: string) => string = (p) => p): string {
  const lines = [`My week learning Igbo on Okwu (${r.week.label}${r.week.current ? ", so far" : ""})`];
  if (r.empty) {
    lines.push("· A quiet week. Back to it with the next lesson.");
  } else {
    lines.push(`· ${n1(r.stats.minutes, "minute")} of Igbo${r.last.minutes > 0 ? ` (last week: ${r.last.minutes})` : ""}`);
    if (r.stats.lessons || r.stats.newWords) lines.push(`· ${n1(r.stats.lessons, "lesson")}, ${n1(r.stats.newWords, "new word")}`);
    if (r.stats.reviews) lines.push(`· ${n1(r.stats.reviews, "review")}${r.recall !== null ? `, ${pct(r.recall)} recalled` : ""}`);
    if (r.words.strong) lines.push(`· ${n1(r.words.strong, "word")} now strong, of ${r.words.met} met`);
    if (r.tonesTotal.heard) lines.push(`· Tones heard right first time: ${r.tonesTotal.right} of ${r.tonesTotal.heard}`);
    if (r.stats.spoken) lines.push(`· ${n1(r.stats.spoken, "word")} said aloud`);
  }
  if (r.chain && r.chain.length > 0) lines.push(`· Market-day chain: ${n1(r.chain.length, "market week")}`);
  if (r.places) {
    const where = r.places.workedOn.length ? ` (worked on ${r.places.workedOn.map(placeName).join(", ")})` : "";
    const state = r.places.restored > 0 ? `${r.places.restored} of ${r.places.total} places restored` : `${r.places.rebuilding} of ${r.places.total} places being rebuilt`;
    if (r.places.restored > 0 || r.places.rebuilding > 0) lines.push(`· Hometown: ${state}${where}`);
  }
  lines.push("", "Learning Igbo with Okwu.");
  return lines.join("\n");
}
