// Real-life conversations: the list and a conversation's page slide in as a
// stack; a practice run rises from the bottom like a lesson.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function ConversationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="[id]/play" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
    </Stack>
  );
}
