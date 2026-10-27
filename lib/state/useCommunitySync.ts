// Runs ./communitySync on the phone. Mounted once, by SocialProvider:
//   - posts this week's progress counts (counts only) when they change, at
//     most once a minute, and when the app comes back to the foreground;
//   - registers the Expo push token for community notifications once the
//     learner has turned notifications on, and unregisters it when they turn
//     them off. It never asks for permission: Settings and onboarding ask at
//     the moment the learner turns reminders on (./reminders).
// Push tokens need a native build with an EAS project id (app.json
// extra.eas.projectId, set by `eas init`); without one, nothing is sent.
import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { deviceCalendar } from "@/lib/game";
import { attempt, type OkwuSocialClient } from "@/lib/social";
import { useLearning } from "./AppState";
import { PROGRESS_MIN_GAP_MS, PUSH_CACHE_KEY, deviceLang, parsePushCache, progressKey, pushAction, shouldPostProgress, weekTotals, type PushCache } from "./communitySync";

type NotificationsModule = typeof import("expo-notifications");

/** expo-notifications on iOS and Android only (web has no Expo push tokens). */
function native(): NotificationsModule | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

function easProjectId(): string | null {
  const c = Constants as unknown as { easConfig?: { projectId?: string } | null; expoConfig?: { extra?: { eas?: { projectId?: string } } } | null };
  return c.easConfig?.projectId ?? c.expoConfig?.extra?.eas?.projectId ?? null;
}

function locale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

/** Whether notifications are allowed (never asks), and this phone's Expo push token when they are. */
async function devicePush(): Promise<{ granted: boolean; token: string | null }> {
  const N = native();
  if (!N) return { granted: false, token: null };
  try {
    const p = await N.getPermissionsAsync();
    const granted = p.granted || p.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
    if (!granted) return { granted: false, token: null };
    const projectId = easProjectId();
    if (!projectId) return { granted: true, token: null };
    return { granted: true, token: (await N.getExpoPushTokenAsync({ projectId })).data };
  } catch {
    return { granted: false, token: null };
  }
}

/** The push token the server last heard about for this phone (sign-out tells the server to forget it). */
export async function cachedPushToken(): Promise<string | null> {
  try {
    return parsePushCache(await AsyncStorage.getItem(PUSH_CACHE_KEY))?.token ?? null;
  } catch {
    return null;
  }
}

export async function forgetCachedPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PUSH_CACHE_KEY);
  } catch {
    /* nothing kept */
  }
}

export interface CommunitySyncOptions {
  client: OkwuSocialClient;
  /** The social gate is open and there is an account. */
  ready: boolean;
  account: string | null;
  /** The learner turned notifications on (the daily-reminder switch). */
  notificationsOn: boolean;
}

export function useCommunitySync({ client, ready, account, notificationsOn }: CommunitySyncOptions): void {
  const { ready: loaded, progress, reviewLog } = useLearning();
  const data = useRef({ progress, reviewLog });
  data.current = { progress, reviewLog };
  const lastKey = useRef<string | null>(null);
  const lastAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- progress counts ----
  const postProgress = useCallback(() => {
    if (!ready || !loaded) return;
    if (timer.current) clearTimeout(timer.current);
    // Coalesce a lesson's burst of answers, and keep at least a minute between posts.
    const wait = Math.max(3_000, lastAt.current + PROGRESS_MIN_GAP_MS - Date.now());
    timer.current = setTimeout(() => {
      timer.current = null;
      const now = new Date();
      const totals = weekTotals(data.current.progress, data.current.reviewLog, now, deviceCalendar.dayKey(now));
      if (!shouldPostProgress(totals, now, lastKey.current)) return;
      lastAt.current = Date.now();
      void attempt(client.recordProgress(totals)).then((r) => {
        if (r.ok) lastKey.current = progressKey(totals, now);
      });
    }, wait);
  }, [ready, loaded, client]);

  useEffect(() => {
    postProgress();
  }, [postProgress, progress, reviewLog]);

  // ---- the push token ----
  const busy = useRef(false);
  const syncPush = useCallback(async () => {
    if (!ready || !account || busy.current) return;
    busy.current = true;
    try {
      const cached = parsePushCache(await AsyncStorage.getItem(PUSH_CACHE_KEY).catch(() => null));
      const device = notificationsOn ? await devicePush() : { granted: false, token: null };
      const action = pushAction({ wanted: notificationsOn && device.granted, token: device.token, account, cached, now: Date.now() });
      if (action.kind === "register") {
        const r = await attempt(client.registerPush(action.token, deviceLang(locale())));
        const entry: PushCache = { token: action.token, account, at: Date.now() };
        if (r.ok) await AsyncStorage.setItem(PUSH_CACHE_KEY, JSON.stringify(entry));
      } else if (action.kind === "unregister") {
        const r = await attempt(client.unregisterPush(action.token));
        // Offline: try again next time. The server said no: nothing more to do.
        if (r.ok || r.error.kind === "api") await forgetCachedPushToken();
      }
    } catch {
      /* next time */
    } finally {
      busy.current = false;
    }
  }, [ready, account, notificationsOn, client]);

  useEffect(() => {
    void syncPush();
  }, [syncPush]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      postProgress();
      void syncPush();
    });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [postProgress, syncPush]);
}
