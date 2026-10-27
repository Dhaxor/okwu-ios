// Social API contract (owner C). docs/CONTRACTS.md §4.
//
// Adapted from Ludo Royale's Cloudflare Worker + Durable Object + SQLite
// backend (ludo-royale-app/server-cf, logic in server/src): the same
// account/token scheme, friends, clubs, filtered messages, reports and admin
// moderation, with the gaps closed that a minors-in-audience app needs:
// age tiers, consent records, a fixed report-reason list, a report status
// workflow and audit log, temporary mutes and suspensions, money and
// grooming filters, and blocks applied to live pushes too.
//
// Safety invariants (the server enforces them; the client only mirrors):
// - Stranger contact with a minor is structurally impossible: no search, no
//   discovery, no free-text DMs; teens never share a cohort or club with adults.
// - Open clubs and their chat are 18+ only, and ship behind a flag until a
//   24-hour moderation rota exists.
// - Every user-generated surface has report and block. No photos in v1.
import type { IsoTime } from "@/lib/content/types";

type Brand<T, B extends string> = T & { readonly __brand: B };

/** "a_" + 20 hex chars (as in Ludo). */
export type AccountId = Brand<string, "AccountId">;
export type CircleId = Brand<string, "CircleId">;
export type CohortId = Brand<string, "CohortId">;
export type ClubId = Brand<string, "ClubId">;
export type ReportId = Brand<string, "ReportId">;
/** 7 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789, shared out of band. */
export type FriendCode = Brand<string, "FriendCode">;
/** A preset avatar id: no photos in v1. */
export type AvatarId = Brand<string, "AvatarId">;

// ---------------------------------------------------------------------------
// Accounts, age and consent
// ---------------------------------------------------------------------------

/** Session credentials. Header: `Authorization: Bearer <id>.<token>`; only sha256(token) is stored. */
export interface Creds {
  id: AccountId;
  token: string;
}

/** Unknown age is treated as "teen" everywhere. Under-13s cannot hold an account at launch. */
export type AgeTier = "teen" | "adult";

export interface AgeSignal {
  tier: AgeTier;
  /** Apple's Declared Age Range when available, else the onboarding answer. */
  source: "declared-age-range" | "self-declared";
  at: IsoTime;
}

export type ConsentKind = "terms" | "privacy" | "community-rules" | "voice-notes" | "guardian";

/** An affirmative acceptance, kept for audit (Apple 1.2 terms; NDPA guardian consent under 18). */
export interface ConsentRecord {
  kind: ConsentKind;
  /** Document version accepted. */
  version: string;
  acceptedAt: IsoTime;
  /** Guardian consent is recorded against the teen's account with a reference, never the guardian's data. */
  guardianRef?: string;
}

/** What other people may see. No age, location, email or real name. */
export interface PublicProfile {
  id: AccountId;
  code: FriendCode;
  displayName: string;
  avatar: AvatarId;
}

export interface MyAccount extends PublicProfile {
  age: AgeSignal | null;
  appleLinked: boolean;
  consents: ConsentRecord[];
  createdAt: IsoTime;
}

// ---------------------------------------------------------------------------
// Capabilities by age tier (lib/social/rules.ts implements, the server enforces)
// ---------------------------------------------------------------------------

export type SocialFeature =
  | "family-circle"
  | "voice-notes"
  | "friends-by-code"
  | "friend-streaks"
  | "cohorts"
  | "cohort-reactions"
  | "share-cards"
  | "clubs"
  | "club-chat"
  | "people-search"
  | "direct-messages";

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export interface FriendStreak {
  /** Days both practised. */
  days: number;
  lastBoth: string;
}

export interface Friend {
  profile: PublicProfile;
  since: IsoTime;
  streak: FriendStreak | null;
  /** Pull-only presence, as in Ludo (lobby socket connected). */
  online: boolean;
}

export interface FriendRequest {
  from: PublicProfile;
  at: IsoTime;
  /** Requests arrive only via a code shared out of band or a shared Family Circle. */
  via: "code" | "circle";
}

export interface FriendsView {
  code: FriendCode;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: PublicProfile[];
  blocked: AccountId[];
}

// ---------------------------------------------------------------------------
// Family Circle: invite-only; relatives record prompts and voice notes
// ---------------------------------------------------------------------------

export type Relation = "parent" | "grandparent" | "sibling" | "aunt-uncle" | "cousin" | "partner" | "child" | "other";

