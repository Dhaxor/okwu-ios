// Settings and its pages: home dialect, safety, appeals, credits and
// deleting the account.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }} />;
}
