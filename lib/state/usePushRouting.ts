// Tapping a notification opens the screen it is about. Mounted once in the
// root layout (app/_layout.tsx).
//   cold start  the response that launched the app (getLastNotificationResponse)
//   warm        every later tap (addNotificationResponseReceivedListener)
// The link is checked by ./pushLinks (an allow-list of in-app routes);
// anything else is ignored. A tap that arrives before the learner has
// finished onboarding (or before the profile is read) waits, and opens once
// the app can show it. Web has no notifications, so this does nothing there.
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter, type Href } from "expo-router";
import { routeForResponse, type PushRoute, type ResponseLike } from "./pushLinks";

type NotificationsModule = typeof import("expo-notifications");

function native(): NotificationsModule | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

/** `ready`: the navigator is mounted and may open the app's screens (profile read, onboarding done). */
export function usePushRouting(ready: boolean): void {
  const router = useRouter();
  const pending = useRef<PushRoute | null>(null);
  const seen = useRef(new Set<string>());
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const open = useRef(() => {
    const route = pending.current;
    if (!route || !readyRef.current) return;
    pending.current = null;
    // After the frame that mounted the navigator, so a cold-start tap never races it.
    setTimeout(() => {
      try {
        if (route.mode === "tab") router.navigate(route.href as Href);
        else router.push(route.href as Href);
      } catch {
        /* a screen that can't open now: the app stays where it is */
      }
    }, 0);
  });

  useEffect(() => {
    const N = native();
    if (!N) return;
    const take = (response: ResponseLike | null) => {
      const route = routeForResponse(response, seen.current, N.DEFAULT_ACTION_IDENTIFIER);
      if (!route) return;
      pending.current = route;
      open.current();
    };
    try {
      take(N.getLastNotificationResponse() as ResponseLike | null);
      N.clearLastNotificationResponse();
    } catch {
      /* no launch response on this platform */
    }
    const sub = N.addNotificationResponseReceivedListener((r) => take(r as ResponseLike));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ready) open.current();
  }, [ready]);
}
