// Who may use what, by age tier. The server enforces the same table; the
// client uses it to hide what a person cannot use (never to grant access).
import type { AgeTier, ApiErrorCode, ReportReason, SocialFeature } from "./types";

/**
 * Launch flags. Owner decision 2026-10-23: open clubs with filtered chat at
 * launch, adults (18+) only. This is the app's default; the server's
 * GET /api/config is the live value (the admin kill switch can turn clubs off
 * without a release), so screens should prefer `config.flags`.
 */
export const SOCIAL_FLAGS = {
  clubs: true,
} as const;

const TEEN: ReadonlySet<SocialFeature> = new Set<SocialFeature>([
  "family-circle",
  "voice-notes",
  "friends-by-code",
  "friend-streaks",
  "cohorts",
  "cohort-reactions",
  "share-cards",
]);

const ADULT: ReadonlySet<SocialFeature> = new Set<SocialFeature>([...TEEN, "clubs", "club-chat"]);

/** Never at launch, for anyone: these are how strangers reach people. */
export const NEVER_AT_LAUNCH: readonly SocialFeature[] = ["people-search", "direct-messages"];

/**
 * Can someone with this tier use the feature? Unknown age (null) is a teen.
 * Clubs also need SOCIAL_FLAGS.clubs.
 */
export function can(tier: AgeTier | null, feature: SocialFeature, flags: { clubs: boolean } = SOCIAL_FLAGS): boolean {
  if (NEVER_AT_LAUNCH.includes(feature)) return false;
  if ((feature === "clubs" || feature === "club-chat") && !flags.clubs) return false;
  return (tier === "adult" ? ADULT : TEEN).has(feature);
}

/** Why a feature is unavailable, as the API would say. */
export function denial(tier: AgeTier | null, feature: SocialFeature, flags: { clubs: boolean } = SOCIAL_FLAGS): ApiErrorCode | null {
  if (can(tier, feature, flags)) return null;
  if ((feature === "clubs" || feature === "club-chat") && tier === "adult") return "feature-off";
  return "forbidden-age";
}

/** Two accounts may be cohort-mates or club-mates only within the same tier. */
export function sameSpace(a: AgeTier | null, b: AgeTier | null): boolean {
  return (a ?? "teen") === (b ?? "teen");
}

/**
 * May these two accounts become friends? Within a tier, by code. Across
 * tiers (a teen and an adult) only when they already share a Family Circle,
 * so an adult stranger holding a teen's code still cannot connect.
 * Default pending the owner's decision (docs/CONTRACTS.md §7).
 */
export function mayBefriend(a: AgeTier | null, b: AgeTier | null, shareCircle: boolean): boolean {
  return sameSpace(a, b) || shareCircle;
}

export const REPORT_REASONS: readonly { id: ReportReason; label: string }[] = [
  { id: "harassment", label: "Bullying or harassment" },
  { id: "sexual-content", label: "Sexual content" },
  { id: "scam-or-money", label: "Asking for money or a scam" },
  { id: "contact-info", label: "Sharing contact details" },
  { id: "hate", label: "Hate" },
  { id: "self-harm", label: "Someone may be at risk" },
  { id: "impersonation", label: "Pretending to be someone" },
  { id: "underage-in-adult-space", label: "Under 18 in an adult space" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Something else" },
];

/** Limits carried over from Ludo, tightened where minors are involved. */
export const LIMITS = {
  maxFriends: 200,
  maxPendingIncoming: 50,
  friendRequestsPerHour: 30,
  reportsPerHour: 20,
  circleMaxMembers: 12,
  voiceNoteMaxMs: 60_000,
  clubMaxMembers: 30,
  clubMessageMaxGraphemes: 200,
  clubMessageMinGapMs: 2000,
  clubMessagesPer5Min: 20,
  reportResponseHours: 24,
} as const;
