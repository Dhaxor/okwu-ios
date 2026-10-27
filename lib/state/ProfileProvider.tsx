// The profile provider: reads okwu.profile.v2 (migrating the shell's v1),
// holds it in React state, and saves every change crash-safely.
//   const { ready, profile, update, set, reset } = useProfile();
//   update({ audioSpeed: "slow" })           // merge fields
//   set((p) => toggleDialect(p, id, true))   // functional change
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { EMPTY_PROFILE, PROFILE_KEY, PROFILE_KEY_V1, migrateV1, parseProfile, serializeProfile, type LocalProfile } from "./profile";
import { createStore } from "./store";
import { deviceKV } from "./kv";

export interface ProfileState {
  ready: boolean;
  profile: LocalProfile;
  update: (patch: Partial<Omit<LocalProfile, "version">>) => void;
  set: (fn: (prev: LocalProfile) => LocalProfile) => void;
  /** Forget the profile on this device (shows onboarding again). */
  reset: () => Promise<void>;
}

const Ctx = createContext<ProfileState | null>(null);

export const profileStore = createStore<LocalProfile>({
  key: PROFILE_KEY,
  kv: deviceKV,
  parse: parseProfile,
  serialize: serializeProfile,
  legacy: [{ key: PROFILE_KEY_V1, migrate: migrateV1 }],
});

export function ProfileProvider({ children }: { children?: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<LocalProfile>(EMPTY_PROFILE);
  const ref = useRef(profile);

  useEffect(() => {
    let live = true;
    profileStore
      .load()
      .then((p) => {
        if (!live) return;
        ref.current = p;
        setProfile(p);
      })
      .finally(() => live && setReady(true));
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") void profileStore.flush();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  const set = useCallback((fn: (prev: LocalProfile) => LocalProfile) => {
    const next = { ...fn(ref.current), version: 2 as const };
    ref.current = next;
    setProfile(next);
    profileStore.save(next);
  }, []);

  const update = useCallback((patch: Partial<Omit<LocalProfile, "version">>) => set((p) => ({ ...p, ...patch })), [set]);

  const reset = useCallback(async () => {
    ref.current = EMPTY_PROFILE;
    setProfile(EMPTY_PROFILE);
    await profileStore.clear();
    await deviceKV.removeItem(PROFILE_KEY_V1);
  }, []);

  const value = useMemo(() => ({ ready, profile, update, set, reset }), [ready, profile, update, set, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile needs <ProfileProvider>");
  return ctx;
}
