// Community screens above the tabs: a Family Circle, starting or joining
// one, friends, browsing clubs, and the club chat.
import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function CommunityLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }} />;
}
