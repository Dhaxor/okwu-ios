// Daily reminders on the device, wired to expo-notifications. The logic is
// in ./notifications (pure, tested); this file only adapts the device API
// and re-plans at the right moments:
//   - when the app opens and returns to the foreground,
//   - after practice (the game state changed: today no longer needs a nudge),
//   - when the reminder time, the switch or the age band changes.
// Permission is never asked here: Settings and the onboarding reminder step
// ask at the moment the learner turns reminders on (`useReminderPermission`).
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useGame } from "./AppState";
import { useProfile } from "./ProfileProvider";
import { cancelAllReminders, requestReminderPermission, syncReminders, type NotificationsApi, type PermissionStatus } from "./notifications";
import { reminderPrefs } from "./profile";

const unsupported: NotificationsApi = {
  permission: async () => "unsupported",
  requestPermission: async () => "unsupported",
  scheduledIds: async () => [],
  schedule: async () => {},
  cancel: async () => {},
};

type NotificationsModule = typeof import("expo-notifications");

/** expo-notifications, loaded on iOS and Android only (on web it warns at import and schedules nothing). */
function native(): NotificationsModule | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

const statusOf = (N: NotificationsModule, p: Awaited<ReturnType<NotificationsModule["getPermissionsAsync"]>>): PermissionStatus => {
  if (p.granted || p.ios?.status === N.IosAuthorizationStatus.PROVISIONAL) return "granted";
  return p.status === "denied" ? "denied" : "undetermined";
};

function deviceApi(): NotificationsApi {
  const N = native();
  if (!N) return unsupported;
  return {
    permission: async () => statusOf(N, await N.getPermissionsAsync()),
    requestPermission: async () => statusOf(N, await N.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })),
    scheduledIds: async () => (await N.getAllScheduledNotificationsAsync()).map((n) => n.identifier),
    schedule: async (n) => {
      await N.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.body, sound: true },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: n.at },
      });
    },
    cancel: (id) => N.cancelScheduledNotificationAsync(id),
  };
}

/** The device API (iOS, Android). Web has no scheduled local notifications. */
export const deviceNotifications: NotificationsApi = deviceApi();

let handlerSet = false;
/** A reminder that arrives while Okwu is open stays in the list, without a banner over the lesson. */
function ensureHandler() {
  const N = native();
  if (handlerSet || !N) return;
  handlerSet = true;
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Mount once inside the providers (app/(tabs)/_layout). */
export function useReminderSync(): void {
  const game = useGame();
  const { ready, profile } = useProfile();
  const stateRef = useRef(game.state);
  stateRef.current = game.state;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { enabled, hour, minute } = profile.reminder;
  const ageBand = profile.ageBand;
  const engine = game.engine;

  const plan = useCallback(() => {
    if (!engine || !ready) return;
    if (timer.current) clearTimeout(timer.current);
    // Coalesce bursts (a lesson's answers each change the game state).
    timer.current = setTimeout(() => {
      const prefs = reminderPrefs({ reminder: { enabled, hour, minute }, ageBand }, 7);
      const now = new Date();
      void syncReminders(deviceNotifications, prefs.enabled ? engine.notifications(stateRef.current, now, prefs) : [], now, prefs.enabled);
    }, 800);
  }, [engine, ready, enabled, hour, minute, ageBand]);

  useEffect(() => {
    ensureHandler();
  }, []);
  useEffect(() => {
    plan();
  }, [plan, game.state]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") plan();
    });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [plan]);
}

export interface ReminderPermission {
  status: PermissionStatus | null;
  /** Ask (once; a denial is respected). Call it when the learner turns reminders on. */
  request: () => Promise<PermissionStatus>;
  refresh: () => void;
}

export function useReminderPermission(): ReminderPermission {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const refresh = useCallback(() => {
    deviceNotifications
      .permission()
      .then(setStatus)
      .catch(() => setStatus("denied"));
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  const request = useCallback(async () => {
    const s = await requestReminderPermission(deviceNotifications);
    setStatus(s);
    return s;
  }, []);
  return { status, request, refresh };
}

/** Cancel every Okwu reminder on this device (account deletion, sign-out). */
export function cancelReminders(): Promise<number> {
  return cancelAllReminders(deviceNotifications);
}
