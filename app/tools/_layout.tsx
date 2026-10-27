// Learner tools, opened from the Me tab: flashcards, offline packs and the
// weekly progress report. Pages slide in as a stack; a study session rises
// from the bottom like a lesson.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function ToolsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
      <Stack.Screen name="flashcards/study" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
    </Stack>
  );
}
