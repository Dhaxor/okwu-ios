// Social session logic, pure (tested). The hook is ./SocialProvider.tsx.
//
// Apple Guideline 1.2: the terms, privacy policy and community rules are
// actively accepted before any social feature opens. Acceptance is kept on
// the device (profile.consents) and sent with the account, so it works
// offline and is never asked twice for the same versions.
// Age: unknown is a teen (lib/social/rules); under-13s never get an account.
import { REQUIRED_CONSENTS, SOCIAL_FLAGS, can, type AgeSignal, type ConsentRecord, type RequiredConsentKind, type SocialConfig, type SocialFeature } from "@/lib/social";
import type { AgeBand, LocalProfile } from "./profile";
import { ageTierOf } from "./profile";

/** The versions the server ships by default (server/src/config.ts), used until GET /api/config answers. */
export const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  flags: { clubs: SOCIAL_FLAGS.clubs },
  versions: { terms: "2026-10", privacy: "2026-10", "community-rules": "2026-10", "voice-notes": "2026-10" },
  contact: "safety@okwu.app",
  voiceRetentionDays: 90,
};

export const SOCIAL_CONFIG_KEY = "okwu.socialconfig.v1";

/**
 * Where the documents are published: EXPO_PUBLIC_OKWU_SITE (read as a plain
 * property so Metro inlines it), else okwu.app. The drafts are in
 * docs/site/*.html; any static host that serves `/terms` for `terms.html`
 * (GitHub Pages, Cloudflare Pages, Netlify) works as is.
 */
export const SITE_BASE = (process.env.EXPO_PUBLIC_OKWU_SITE || "https://okwu.app").replace(/\/+$/, "");

export function siteUrl(path: string): string {
  return `${SITE_BASE}/${path.replace(/^\/+/, "")}`;
}

/** Where the documents live. */
export const LEGAL_URLS: Record<RequiredConsentKind, string> = {
  terms: siteUrl("terms"),
  privacy: siteUrl("privacy"),
  "community-rules": siteUrl("community-rules"),
};

export const CONSENT_TITLES: Record<RequiredConsentKind, string> = {
  terms: "Terms of Use",
  privacy: "Privacy Policy",
  "community-rules": "Community Rules",
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const VERSION = /^[\w.-]{1,32}$/;

/** Parse a cached or fetched config; anything missing falls back to the defaults. Never throws. */
export function parseSocialConfig(raw: unknown): SocialConfig {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  if (!isObj(v)) return DEFAULT_SOCIAL_CONFIG;
  const d = DEFAULT_SOCIAL_CONFIG;
  const flags = isObj(v.flags) ? v.flags : {};
  const versions = isObj(v.versions) ? v.versions : {};
  const ver = (k: keyof SocialConfig["versions"]) => (typeof versions[k] === "string" && VERSION.test(versions[k] as string) ? (versions[k] as string) : d.versions[k]);
  return {
    // voiceNotes and push are kept when the server sends them (absent: an older server; screens treat that as on / unknown).
    flags: {
      clubs: typeof flags.clubs === "boolean" ? flags.clubs : d.flags.clubs,
      ...(typeof flags.voiceNotes === "boolean" ? { voiceNotes: flags.voiceNotes } : {}),
      ...(typeof flags.push === "boolean" ? { push: flags.push } : {}),
    },
    versions: { terms: ver("terms"), privacy: ver("privacy"), "community-rules": ver("community-rules"), "voice-notes": ver("voice-notes") },
    contact: typeof v.contact === "string" && v.contact.length < 200 ? v.contact : d.contact,
    voiceRetentionDays: typeof v.voiceRetentionDays === "number" && v.voiceRetentionDays > 0 ? Math.floor(v.voiceRetentionDays) : d.voiceRetentionDays,
  };
}

/** Required consents not yet accepted at the current versions. */
export function missingConsents(consents: readonly ConsentRecord[], config: SocialConfig): RequiredConsentKind[] {
  return REQUIRED_CONSENTS.filter((k) => !consents.some((c) => c.kind === k && c.version === config.versions[k]));
}

export function termsAccepted(consents: readonly ConsentRecord[], config: SocialConfig): boolean {
  return missingConsents(consents, config).length === 0;
}

/** The records for accepting every required document now. */
export function acceptAll(config: SocialConfig, now: Date): ConsentRecord[] {
  return REQUIRED_CONSENTS.map((kind) => ({ kind, version: config.versions[kind], acceptedAt: now.toISOString() }));
}

/** The age signal for the server (self-declared in onboarding). Null for no answer; never for under-13s. */
export function ageSignalFor(band: AgeBand | null, now: Date): AgeSignal | null {
  const tier = ageTierOf(band);
  return tier ? { tier, source: "self-declared", at: now.toISOString() } : null;
}

export type SocialGate =
  /** Under 13: no account, no social features. */
  | "too-young"
  /** Age not given yet (onboarding not finished). */
  | "no-age"
  /** The documents must be accepted first (Apple 1.2). */
  | "needs-terms"
  | "open";

export function socialGate(profile: Pick<LocalProfile, "ageBand" | "consents">, config: SocialConfig): SocialGate {
  if (profile.ageBand === "under-13") return "too-young";
  if (!profile.ageBand) return "no-age";
  return termsAccepted(profile.consents, config) ? "open" : "needs-terms";
}

/**
 * Whether the provider should make the anonymous account now: the gate is
 * open, there is no account on this phone, nothing is underway or failing, and
 * the learner has not just deleted theirs. Right after a deletion the profile
 * still holds the age and the accepted documents (it resets a moment later),
 * so without that last condition the gate reads "open" and a fresh account
 * would be made on the server the instant the old one was deleted.
 */
export function shouldMakeAccount(s: { gate: SocialGate; hasCreds: boolean; status: string; justDeleted: boolean }): boolean {
  return s.gate === "open" && !s.hasCreds && !s.justDeleted && s.status !== "working" && s.status !== "offline" && s.status !== "error";
}

/**
 * May this learner use a social feature now? The tier table (lib/social/rules)
 * AND the gate: nothing social before the terms are accepted. The server
 * enforces the same; this only decides what to show.
 */
export function mayUse(profile: Pick<LocalProfile, "ageBand" | "consents">, config: SocialConfig, feature: SocialFeature): boolean {
  if (socialGate(profile, config) !== "open") return false;
  return can(ageTierOf(profile.ageBand), feature, config.flags);
}

/** A default display name for an anonymous account (people change it later; never a real name). */
export function anonymousName(seed: number): string {
  const n = Math.abs(Math.floor(seed)) % 9000;
  return `Learner ${1000 + n}`;
}

/** A random nonce for Sign in with Apple (the server accepts it raw or hashed). */
export function makeNonce(random: () => number = Math.random): string {
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  const bytes = new Uint8Array(24);
  if (g?.getRandomValues) g.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
