// The learner's profile and settings on this device (okwu.profile.v2):
// onboarding, why they came, their track and home-dialect profile, how
// tone marks show, audio speed, the daily goal, the reminder, the age band
// and the consents they actively accepted. Pure logic (tested); the React
// provider is ./ProfileProvider.tsx.
//
// v1 (the shell's profile) migrates on first read; see `migrateV1`.
import type { DialectId, TrackId } from "@/lib/content/types";
import type { LearnerSettings } from "@/lib/learning/types";
import type { NotificationPrefs } from "@/lib/game/types";
import type { AgeTier, ConsentKind, ConsentRecord } from "@/lib/social/types";

export const PROFILE_KEY = "okwu.profile.v2";
export const PROFILE_KEY_V1 = "okwu.profile.v1";

/** Age bands. Under-13s cannot use Okwu: the answer is kept so the refusal sticks. */
export type AgeBand = "under-13" | "13-17" | "18+";

export type Motive = "family" | "partner" | "roots" | "school" | "curious";

/** What the learner said about their Igbo before the placement check. */
export type Familiarity = "new" | "some" | "lots";

/**
 * How the pronunciation layer shows: marks always (default at A0–A1),
 * tap to reveal, or the spelling layer only (how Igbo is written day to day).
 */
export type ToneMarks = "shown" | "reveal" | "hidden";

export type AudioSpeed = "natural" | "slow";

export interface Reminder {
  enabled: boolean;
  /** Local wall-clock time. */
  hour: number;
  minute: number;
}

export interface PlacementSummary {
  takenAt: string;
  correct: number;
  total: number;
  reason: "self-report-new" | "heritage-no-check" | "heritage-placed" | "start-with-sounds";
}

export interface LocalProfile {
  version: 2;
  onboardedAt: string | null;
  motives: Motive[];
  familiarity: Familiarity | null;
  /** "I understand some Igbo already" (familiarity some or lots). */
  heritage: boolean;
  /** The bundle track the learner follows ("" until placed). */
  track: TrackId | "";
  placement: PlacementSummary | null;
  /** Home-dialect profile: regional forms accepted as answers. "standard" is always implied. */
  dialects: DialectId[];
  toneMarks: ToneMarks;
  audioSpeed: AudioSpeed;
  dailyGoalMinutes: 5 | 10 | 15;
  reminder: Reminder;
  ageBand: AgeBand | null;
  /** Consents the learner actively accepted on this device (kind, version, time). */
  consents: ConsentRecord[];
  /** "apple" once Sign in with Apple linked an account; else anonymous. */
  account: "anonymous" | "apple";
}

export const DEFAULT_REMINDER: Reminder = { enabled: false, hour: 19, minute: 0 };

export const EMPTY_PROFILE: LocalProfile = {
  version: 2,
  onboardedAt: null,
  motives: [],
  familiarity: null,
  heritage: false,
  track: "",
  placement: null,
  dialects: [],
  toneMarks: "shown",
  audioSpeed: "natural",
  dailyGoalMinutes: 10,
  reminder: DEFAULT_REMINDER,
  ageBand: null,
  consents: [],
  account: "anonymous",
};

export const MOTIVES: readonly Motive[] = ["family", "partner", "roots", "school", "curious"];
const FAMILIARITY: readonly Familiarity[] = ["new", "some", "lots"];
const TONE_MARKS: readonly ToneMarks[] = ["shown", "reveal", "hidden"];
const BANDS: readonly AgeBand[] = ["under-13", "13-17", "18+"];
const REASONS: readonly PlacementSummary["reason"][] = ["self-report-new", "heritage-no-check", "heritage-placed", "start-with-sounds"];
const CONSENT_KINDS: readonly ConsentKind[] = ["terms", "privacy", "community-rules", "voice-notes"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const intIn = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d);

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseConsents(v: unknown): ConsentRecord[] {
  if (!Array.isArray(v)) return [];
  const out: ConsentRecord[] = [];
  for (const c of v) {
    if (!isObj(c) || !CONSENT_KINDS.includes(c.kind as ConsentKind) || typeof c.version !== "string" || !isIso(c.acceptedAt)) continue;
    out.push({ kind: c.kind as ConsentKind, version: c.version, acceptedAt: c.acceptedAt });
  }
  return out;
}

function parsePlacement(v: unknown): PlacementSummary | null {
  if (!isObj(v) || !isIso(v.takenAt) || !REASONS.includes(v.reason as PlacementSummary["reason"])) return null;
  return { takenAt: v.takenAt, correct: intIn(v.correct, 0, 1000, 0), total: intIn(v.total, 0, 1000, 0), reason: v.reason as PlacementSummary["reason"] };
}

