// Social client (owner C). The HTTP routes mirror Ludo Royale's Worker API,
// renamed for Okwu; docs/CONTRACTS.md §4 has the full table, and
// lib/social/protocol.ts the additions. Screens import from here only.
import { createSocialClient as create, type OkwuSocialClient, type SocialClientOptions } from "./client";
import { createTextFilter as createFilter, type ExtraTerms, type OkwuTextFilter } from "./filter";
import { EXTRA_ROUTES } from "./protocol";

export type * from "./types";
export type * from "./protocol";
export * from "./rules";
export { attempt, errorMessage, isSocialError, memoryCredsStore, SocialError } from "./client";
export type { Attempt, CredsStore, LobbyConnection, LobbyHandlers, OkwuSocialClient, SocialClientOptions, SocialErrorKind } from "./client";
export { cleanText, FILTER_MESSAGES } from "./filter";
export type { FilterOptions, OkwuTextFilter, Scan } from "./filter";
export { REQUIRED_CONSENTS, VOICE_UPLOAD } from "./protocol";
export { COHORT_GOALS, FAMILY_CHALLENGES, cohortGoalFor, familyChallengeFor, familyChallengeKinds, familyTarget, mondayOf, nextMonday } from "./weekly";
export type { CohortGoalKind } from "./weekly";

/** Read as a plain process.env property so Metro inlines it in release builds (a Ludo lesson). */
export const API_BASE = process.env.EXPO_PUBLIC_OKWU_API ?? "http://localhost:8787";

/** SecureStore key for Creds (AFTER_FIRST_UNLOCK), as in Ludo. */
export const CREDS_KEY = "okwu.account.v1";

export const ROUTES = {
  createAccount: "POST /api/accounts",
  appleSignIn: "POST /api/auth/apple",
  me: "GET /api/me",
  updateMe: "PATCH /api/me",
  deleteMe: "DELETE /api/me",
  consent: "POST /api/consents",
  friends: "GET /api/friends",
  friendRequest: "POST /api/friends/request",
  friendRespond: "POST /api/friends/respond",
  friendRemove: "DELETE /api/friends/:id",
  block: "POST /api/blocks",
  unblock: "DELETE /api/blocks/:id",
  circles: "GET /api/circles",
  circleCreate: "POST /api/circles",
  circleJoin: "POST /api/circles/join",
  circleLeave: "POST /api/circles/:id/leave",
  circleInvite: "POST /api/circles/:id/invite",
  voiceNotes: "GET /api/circles/:id/notes",
  voiceNoteSend: "POST /api/circles/:id/notes",
  cohort: "GET /api/cohort",
  cohortReact: "POST /api/cohort/react",
  clubs: "GET /api/clubs",
  clubCreate: "POST /api/clubs",
  club: "GET /api/clubs/:id",
  clubJoin: "POST /api/clubs/join",
  clubLeave: "POST /api/clubs/leave",
  clubMessages: "GET /api/clubs/messages",
  clubMessageSend: "POST /api/clubs/messages",
  clubMessageDelete: "DELETE /api/clubs/messages/:id",
  report: "POST /api/reports",
  pushRegister: "POST /api/push",
  pushUnregister: "DELETE /api/push",
  lobby: "WS /lobby",
  ...EXTRA_ROUTES,
} as const;

/** The client the screens use. Pass a SecureStore-backed `creds` store in the app. */
export function createSocialClient(options: string | SocialClientOptions = API_BASE): OkwuSocialClient {
  return create(typeof options === "string" ? { base: options } : { base: API_BASE, ...options });
}

/** The shared filter (client gives instant feedback; the server is authoritative and may know more terms). */
export function createTextFilter(extra?: ExtraTerms): OkwuTextFilter {
  return createFilter(extra);
}
