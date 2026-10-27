// Practice sessions and the dictionary, over the tabs: daily review, the tone
// trainer and "Say it" rise from the bottom like a lesson; the dictionary
// pages slide in as a stack.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function PracticeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="review" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
      <Stack.Screen name="tones" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
      <Stack.Screen name="speak" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
      <Stack.Screen name="dictionary/index" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="dictionary/[id]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
