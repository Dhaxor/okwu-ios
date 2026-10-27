// What the Community, Me and Settings screens need to decide, pure and
// tested (community.test.ts): who may send voice notes and why not, the
// adult's side of guardian consent, the Ọgbọ quest from the server's
// cohort, filter feedback while typing, and small display helpers.
import type { Credit } from "@/lib/content/types";
import type { QuestMetric, QuestView } from "@/lib/game/types";
import { FILTER_MESSAGES, createTextFilter, type AccountId, type AgeTier, type CircleMember, type CircleView, type CohortView, type PublicProfile, type ReactionId, type Relation } from "@/lib/social";

export const RELATION_LABELS: Record<Relation, string> = {
  parent: "Parent",
  grandparent: "Grandparent",
  sibling: "Brother or sister",
  "aunt-uncle": "Aunt or uncle",
  cousin: "Cousin",
  partner: "Partner",
  child: "Son or daughter",
  other: "Family",
};

export const RELATIONS: readonly Relation[] = ["parent", "grandparent", "sibling", "aunt-uncle", "cousin", "partner", "child", "other"];

/** The preset reactions, in the order the cohort card shows them. */
export const REACTION_LABELS: Record<ReactionId, string> = {
  "well-done": "Well done",
  "keep-going": "Keep going",
  "thank-you": "Thank you",
  "same-here": "Same here",
  welcome: "Welcome",
};
export const REACTION_ORDER: readonly ReactionId[] = ["well-done", "keep-going", "thank-you", "same-here", "welcome"];

/** Ideas a relative can record for the learner. English prompts; the Igbo is the family's own voice. */
export const PROMPT_IDEAS: readonly string[] = [
  "How you greet the elders in the morning",
  "A proverb your own parents used",
  "Everyone's names at home, and what they mean",
  "What we say before we eat",
  "A short story from when you were young",
];

// ---------------------------------------------------------------------------
// Voice notes: who may send, and what stands in the way
// ---------------------------------------------------------------------------

export type VoiceState =
  | { kind: "ready" }
  /** The person's own voice-note consent (90-day retention, everyone in the circle hears it). */
  | { kind: "needs-own-consent"; thenGuardian: boolean }
  /** A teen who hasn't asked an adult in the circle yet. */
  | { kind: "needs-guardian"; candidates: CircleMember[] }
  /** Asked; waiting for that adult to say yes from their own account. */
  | { kind: "guardian-pending"; guardian: PublicProfile | null }
  /** A teen in a circle with no adult in it: nobody here can say yes. */
  | { kind: "no-guardian-here" }
  /** Muted by a moderator. */
  | { kind: "muted" };

/**
 * What the record button should do for this person in this circle. `tier`
 * null is treated as a teen (lib/social/rules). Candidates are the members
 * the server marks `canBeGuardian` (the adults a teen may ask; it tells only
 * the teen, and checks again when they ask). With an older server that
 * doesn't send it, the screen may pass the adults it knows (`adults`),
 * defaulting to keepers and parents.
 */
export function voiceState(circle: CircleView, me: AccountId | null, tier: AgeTier | null, adults?: readonly AccountId[]): VoiceState {
  if (circle.voice.canSend) return { kind: "ready" };
  const needs = circle.voice.needs;
  if (needs.length === 0) return { kind: "muted" };
  if (needs.includes("voice-notes")) return { kind: "needs-own-consent", thenGuardian: needs.includes("guardian") };
  const teen = (tier ?? "teen") === "teen";
  if (!teen || !needs.includes("guardian")) return { kind: "muted" };
  const mine = circle.guardians.filter((g) => g.teen === me);
  const pending = mine.find((g) => g.status === "pending");
  if (pending) return { kind: "guardian-pending", guardian: circle.members.find((m) => m.profile.id === pending.guardian)?.profile ?? null };
  const told = circle.members.some((m) => typeof m.canBeGuardian === "boolean");
  const candidates = circle.members.filter(
    (m) =>
      m.profile.id !== me &&
      (told ? m.canBeGuardian === true : adults ? adults.includes(m.profile.id) : m.role === "keeper" || m.relation === "parent" || m.relation === "grandparent" || m.relation === "aunt-uncle")
  );
  return candidates.length ? { kind: "needs-guardian", candidates } : { kind: "no-guardian-here" };
}

