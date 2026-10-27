// The phrasebook: its home (search and situations), a situation's phrases,
// favourites, and a phrase page, sliding in as a stack over the tabs.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function PhrasebookLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.bg } }} />;
}