export interface CircleMember {
  profile: PublicProfile;
  role: "keeper" | "member";
  relation?: Relation;
  joinedAt: IsoTime;
}

export interface Circle {
  id: CircleId;
  name: string;
  members: CircleMember[];
  /** Shown to the keeper only; expires; rotates on demand. */
  invite?: { code: string; expiresAt: IsoTime };
  maxMembers: number;
}

/** A relative's recording: a prompt for the learner, or a reply. Audio only, ≤60 s, stored on R2. */
export interface VoiceNote {
  id: string;
  circle: CircleId;
  from: AccountId;
  /** null = to the whole circle. */
  to: AccountId | null;
  /** Optional English caption (filtered). Igbo here is family speech, not course content. */
  caption?: string;
  audioKey: string;
  durationMs: number;
  createdAt: IsoTime;
}

// ---------------------------------------------------------------------------
// Ọgbọ cohorts: co-op weekly quests, preset reactions only
// ---------------------------------------------------------------------------

export type ReactionId = "well-done" | "keep-going" | "thank-you" | "same-here" | "welcome";

export interface CohortQuest {
  week: string;
  goal: { kind: "reviews" | "lessons" | "minutes"; target: number };
  progress: number;
  endsAt: IsoTime;
}

export interface Cohort {
  id: CohortId;
  /** Monday of the start week (YYYY-MM-DD). */
  startWeek: string;
  /** Teens and adults are never placed in the same cohort. */
  tier: AgeTier;
  members: PublicProfile[];
  quest: CohortQuest;
}

export interface CohortReaction {
  from: PublicProfile;
  reaction: ReactionId;
  at: IsoTime;
}

// ---------------------------------------------------------------------------
// Otu clubs (18+, behind a flag until the moderation rota exists)
// ---------------------------------------------------------------------------

export type ClubRole = "owner" | "officer" | "member";

export interface ClubSummary {
  id: ClubId;
  name: string;
  badge: string;
  description: string;
  open: boolean;
  memberCount: number;
  maxMembers: number;
}

export interface ClubView {
  club: ClubSummary;
  role: ClubRole | null;
  members: { profile: PublicProfile; role: ClubRole; joinedAt: IsoTime }[];
  /** Members only. */
  inviteCode?: string;
}

export interface ClubMessage {
  id: number;
  club: ClubId;
  author: PublicProfile;
  /** Already filtered server-side (masked spans as ***). */
  text: string;
  at: IsoTime;
}

// ---------------------------------------------------------------------------
// Text filter (shared client/server module, as Ludo's src/game/moderation.ts)
// ---------------------------------------------------------------------------

export type FilterReason = "empty" | "too-long" | "profanity" | "contact" | "money" | "grooming";

export type FilterResult = { ok: true; text: string; masked: boolean } | { ok: false; reason: FilterReason };

export interface TextFilter {
  /** Chat lines and captions: masks contact info, rejects money/grooming/profanity. */
  chat(text: string, maxGraphemes: number): FilterResult;
  /** Display names, club names: rejects anything flagged. */
  name(text: string): FilterResult;
}

// ---------------------------------------------------------------------------
// Reports, blocks, moderation
// ---------------------------------------------------------------------------

/** A fixed list (Ludo had free text). */
export type ReportReason =
  | "spam"
  | "harassment"
  | "sexual-content"
  | "scam-or-money"
  | "contact-info"
  | "hate"
  | "self-harm"
  | "impersonation"
  | "underage-in-adult-space"
  | "other";

export type ReportTarget =
  | { kind: "account"; id: AccountId }
  | { kind: "club-message"; id: number; club: ClubId }
  | { kind: "voice-note"; id: string; circle: CircleId }
  | { kind: "club"; id: ClubId };

export interface ReportInput {
  target: ReportTarget;
  reason: ReportReason;
  note?: string;
}

export type ReportStatus = "open" | "actioned" | "dismissed";

export interface Report {
  id: ReportId;
  reporter: AccountId;
  target: ReportTarget;
  reason: ReportReason;
  note?: string;
  /** Snapshot of the reported content at report time. */
  excerpt?: string;
  createdAt: IsoTime;
  /** createdAt + 24 h (Apple 1.2 response window). */
  dueBy: IsoTime;
  status: ReportStatus;
  resolution?: { by: string; at: IsoTime; action: ModAction };
}

