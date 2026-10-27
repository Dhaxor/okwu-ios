// XP (docs/CONTRACTS.md §3): weighted toward new learning and speaking.
// Re-practice is capped per item per day, so repeating one card earns
// almost nothing after the first couple of times: there is no XP farming.
import { daysBetween } from "./calendar";
import { REPEAT_LESSON_XP, REVIEW_XP_PER_ITEM_PER_DAY, SPEAKING_XP_PER_ITEM_PER_DAY, XP } from "./rules";
import type { LocalDate, XpLedger, XpSource } from "./types";

/** Days of per-day XP kept (older days are summed into `total` already). */
const KEEP_DAYS = 120;

/** A capped grant: how many times per day, and how much each time. */
export type XpGrant =
  | { source: "new-item"; key: string }
  | { source: "speaking"; key: string }
  | { source: "review"; key: string }
  | { source: "lesson"; key: string; repeat: boolean }
  | { source: "story"; key: string; repeat: boolean }
  | { source: "mission" };

function rollDay(ledger: XpLedger, today: LocalDate): XpLedger {
  if (ledger.reviewToday.date === today) return ledger;
  return { ...ledger, reviewToday: { date: today, perItem: {} } };
}

function prune(byDay: Record<LocalDate, number>, today: LocalDate): Record<LocalDate, number> {
  const keys = Object.keys(byDay);
  if (keys.length <= KEEP_DAYS) return byDay;
  const out: Record<LocalDate, number> = {};
  for (const k of keys) if (daysBetween(k, today) < KEEP_DAYS) out[k] = byDay[k] as number;
  return out;
}

/** What a grant is worth and how many times a day it may be granted (Infinity = uncapped). */
function price(g: XpGrant): { amount: number; cap: number; capKey: string | null } {
  switch (g.source) {
    case "new-item":
      return { amount: XP["new-item"], cap: 1, capKey: `n:${g.key}` };
    case "speaking":
      return { amount: XP.speaking, cap: SPEAKING_XP_PER_ITEM_PER_DAY, capKey: `s:${g.key}` };
    case "review":
      return { amount: XP.review, cap: REVIEW_XP_PER_ITEM_PER_DAY, capKey: `r:${g.key}` };
    case "lesson":
      return g.repeat ? { amount: REPEAT_LESSON_XP, cap: 1, capKey: `l:${g.key}` } : { amount: XP.lesson, cap: Infinity, capKey: null };
    case "story":
      return g.repeat ? { amount: XP.review, cap: 1, capKey: `c:${g.key}` } : { amount: XP.story, cap: Infinity, capKey: null };
    case "mission":
      return { amount: XP.mission, cap: Infinity, capKey: null };
  }
}

/** Grant XP if today's cap allows it. Returns the new ledger and the amount granted (0 when capped). */
export function grant(input: XpLedger, g: XpGrant, today: LocalDate): { ledger: XpLedger; amount: number; source: XpSource } {
  const ledger = rollDay(input, today);
  const { amount, cap, capKey } = price(g);
  const used = capKey ? ledger.reviewToday.perItem[capKey] ?? 0 : 0;
  if (used >= cap) return { ledger, amount: 0, source: g.source };
  const perItem = capKey ? { ...ledger.reviewToday.perItem, [capKey]: used + 1 } : ledger.reviewToday.perItem;
  const byDay = prune({ ...ledger.byDay, [today]: (ledger.byDay[today] ?? 0) + amount }, today);
  return {
    ledger: { total: ledger.total + amount, byDay, reviewToday: { date: today, perItem } },
    amount,
    source: g.source,
  };
}

/** Has this capped thing already been granted today? (Used to dedupe new items seen twice.) */
export function grantedToday(ledger: XpLedger, capKey: string, today: LocalDate): boolean {
  return ledger.reviewToday.date === today && (ledger.reviewToday.perItem[capKey] ?? 0) > 0;
}
