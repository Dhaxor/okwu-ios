// Daily reminders as real local notifications. Pure and tested
// (notifications.test.ts): the device API is passed in, so bun runs it with
// a fake. The hook that wires it to expo-notifications is ./reminders.tsx.
//
// The game layer decides what to say and when (`engine.notifications(state,
// now, reminderPrefs(profile))`, docs/CONTRACTS.md §3): at most one positive
// notification a day, nothing on a day already practised or a rest day, no
// chain nudges for teens, thinning out and stopping after a long absence.
// This module only makes the device match that plan:
// - it touches nothing but its own ids (`okwu-daily-<date>`);
// - re-planning replaces instead of stacking (the ids are stable per day);
// - it never keeps more than one per local day, never schedules the past;
// - reminders off, or permission not granted: every one of ours is cancelled.
import type { PlannedNotification } from "@/lib/game/types";

export const REMINDER_ID_PREFIX = "okwu-daily-";

export type PermissionStatus = "granted" | "denied" | "undetermined" | "unsupported";

/** The device side, as the app provides it (expo-notifications) or a test fakes it. */
export interface NotificationsApi {
  permission(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  /** Identifiers of everything this app has scheduled. */
  scheduledIds(): Promise<string[]>;
  /** Schedule (or replace, for the same id) one notification at a time. */
  schedule(n: { id: string; title: string; body: string; at: Date }): Promise<void>;
  cancel(id: string): Promise<void>;
}

export const isReminderId = (id: string) => id.startsWith(REMINDER_ID_PREFIX);

/** Notifications closer than this to now are left out (they would fire as the app opens). */
export const MIN_LEAD_MS = 60_000;

/**
 * The plan, made safe: our ids only, in the future, at most one per local
 * date (the first planned wins), ordered by time.
 */
export function sanitizePlan(planned: readonly PlannedNotification[], now: Date): PlannedNotification[] {
  const seen = new Set<string>();
  const out: PlannedNotification[] = [];
  for (const n of [...planned].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const at = Date.parse(n.at);
    if (!isReminderId(n.id) || !Number.isFinite(at) || at - now.getTime() < MIN_LEAD_MS) continue;
    if (seen.has(n.date)) continue;
    seen.add(n.date);
    out.push(n);
  }
  return out;
}

export interface ReminderChanges {
  cancel: string[];
  schedule: PlannedNotification[];
}

/** What to cancel and what to (re)schedule so the device matches the plan. */
export function reminderChanges(planned: readonly PlannedNotification[], existing: readonly string[], now: Date, on: boolean): ReminderChanges {
  const ours = existing.filter(isReminderId);
  if (!on) return { cancel: ours, schedule: [] };
  const plan = sanitizePlan(planned, now);
  const keep = new Set(plan.map((n) => n.id));
  return { cancel: ours.filter((id) => !keep.has(id)), schedule: plan };
}

export type SyncOutcome =
  | { status: "scheduled"; scheduled: number; cancelled: number }
  | { status: "off"; cancelled: number }
  | { status: "no-permission"; cancelled: number }
  | { status: "unsupported" }
  | { status: "error" };

/**
 * Make the device match the plan. Never asks for permission (that happens
 * at a moment the learner chose reminders, see `requestReminderPermission`).
 * Never throws.
 */
export async function syncReminders(api: NotificationsApi, planned: readonly PlannedNotification[], now: Date, enabled: boolean): Promise<SyncOutcome> {
  try {
    const permission = await api.permission();
    if (permission === "unsupported") return { status: "unsupported" };
    const on = enabled && permission === "granted";
    const changes = reminderChanges(planned, await api.scheduledIds(), now, on);
    for (const id of changes.cancel) await api.cancel(id);
    if (!on) return { status: enabled ? "no-permission" : "off", cancelled: changes.cancel.length };
    for (const n of changes.schedule) await api.schedule({ id: n.id, title: n.title, body: n.body, at: new Date(n.at) });
    return { status: "scheduled", scheduled: changes.schedule.length, cancelled: changes.cancel.length };
  } catch {
    return { status: "error" };
  }
}

/** Cancel every Okwu reminder (reminders turned off, sign-out, account deletion). Never throws. */
export async function cancelAllReminders(api: NotificationsApi): Promise<number> {
  try {
    const ours = (await api.scheduledIds()).filter(isReminderId);
    for (const id of ours) await api.cancel(id);
    return ours.length;
  } catch {
    return 0;
  }
}

/**
 * Ask for permission only at a moment the learner chose reminders (turning
 * them on, picking a time), never on launch. Asks once: a "denied" answer is
 * respected and the screen points to Settings instead.
 */
export async function requestReminderPermission(api: NotificationsApi): Promise<PermissionStatus> {
  try {
    const now = await api.permission();
    if (now !== "undetermined") return now;
    return await api.requestPermission();
  } catch {
    return "denied";
  }
}

/** A short line for the reminder row in Settings. */
export function reminderStatusCopy(enabled: boolean, permission: PermissionStatus, time: { hour: number; minute: number }): string {
  if (!enabled) return "Off";
  if (permission === "denied") return "Notifications are off for Okwu in your phone's Settings";
  if (permission === "unsupported") return `${formatTime(time)} · reminders work in the iPhone app`;
  return `Every day around ${formatTime(time)}, at most once`;
}

export function formatTime(t: { hour: number; minute: number }): string {
  const h = ((t.hour % 24) + 24) % 24;
  return `${String(h).padStart(2, "0")}:${String(Math.max(0, Math.min(59, t.minute))).padStart(2, "0")}`;
}
