// The social session: one client for the app, credentials in SecureStore,
// the live config (flags, document versions) cached for offline use, and
// the account. Offline-safe: nothing here throws; every call resolves to
// an Attempt, and an offline device simply has no account yet.
//
//   const social = useSocial();
//   social.gate                 "too-young" | "no-age" | "needs-terms" | "open"
//   social.can("family-circle") tier table AND accepted terms (Apple 1.2)
//   social.acceptTerms()        records the acceptance (device, then server)
//   await social.ensureAccount()   anonymous account (age + consents); needs the gate open
//   await social.signInWithApple() optional; iOS only (social.appleAvailable)
//   social.account, social.status, social.config, social.client
//   await social.signOut()      forget the account on this phone (learning stays)
//   await social.deleteAccount() the server deletion (Apple token revoked there)
//   social.acceptVoiceNotes()   the person's own voice-note consent
//   social.rev / social.bump()  a counter that moves whenever social data changed
//   (and, running underneath: this week's progress counts and the push token
//   reach the server, ./useCommunitySync)
//   social.mock                 development only: the stand-in server (./mockSocial)
//
// Development builds with EXPO_PUBLIC_OKWU_API unset talk to the in-memory
// mock (./mockSocial), seeded for the learner's age tier, so every screen
// can be checked on web. Release builds always use the real client.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { CREDS_KEY, SocialError, attempt, createSocialClient, errorMessage, type AgeTier, type Attempt, type AvatarId, type ConsentRecord, type Creds, type CredsStore, type MyAccountView, type OkwuSocialClient, type SocialConfig, type SocialFeature } from "@/lib/social";
import { devAudioAsset } from "@/lib/content";
import type { ContentBundle } from "@/lib/content/types";
import { useContent } from "./AppState";
import { createMockSocialClient, isMockClient, type MockControls } from "./mockSocial";
import { useProfile } from "./ProfileProvider";
import { ageTierOf, withConsents, type AgeBand } from "./profile";
import { DEFAULT_SOCIAL_CONFIG, SOCIAL_CONFIG_KEY, acceptAll, ageSignalFor, anonymousName, makeNonce, mayUse, missingConsents, parseSocialConfig, socialGate, type SocialGate } from "./social";
import { cachedPushToken, forgetCachedPushToken, useCommunitySync } from "./useCommunitySync";

