// Wire-level additions to the Social contract (owner C). lib/social/types.ts is
// the shared contract and stays as agreed; what the server sends on top of it
// lives here, so the client (client.ts) and the server (server/src) agree on
// one definition. Every type here extends a contract type; nothing replaces
// one. Proposed for folding into types.ts at the next contract review.
import type { IsoTime } from "@/lib/content/types";
import type {
  AccountId,
  ApiErrorCode,
  Circle,
  CircleId,
  CircleMember,
  ClubView,
  Cohort,
  CohortReaction,
  ConsentKind,
  Creds,
  FilterReason,
  LobbyServerMsg,
  MyAccount,
  PublicProfile,
  PushKind,
  VoiceNote,
} from "./types";

/** ApiErrorCode plus the codes a moderated account and a malformed request need. */
export type SocialErrorCode = ApiErrorCode | "suspended" | "muted" | "bad-request" | "too-large";

/** Every error body: `{ error }` plus optional detail. */
export interface WireError {
  error: SocialErrorCode;
  /** For "filtered". */
  reason?: FilterReason;
  /** For "slow-down": when to try again. */
  retryAfterMs?: number;
  /** For "muted" / "suspended". */
  until?: IsoTime;
  /** For "consent-required": what to accept first. */
  needs?: ConsentKind[];
}

/** The consents every account needs before any social feature (Apple 1.2: terms actively accepted). */
export type RequiredConsentKind = "terms" | "privacy" | "community-rules";
export const REQUIRED_CONSENTS: readonly RequiredConsentKind[] = ["terms", "privacy", "community-rules"];

/** GET /api/config (no auth): live flags and the document versions to accept. */
export interface SocialConfig {
  /**
   * voiceNotes is false until the server has voice storage; the app hides
   * recording then, and no voice-reply family challenge is offered. push is
   * whether the server sends community push notifications (PUSH_ENABLED).
   */
  flags: { clubs: boolean; voiceNotes?: boolean; push?: boolean };
  versions: Record<RequiredConsentKind | "voice-notes", string>;
  /** Published contact for safety reports (Apple 1.2). */
  contact: string;
  voiceRetentionDays: number;
}

/**
 * Trust in clubs, from account age and history:
 * 0 = new (under a day old, or restricted after an upheld report): slow chat, cannot create clubs.
 * 1 = member. 2 = established (3+ days, clean record): can create clubs.
 */
export type TrustLevel = 0 | 1 | 2;

export type AppealStatus = "open" | "upheld" | "denied";

export interface Sanction {
  id: string;
  kind: "mute" | "suspend";
  until: IsoTime;
  createdAt: IsoTime;
  /** Plain-English reason shown to the person. */
  reason: string;
  appeal: AppealStatus | null;
}

export interface Standing {
  mutedUntil: IsoTime | null;
  suspendedUntil: IsoTime | null;
  trust: TrustLevel;
  sanctions: Sanction[];
}

/** GET /api/me. */
export interface MyAccountView extends MyAccount {
  standing: Standing;
  /** Consents still to accept (current versions) before social features open. */
  needsConsent: ConsentKind[];
  /** True once a self-declared age can no longer be changed in the app. */
  ageLocked: boolean;
  config: SocialConfig;
}

/** POST /api/accounts (201). */
export interface AccountCreated {
  creds: Creds;
  account: MyAccountView;
  /** Set when the requested display name was refused and a generated one used. */
  nameReplaced?: FilterReason;
}

/** POST /api/auth/apple. */
export interface AppleSignInResult {
  creds: Creds;
  account: MyAccountView;
  switched: boolean;
}

/** A teen's guardian inside a shared Family Circle (two-sided: the teen asks, the adult consents). */
export interface GuardianLink {
  teen: AccountId;
  guardian: AccountId;
  status: "pending" | "granted";
  at: IsoTime;
}

/**
 * A circle member as the circle view lists them. `canBeGuardian` is set only
 * when the viewer is a teen (the one who has to choose who to ask): true for
 * the adults in the circle they may ask, false for everyone else. Nobody's
 * age, birth year or tier is ever sent to other members; the server checks
 * the rule again when the teen asks.
 */
export interface CircleMemberView extends CircleMember {
  canBeGuardian?: boolean;
}

/** The kinds of weekly Family Circle challenge (lib/social/weekly.ts picks one per circle per week). */
export type FamilyChallengeKind = "lessons" | "words" | "voice-replies";

/**
 * A Family Circle's shared challenge for this week (Monday to Monday, UTC,
 * like the cohort quest). Co-op only: one shared bar, no ranking, no amounts
 * per person, and nothing is lost when a week ends unfinished.
 */
