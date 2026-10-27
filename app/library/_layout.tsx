// The Culture and heritage library (engineer E2): the hub, the names book,
// proverbs, folktales, festivals and customs, and the market-day calendar.
// Every page slides in as a stack over the tabs.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function LibraryLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }} />;
}
