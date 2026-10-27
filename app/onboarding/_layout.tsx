// First run: welcome → why Igbo → do you understand some → (listening
// check) → home dialect → the first lesson → account → reminder. An
// under-13 answer removes every other screen, so the refusal cannot be
// swiped away.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";
import { useProfile } from "@/lib/state";

export default function OnboardingLayout() {
  const { profile } = useProfile();
  const refused = profile.ageBand === "under-13";
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
      <Stack.Protected guard={!refused}>
        <Stack.Screen name="index" />
        <Stack.Screen name="motive" />
        <Stack.Screen name="familiarity" />
        <Stack.Screen name="placement" options={{ gestureEnabled: false }} />
        <Stack.Screen name="dialect" />
        <Stack.Screen name="lesson" options={{ gestureEnabled: false, animation: "slide_from_bottom" }} />
        <Stack.Screen name="account" />
        <Stack.Screen name="reminder" />
      </Stack.Protected>
      <Stack.Protected guard={refused}>
        <Stack.Screen name="too-young" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}