/** The adult's side: teens in this circle who asked me to say yes to their voice notes. */
export function consentRequestsForMe(circle: CircleView, me: AccountId | null): PublicProfile[] {
  if (!me) return [];
  return circle.guardians
    .filter((g) => g.guardian === me && g.status === "pending")
    .map((g) => circle.members.find((m) => m.profile.id === g.teen)?.profile)
    .filter((p): p is PublicProfile => !!p);
}

/** Teens I have said yes for (so I can withdraw it). */
export function consentsIGave(circle: CircleView, me: AccountId | null): PublicProfile[] {
  if (!me) return [];
  return circle.guardians
    .filter((g) => g.guardian === me && g.status === "granted")
    .map((g) => circle.members.find((m) => m.profile.id === g.teen)?.profile)
    .filter((p): p is PublicProfile => !!p);
}

// ---------------------------------------------------------------------------
// The Ọgbọ weekly quest from the server's cohort
// ---------------------------------------------------------------------------

/**
 * The server's goal kinds are reviews, lessons and minutes; the game's
 * QuestCard counts lessons, words spoken, new words, chapters and days.
 * Only "lessons" means the same thing in both, so only that week is shown
 * on the QuestCard; the others get `cohortGoal` (a plain line and bar).
 */
const SHARED_METRIC: Partial<Record<CohortView["quest"]["goal"]["kind"], QuestMetric>> = { lessons: "lessons" };

export function questFromCohort(c: CohortView, now: Date): QuestView | null {
  const metric = SHARED_METRIC[c.quest.goal.kind];
  if (!metric) return null;
  const target = Math.max(1, c.quest.goal.target);
  const total = Math.max(0, Math.min(c.quest.progress, target));
  const mine = Math.max(0, Math.min(c.mine.lessons, total));
  const daysLeft = Math.max(0, Math.ceil((Date.parse(c.quest.endsAt) - now.getTime()) / 86_400_000));
  return {
    questId: "lessons-together",
    metric,
    title: "Lessons together",
    detail: "Finish lessons as a cohort. Every lesson anyone finishes counts for everyone.",
    target,
    total,
    mine,
    members: c.members.length,
    progress: total / target,
    daysLeft,
    complete: c.completed || total >= target,
  };
}

const GOAL_UNIT: Record<CohortView["quest"]["goal"]["kind"], [string, string]> = {
  reviews: ["review", "reviews"],
  lessons: ["lesson", "lessons"],
  minutes: ["minute of practice", "minutes of practice"],
};

/** A plain description of any cohort goal (when the QuestCard can't show it). */
export function cohortGoal(c: CohortView): { line: string; progress: number; mine: number } {
  const g = c.quest.goal;
  const unit = GOAL_UNIT[g.kind][g.target === 1 ? 0 : 1];
  const mine = g.kind === "reviews" ? c.mine.reviews : g.kind === "minutes" ? c.mine.minutes : c.mine.lessons;
  return { line: `${Math.min(c.quest.progress, g.target)} of ${g.target} ${unit}, together`, progress: g.target > 0 ? Math.min(1, c.quest.progress / g.target) : 0, mine };
}

// ---------------------------------------------------------------------------
// Typing feedback (the server is authoritative; this is the instant hint)
// ---------------------------------------------------------------------------

const filter = createTextFilter();

export type TypingFeedback = { ok: true; masked: boolean; hint: string | null } | { ok: false; message: string };

/** Live feedback for a chat line or caption. Empty text is fine while typing. */
export function chatFeedback(text: string, maxGraphemes: number, strict = false): TypingFeedback {
  if (!text.trim()) return { ok: true, masked: false, hint: null };
  const r = filter.chat(text, maxGraphemes, { strict });
  if (!r.ok) return { ok: false, message: FILTER_MESSAGES[r.reason] };
  return r.masked ? { ok: true, masked: true, hint: "Phone numbers, links and other apps will show as ***." } : { ok: true, masked: false, hint: null };
}