export type ModAction =
  | { kind: "dismiss" }
  | { kind: "remove-content" }
  | { kind: "reset-name" }
  | { kind: "mute"; hours: number }
  | { kind: "suspend"; days: number }
  | { kind: "remove-from-club"; club: ClubId }
  | { kind: "delete-account" };

/** Append-only. Dismissed reports are kept, never deleted. */
export interface AuditEntry {
  id: string;
  moderator: string;
  action: ModAction;
  target: ReportTarget;
  report?: ReportId;
  at: IsoTime;
  note?: string;
}

// ---------------------------------------------------------------------------
// Push and the lobby socket
// ---------------------------------------------------------------------------

export type PushKind = "voice-note" | "friend-request" | "friend-accepted" | "cohort-quest" | "daily-reminder";

/** Client → server on `/lobby`. */
export type LobbyClientMsg = { t: "auth"; id: AccountId; token: string } | { t: "ping" };

/** Server → client on `/lobby`. Blocked accounts' events are never delivered. */
export type LobbyServerMsg =
  | { t: "ready"; profile: PublicProfile }
  | { t: "friend_request"; from: PublicProfile }
  | { t: "friend_accepted"; by: PublicProfile }
  | { t: "voice_note"; note: VoiceNote }
  | { t: "cohort_reaction"; cohort: CohortId; reaction: CohortReaction }
  | { t: "club_msg"; message: ClubMessage }
  | { t: "error"; code: ApiErrorCode }
  | { t: "pong" };

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden-age"
  | "consent-required"
  | "not-found"
  | "blocked"
  | "already"
  | "limit"
  | "full"
  | "closed"
  | "filtered"
  | "slow-down"
  | "conflict"
  | "feature-off";

export interface ApiError {
  status: number;
  code: ApiErrorCode;
  /** For "filtered". */
  reason?: FilterReason;
}

/** The typed client the screens use (lib/social/index.ts). */
export interface SocialClient {
  // accounts
  ensureAccount(input: { displayName: string; avatar: AvatarId; age: AgeSignal; consents: ConsentRecord[] }): Promise<MyAccount>;
  signInWithApple(identityToken: string, nonce: string): Promise<{ account: MyAccount; switched: boolean }>;
  me(): Promise<MyAccount>;
  updateMe(patch: Partial<Pick<MyAccount, "displayName" | "avatar">>): Promise<MyAccount>;
  recordConsent(consent: ConsentRecord): Promise<void>;
  deleteAccount(): Promise<void>;
  // friends
  friends(): Promise<FriendsView>;
  requestFriend(code: FriendCode): Promise<{ status: "sent" | "friends" }>;
  respondFriend(id: AccountId, accept: boolean): Promise<void>;
  removeFriend(id: AccountId): Promise<void>;
  block(id: AccountId): Promise<void>;
  unblock(id: AccountId): Promise<void>;
  // family circle
  myCircles(): Promise<Circle[]>;
  createCircle(name: string): Promise<Circle>;
  joinCircle(inviteCode: string, relation?: Relation): Promise<Circle>;
  leaveCircle(id: CircleId): Promise<void>;
  rotateInvite(id: CircleId): Promise<Circle>;
  voiceNotes(id: CircleId, after?: IsoTime): Promise<VoiceNote[]>;
  sendVoiceNote(id: CircleId, input: { to: AccountId | null; caption?: string; audio: { uri: string; durationMs: number } }): Promise<VoiceNote>;
  // cohorts
  myCohort(): Promise<Cohort | null>;
  react(cohort: CohortId, reaction: ReactionId): Promise<void>;
  // clubs (adults, flagged)
  searchClubs(q: string): Promise<ClubSummary[]>;
  club(id: ClubId): Promise<ClubView>;
  createClub(input: { name: string; badge: string; description: string; open: boolean }): Promise<ClubView>;
  joinClub(ref: { id: ClubId } | { code: string }): Promise<ClubView>;
  leaveClub(): Promise<void>;
  clubMessages(after?: number): Promise<ClubMessage[]>;
  sendClubMessage(text: string): Promise<ClubMessage>;
  deleteClubMessage(id: number): Promise<void>;
  // safety
  report(input: ReportInput): Promise<{ id: ReportId }>;
  // push
  registerPush(token: string, lang: string): Promise<void>;
  unregisterPush(token?: string): Promise<void>;
}