/** Credentials: SecureStore (after first unlock) on iOS; AsyncStorage on web previews. */
export const secureCredsStore: CredsStore = {
  async load() {
    try {
      const raw = Platform.OS === "web" ? await AsyncStorage.getItem(CREDS_KEY) : await SecureStore.getItemAsync(CREDS_KEY, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
      if (!raw) return null;
      const v = JSON.parse(raw) as Partial<Creds>;
      return typeof v.id === "string" && typeof v.token === "string" ? (v as Creds) : null;
    } catch {
      return null;
    }
  },
  async save(creds) {
    try {
      if (Platform.OS === "web") {
        if (creds) await AsyncStorage.setItem(CREDS_KEY, JSON.stringify(creds));
        else await AsyncStorage.removeItem(CREDS_KEY);
        return;
      }
      if (creds) await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify(creds), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
      else await SecureStore.deleteItemAsync(CREDS_KEY);
    } catch {
      /* keychain unavailable: the account is re-created next time */
    }
  },
};

export type SocialStatus = "idle" | "working" | "ready" | "offline" | "error";

export interface SocialState {
  client: OkwuSocialClient;
  config: SocialConfig;
  gate: SocialGate;
  status: SocialStatus;
  /** Plain-English text for the last failure, for a toast. */
  lastError: string | null;
  account: MyAccountView | null;
  hasCreds: boolean;
  appleAvailable: boolean;
  can: (feature: SocialFeature) => boolean;
  acceptTerms: () => void;
  ensureAccount: () => Promise<Attempt<MyAccountView>>;
  /** Pass the age band when it was chosen in the same moment (the profile may not have caught up yet). */
  signInWithApple: (ageBand?: AgeBand | null) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  refresh: () => Promise<void>;
  /** Forget the account on this phone. Lessons and progress stay; a fresh anonymous account follows. */
  signOut: () => Promise<void>;
  /** Delete the account on the server (and its Apple link). The screen then wipes this phone. */
  deleteAccount: () => Promise<{ ok: boolean; message?: string }>;
  /** Record the person's own voice-note consent (device, then server). */
  acceptVoiceNotes: () => Promise<Attempt<void>>;
  /** Moves whenever social data may have changed: screens refetch on it. */
  rev: number;
  bump: () => void;
  /** Development only: the stand-in server and its controls (null with a real server). */
  mock: MockControls | null;
  /** Development only: switch the learner between the adult and teen experience. */
  setDevTier: ((tier: AgeTier) => void) | null;
}

/** True in a development build with no server configured: the mock stands in. */
export const SOCIAL_MOCK = typeof __DEV__ !== "undefined" && __DEV__ && !process.env.EXPO_PUBLIC_OKWU_API;

/** A playable development clip for a mock voice note (a bundled dataset recording). */
function devClipFor(bundle: ContentBundle | null, key: string): string | null {
  if (!bundle) return null;
  const ids: string[] = [];
  for (const item of Object.values(bundle.items)) for (const a of item.audio) if (devAudioAsset(a.id) !== null) ids.push(a.id);
  if (!ids.length) return null;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const mod = devAudioAsset(ids[h % ids.length]!);
  try {
    return mod === null ? null : Asset.fromModule(mod).uri;
  } catch {
    return null;
  }
}

const Ctx = createContext<SocialState | null>(null);

export function SocialProvider({ children }: { children?: React.ReactNode }) {
  const { profile, set: setProfile, update } = useProfile();
  const { bundle } = useContent();
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const client = useMemo<OkwuSocialClient>(
    () =>
      SOCIAL_MOCK
        ? createMockSocialClient({ creds: secureCredsStore, tier: ageTierOf(profile.ageBand) ?? "teen", audioUri: async (key) => devClipFor(bundleRef.current, key) })
        : createSocialClient({ creds: secureCredsStore }),
    // One client for the app's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const mock = isMockClient(client) ? client.mock : null;
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => setRev((n) => n + 1), []);
  const [config, setConfig] = useState<SocialConfig>(DEFAULT_SOCIAL_CONFIG);
  const [account, setAccount] = useState<MyAccountView | null>(null);
  const [hasCreds, setHasCreds] = useState(false);
  const [status, setStatus] = useState<SocialStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const busy = useRef(false);

  const gate = socialGate(profile, config);

  const fail = useCallback((e: SocialError) => {
    setStatus(e.kind === "api" ? "error" : "offline");
    setLastError(errorMessage(e));
  }, []);

  /** Push consents the device holds that the server still needs. */
  const syncConsents = useCallback(
    async (acct: MyAccountView) => {
      const local = profileRef.current.consents;
      for (const kind of acct.needsConsent) {
        const rec = local.find((c) => c.kind === kind);
        if (rec) await attempt(client.recordConsent(rec));
      }
    },
    [client]
  );

  const refresh = useCallback(async () => {
    const cfg = await attempt(client.config());
    if (cfg.ok) {
      const parsed = parseSocialConfig(cfg.value);
      setConfig(parsed);
      AsyncStorage.setItem(SOCIAL_CONFIG_KEY, JSON.stringify(parsed)).catch(() => {});
    }
    const creds = await secureCredsStore.load();
    setHasCreds(!!creds);
    if (!creds) {
      setStatus(cfg.ok ? "idle" : "offline");
      return;
    }
    const me = await attempt(client.me());
    if (!me.ok) return fail(me.error);
    setAccount(me.value);
    setStatus("ready");
    setLastError(null);
    await syncConsents(me.value);
  }, [client, fail, syncConsents]);

  useEffect(() => {
    AsyncStorage.getItem(SOCIAL_CONFIG_KEY)
      .then((raw) => raw && setConfig(parseSocialConfig(raw)))
      .catch(() => {});
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
    void refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const acceptTerms = useCallback(() => {
    const missing = missingConsents(profileRef.current.consents, config);
    if (missing.length === 0) return;
    const add = acceptAll(config, new Date()).filter((c) => (missing as string[]).includes(c.kind));
    setProfile((p) => withConsents(p, add));
    // An existing account hears about it now; a new one gets them when it is created.
    if (hasCreds) for (const c of add) void attempt(client.recordConsent(c));
  }, [config, hasCreds, client, setProfile]);

  const ensureAccount = useCallback(async (): Promise<Attempt<MyAccountView>> => {
    const p = profileRef.current;
    if (socialGate(p, config) !== "open") return { ok: false, error: new SocialError("api", 403, { error: p.ageBand ? "consent-required" : "forbidden-age" }) };
    const age = ageSignalFor(p.ageBand, new Date());
    if (!age) return { ok: false, error: new SocialError("api", 403, { error: "forbidden-age" }) };
    if (busy.current) return { ok: false, error: new SocialError("api", 429, { error: "slow-down" }) };
    busy.current = true;
    setStatus("working");
    try {
      const r = await attempt(
        client.ensureAccount({ displayName: anonymousName(Date.now()), avatar: "default" as AvatarId, age, consents: p.consents.filter((c) => c.kind !== "guardian") })
      );
      if (!r.ok) {
        fail(r.error);
        return r;
      }
      setAccount(r.value);
      setHasCreds(true);
      setStatus("ready");
      setLastError(null);
      await syncConsents(r.value);
      return r;
    } finally {
      busy.current = false;
    }
  }, [client, config, fail, syncConsents]);

  const signInWithApple = useCallback(async (ageBand?: AgeBand | null) => {
    if (!appleAvailable) return { ok: false, message: "Sign in with Apple works in the iPhone app." };
    const nonce = makeNonce();
    let identityToken: string | null = null;
    let code: string | undefined;
    try {
      // No name or email requested: Okwu never needs them.
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce });
      identityToken = cred.identityToken;
      code = cred.authorizationCode ?? undefined;
    } catch (e) {
      const cancelled = (e as { code?: string })?.code === "ERR_REQUEST_CANCELED";
      return { ok: false, cancelled, ...(cancelled ? {} : { message: "Apple sign-in didn't finish. Please try again." }) };
    }
    if (!identityToken) return { ok: false, message: "Apple sign-in didn't finish. Please try again." };
    setStatus("working");
    const r = await attempt(client.signInWithApple(identityToken, nonce, code));
    if (!r.ok) {
      fail(r.error);
      return { ok: false, message: errorMessage(r.error) };
    }
    let acct = r.value.account;
    const age = ageSignalFor(ageBand ?? profileRef.current.ageBand, new Date());
    if (!acct.age && age) {
      const s = await attempt(client.setAge({ tier: age.tier, source: age.source }));
      if (s.ok) acct = s.value;
    }
    setAccount(acct);
    setHasCreds(true);
    setStatus("ready");
    update({ account: "apple" });
    await syncConsents(acct);
    return { ok: true };
  }, [appleAvailable, client, fail, syncConsents, update]);

  // The mock follows the learner's age tier, and every change in it reaches the screens.
  useEffect(() => {
    if (mock) mock.setTier(ageTierOf(profile.ageBand) ?? "teen");
  }, [mock, profile.ageBand]);
  useEffect(() => (mock ? mock.subscribe(bump) : undefined), [mock, bump]);

  const signOut = useCallback(async () => {
    // The server ends this session and forgets this phone's push token.
    await attempt(client.signOut((await cachedPushToken()) ?? undefined));
    await forgetCachedPushToken();
    await secureCredsStore.save(null);
    setAccount(null);
    setHasCreds(false);
    setLastError(null);
    setStatus("idle");
    update({ account: "anonymous" });
    bump();
  }, [client, update, bump]);

  const deleteAccount = useCallback(async () => {
    const creds = await secureCredsStore.load();
    if (creds) {
      const r = await attempt(client.deleteAccount());
      if (!r.ok) return { ok: false, message: r.error.kind === "api" ? errorMessage(r.error) : "Couldn't reach Okwu, so nothing was deleted. Please try again when you're online." };
    }
    await forgetCachedPushToken();
    await secureCredsStore.save(null);
    setAccount(null);
    setHasCreds(false);
    setLastError(null);
    setStatus("idle");
    bump();
    return { ok: true };
  }, [client, bump]);

  const acceptVoiceNotes = useCallback(async (): Promise<Attempt<void>> => {
    const rec: ConsentRecord = { kind: "voice-notes", version: config.versions["voice-notes"], acceptedAt: new Date().toISOString() };
    setProfile((p) => withConsents(p, [rec]));
    const r = await attempt(client.recordConsent(rec));
    bump();
    return r;
  }, [client, config, setProfile, bump]);

  const setDevTier = useMemo(
    () =>
      mock
        ? (tier: AgeTier) => {
            update({ ageBand: tier === "adult" ? "18+" : "13-17" });
            mock.setTier(tier);
          }
        : null,
    [mock, update]
  );

  // Once the learner is old enough and has accepted the terms, make the (anonymous) account in the background.
  useEffect(() => {
    if (gate === "open" && !hasCreds && status !== "working" && status !== "offline" && status !== "error") void ensureAccount();
  }, [gate, hasCreds, status, ensureAccount]);

  const can = useCallback((feature: SocialFeature) => mayUse(profile, config, feature), [profile, config]);

  // Progress counts for the cohort quest, friend streaks and the family challenge; the push token once notifications are on.
  useCommunitySync({ client, ready: gate === "open" && hasCreds && !!account, account: account?.id ?? null, notificationsOn: profile.reminder.enabled });

  const value = useMemo<SocialState>(
    () => ({ client, config, gate, status, lastError, account, hasCreds, appleAvailable, can, acceptTerms, ensureAccount, signInWithApple, refresh, signOut, deleteAccount, acceptVoiceNotes, rev, bump, mock, setDevTier }),
    [client, config, gate, status, lastError, account, hasCreds, appleAvailable, can, acceptTerms, ensureAccount, signInWithApple, refresh, signOut, deleteAccount, acceptVoiceNotes, rev, bump, mock, setDevTier]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocial(): SocialState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSocial needs <SocialProvider> (lib/state/SocialProvider)");
  return ctx;
}

/** The social age tier of the learner (null: not given; treated as a teen everywhere). */
export function useAgeTier() {
  return ageTierOf(useProfile().profile.ageBand);
}