/** Live feedback for a display name or club name. */
export function nameFeedback(text: string, maxGraphemes?: number): TypingFeedback {
  if (!text.trim()) return { ok: true, masked: false, hint: null };
  const r = filter.name(text, maxGraphemes ? { maxGraphemes } : {});
  if (!r.ok) return { ok: false, message: r.reason === "empty" ? "At least 2 letters." : FILTER_MESSAGES[r.reason] };
  return { ok: true, masked: false, hint: null };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** "0:14", "1:00". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "4 days ago", or the date. */
export function timeAgo(iso: string, now: Date): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86_400);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** `timeAgo` inside a sentence ("joined just now", "friends since 28 Sept"): only "Just now" and "Yesterday" lose their capital, never a month. */
export function timeAgoInline(iso: string, now: Date): string {
  const s = timeAgo(iso, now);
  return s === "Just now" || s === "Yesterday" ? s.toLowerCase() : s;
}

/** "Until 14:00 tomorrow" style, for a mute or a suspension. */
export function untilCopy(iso: string, now: Date): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return `until ${hm} today`;
  if (days === 1) return `until ${hm} tomorrow`;
  return `until ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function slowModeCopy(seconds: number): string | null {
  if (seconds <= 0) return null;
  return seconds < 60 ? `Slow mode · ${seconds} s` : `Slow mode · ${Math.round(seconds / 60)} min`;
}

/** First letter for an avatar (no photos in v1). */
export function initialOf(name: string): string {
  const ch = [...name.trim()][0];
  return ch ? ch.toLocaleUpperCase() : "?";
}

/** A stable 0..3 for an avatar's tint. */
export function tintOf(id: string): 0 | 1 | 2 | 3 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 4) as 0 | 1 | 2 | 3;
}

/** The friend code with a gap in the middle, easier to read aloud ("K7Q 2M9P"). */
export function spacedCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** Normalise what someone typed as a code: capitals, no spaces or dashes. */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]+/g, "");
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

/** The licence the dataset text and recordings are shared under (CC BY 4.0 asks us to link it). */
export const CC_BY_4_URL = "https://creativecommons.org/licenses/by/4.0/";

/**
 * CC BY 4.0 asks us to say we changed the recordings (docs/DEPLOY.md, release
 * audio: the same change every file's copyright tag records).
 */
export const RECORDINGS_CHANGED_NOTE = "Recordings trimmed, made mono and loudness-normalised by Okwu.";

/** Credits' sections: the course, the phrasebook and the culture library, each with its own source lines. */
export function creditSections(input: { course: readonly Credit[]; phrasebook: string | null; library: readonly string[] }): { id: string; title: string; lines: { id: string; text: string; url?: string }[] }[] {
  const end = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
  const out = [
    { id: "course", title: "Lessons and the dictionary", lines: creditLines(input.course) },
    { id: "phrasebook", title: "Phrasebook and conversations", lines: input.phrasebook ? [{ id: "phrasebook", text: end(input.phrasebook) }] : [] },
    { id: "library", title: "Culture library", lines: input.library.map((t, i) => ({ id: `library-${i}`, text: end(t) })) },
  ];
  return out.filter((s) => s.lines.length > 0);
}

/**
 * The credit lines for About › Credits, from the bundle. The Igbo API line
 * always carries the permission note (docs/licenses/IGBO_API.md).
 */
export function creditLines(credits: readonly Credit[]): { id: string; text: string; url?: string }[] {
  return credits.map((c) => {
    let text = c.text.trim();
    if (c.id === "igbo-api" && !/used with permission/i.test(text)) text = `${text.replace(/\.$/, "")}. Used with permission.`;
    return { id: c.id, text, ...(c.url ? { url: c.url } : {}) };
  });
}
