import React, { useEffect } from "react";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Andika_400Regular } from "@expo-google-fonts/andika/400Regular";
import { Andika_700Bold } from "@expo-google-fonts/andika/700Bold";
import { GentiumBookPlus_400Regular } from "@expo-google-fonts/gentium-book-plus/400Regular";
import { GentiumBookPlus_700Bold } from "@expo-google-fonts/gentium-book-plus/700Bold";
import { UIProvider } from "@/components/ui";
import { AppStateProvider, PlusProvider, ProfileProvider, SocialProvider, useProfile } from "@/lib/state";
import { usePushRouting } from "@/lib/state/usePushRouting";
import { colors, fonts } from "@/constants/theme";

// Hold the splash until the type is real and the profile is read: a flash of
// a fallback face would drop Igbo marks, and a flash of the wrong route is
// worse than a beat of paper.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Keys are the family names constants/theme `fonts` uses. */
const FONT_FILES = {
  [fonts.ui]: Andika_400Regular,
  [fonts.uiBold]: Andika_700Bold,
  [fonts.display]: GentiumBookPlus_400Regular,
  [fonts.displayBold]: GentiumBookPlus_700Bold,
};

const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.ink,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.hairline,
    notification: colors.accent,
  },
};

function RootNavigator() {
  const { ready, profile } = useProfile();
  const onboarded = !!profile.onboardedAt;
  // Tapping a notification opens its screen (allow-listed links only), once the app can show it.
  usePushRouting(ready && onboarded);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <ThemeProvider value={NAV_THEME}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "fade" }}>
        {/* Every screen past onboarding is listed here. An unlisted route stays open before
            onboarding, and a fresh install's "/" falls back to the shortest open route name
            (/tools in a release build, /dev in development), so the guard names its redirect. */}
        <Stack.Protected guard={onboarded} redirectTo="/onboarding">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lesson/[id]" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
          <Stack.Screen name="community" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="paywall" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="practice" />
          <Stack.Screen name="library" />
          <Stack.Screen name="phrasebook" />
          <Stack.Screen name="conversations" />
          <Stack.Screen name="tools" />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts(FONT_FILES);
  if (!loaded && !error) return null;
  return (
    <ProfileProvider>
      <AppStateProvider>
        <SocialProvider>
          <PlusProvider>
            <UIProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </UIProvider>
          </PlusProvider>
        </SocialProvider>
      </AppStateProvider>
    </ProfileProvider>
  );
}