/** Parse a stored v2 profile defensively: anything unexpected falls back field by field. Never throws. */
export function parseProfile(raw: string | null | undefined): LocalProfile {
  const v = parseJson(raw);
  if (!isObj(v)) return EMPTY_PROFILE;
  const r = isObj(v.reminder) ? v.reminder : {};
  const familiarity = FAMILIARITY.includes(v.familiarity as Familiarity) ? (v.familiarity as Familiarity) : null;
  return {
    version: 2,
    onboardedAt: isIso(v.onboardedAt) ? v.onboardedAt : null,
    motives: Array.isArray(v.motives) ? [...new Set(v.motives.filter((m): m is Motive => MOTIVES.includes(m as Motive)))] : [],
    familiarity,
    heritage: familiarity ? familiarity !== "new" : v.heritage === true,
    track: typeof v.track === "string" ? (v.track as TrackId) : "",
    placement: parsePlacement(v.placement),
    dialects: Array.isArray(v.dialects)
      ? [...new Set(v.dialects.filter((d): d is string => typeof d === "string" && /^[a-z][a-z0-9-]{1,31}$/.test(d) && d !== "standard"))].map((d) => d as DialectId)
      : [],
    toneMarks: TONE_MARKS.includes(v.toneMarks as ToneMarks) ? (v.toneMarks as ToneMarks) : "shown",
    audioSpeed: v.audioSpeed === "slow" ? "slow" : "natural",
    dailyGoalMinutes: v.dailyGoalMinutes === 5 || v.dailyGoalMinutes === 15 ? v.dailyGoalMinutes : 10,
    reminder: { enabled: r.enabled === true, hour: intIn(r.hour, 0, 23, DEFAULT_REMINDER.hour), minute: intIn(r.minute, 0, 59, DEFAULT_REMINDER.minute) },
    ageBand: BANDS.includes(v.ageBand as AgeBand) ? (v.ageBand as AgeBand) : null,
    consents: parseConsents(v.consents),
    account: v.account === "apple" ? "apple" : "anonymous",
  };
}

/** The shell's v1 profile (onboardedAt, motives, heritage, ageBand, showTones) as v2. */
export function migrateV1(raw: string): LocalProfile | null {
  const v = parseJson(raw);
  if (!isObj(v)) return null;
  const heritage = v.heritage === true;
  return {
    ...EMPTY_PROFILE,
    onboardedAt: isIso(v.onboardedAt) ? v.onboardedAt : null,
    motives: Array.isArray(v.motives) ? [...new Set(v.motives.filter((m): m is Motive => MOTIVES.includes(m as Motive)))] : [],
    familiarity: heritage ? "some" : null,
    heritage,
    ageBand: v.ageBand === "13-17" || v.ageBand === "18+" ? v.ageBand : null,
    toneMarks: v.showTones === false ? "reveal" : "shown",
  };
}

export function serializeProfile(p: LocalProfile): string {
  return JSON.stringify(p);
}

/** The social age tier for a band; unknown (null) is treated as a teen by lib/social/rules. */
export function ageTierOf(band: AgeBand | null): AgeTier | null {
  return band === "18+" ? "adult" : band === "13-17" ? "teen" : null;
}

/** Teens get Family Circle, approved friends and cohorts; open clubs and chat are 18+. */
export function canUseOpenCommunity(p: Pick<LocalProfile, "ageBand">): boolean {
  return ageTierOf(p.ageBand) === "adult";
}

/** What the learning engine needs from the profile. */
export function learnerSettings(p: LocalProfile, fallbackTrack: "new-learner" | "heritage" = "new-learner"): LearnerSettings {
  const t = p.track as string;
  const kind: "new-learner" | "heritage" = t === "heritage" || t === "new-learner" ? t : p.heritage ? "heritage" : fallbackTrack;
  return {
    track: kind,
    dialects: ["standard", ...p.dialects],
    showTones: p.toneMarks === "shown",
    dailyGoalMinutes: p.dailyGoalMinutes,
  };
}

/** Add or replace consents (one record per kind, the newest wins). */
export function withConsents(p: LocalProfile, add: readonly ConsentRecord[]): LocalProfile {
  const byKind = new Map(p.consents.map((c) => [c.kind, c]));
  for (const c of add) byKind.set(c.kind, c);
  return { ...p, consents: [...byKind.values()] };
}

/** Toggle a dialect in the home-dialect profile ("standard" is implicit and never stored). */
export function toggleDialect(p: LocalProfile, id: DialectId, on: boolean): LocalProfile {
  if (id === "standard") return p;
  const set = new Set(p.dialects);
  if (on) set.add(id);
  else set.delete(id);
  return { ...p, dialects: [...set] };
}

/**
 * The game layer's notification preferences for this learner: their reminder
 * time, and the teen audience (no chain nudges) unless they said 18+.
 * Feed it to `game.engine.notifications(state, now, prefs)`.
 */
export function reminderPrefs(p: Pick<LocalProfile, "reminder" | "ageBand">, days = 3): NotificationPrefs {
  return {
    enabled: p.reminder.enabled && p.ageBand !== "under-13",
    time: { hour: p.reminder.hour, minute: p.reminder.minute },
    audience: p.ageBand === "18+" ? "adult" : "teen",
    days,
  };
}