export interface FamilyChallengeView {
  circle: CircleId;
  /** Monday of the week (YYYY-MM-DD). */
  week: string;
  kind: FamilyChallengeKind;
  /** Fixed when the week's challenge starts. */
  target: number;
  /** The family's total so far (capped at the target); it never goes down during the week. */
  progress: number;
  /** What the viewer added. */
  mine: number;
  /** Members who added something this week, in the order they joined (display names only, never amounts). */
  helpers: PublicProfile[];
  completed: boolean;
  completedAt: IsoTime | null;
  endsAt: IsoTime;
}

/** GET /api/circles items and every circle mutation. */
export interface CircleView extends Circle {
  members: CircleMemberView[];
  myRole: "keeper" | "member";
  hasTeen: boolean;
  guardians: GuardianLink[];
  voice: {
    canSend: boolean;
    /** What blocks sending: the person's own voice-note consent, and for a teen a guardian's. */
    needs: ("voice-notes" | "guardian")[];
  };
  /** This week's family challenge (absent from servers older than 2026-10-23). */
  challenge?: FamilyChallengeView;
}

/** Voice notes as listed: every note is visible to every circle member. */
export interface VoiceNoteView extends VoiceNote {
  author: PublicProfile | null;
  /** GET this path (with the Bearer header) for the audio. */
  audioPath: string;
}

export interface WeekContribution {
  reviews: number;
  lessons: number;
  minutes: number;
}

/**
 * POST /api/progress: week-to-date totals (idempotent: the server keeps the
 * highest it has seen) and today's local date. Counts only, never content.
 * `words` (new words met this week) feeds the family challenge; older apps
 * leave it out.
 */
export interface ProgressInput extends WeekContribution {
  day: string;
  words?: number;
}

/** GET /api/cohort. */
export interface CohortView extends Cohort {
  reactions: CohortReaction[];
  mine: WeekContribution;
  completed: boolean;
}

/** GET /api/clubs/:id and the club mutations. */
export interface ClubViewExt extends ClubView {
  slowModeSeconds: number;
  trust: TrustLevel;
  /** When a club officer or the moderators muted me here. */
  mutedUntil: IsoTime | null;
}

export interface AppealView {
  id: string;
  sanction: string;
  text: string;
  status: AppealStatus;
  createdAt: IsoTime;
  decidedAt: IsoTime | null;
}

/**
 * Push kinds the server sends: the contract's (except the daily reminder,
 * which is local to the device) plus a guardian request and a finished
 * family challenge.
 */
export type ServerPushKind = Exclude<PushKind, "daily-reminder"> | "guardian-request" | "challenge-complete";

/**
 * Server → client on `/lobby`: the contract's messages plus two that only
 * say something changed (the app refetches the circle). Blocked accounts'
 * events are never delivered.
 */
export type LobbyServerMsgExt =
  | LobbyServerMsg
  | { t: "guardian_request"; circle: CircleId; teen: PublicProfile }
  | { t: "family_challenge"; circle: CircleId; week: string; completed: boolean };

/** Routes added to ROUTES (lib/social/index.ts) by the server. */
export const EXTRA_ROUTES = {
  config: "GET /api/config",
  setAge: "POST /api/me/age",
  progress: "POST /api/progress",
  mute: "POST /api/mutes",
  unmute: "DELETE /api/mutes/:id",
  circleRemove: "POST /api/circles/:id/remove",
  guardianRequest: "POST /api/circles/:id/guardian",
  guardianConsent: "POST /api/circles/:id/guardian/consent",
  guardianRevoke: "DELETE /api/circles/:id/guardian/:teen",
  voiceNoteAudio: "GET /api/circles/:id/notes/:note/audio",
  voiceNoteDelete: "DELETE /api/circles/:id/notes/:note",
  clubMine: "GET /api/clubs/mine",
  clubKick: "POST /api/clubs/kick",
  clubMute: "POST /api/clubs/mute",
  clubRole: "POST /api/clubs/role",
  clubSettings: "PATCH /api/clubs/settings",
  appeals: "GET /api/appeals",
  appealCreate: "POST /api/appeals",
  familyChallenge: "GET /api/circles/:id/challenge",
  signOut: "POST /api/signout",
} as const;

/** Voice-note uploads: multipart form fields. */
export const VOICE_UPLOAD = {
  metaField: "meta",
  audioField: "audio",
  maxBytes: 1_500_000,
  minMs: 300,
  types: ["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"],
} as const;
