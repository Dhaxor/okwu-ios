// Design-system pages, development builds only. In a release build the
// route group is not registered (app/_layout.tsx guards it with __DEV__),
// and this redirect covers a stale deep link.
import React from "react";
import { Redirect, Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function DevLayout() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
