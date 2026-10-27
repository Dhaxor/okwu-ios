import React from "react";
import { useRouter } from "expo-router";
import { UliDivider } from "@/components/art";
import { Button, Screen, ScreenHeader } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen testID="not-found" footer={<Button label="Go home" onPress={() => router.replace("/")} testID="not-found-home" block />}>
      <ScreenHeader title="This page wandered off." subtitle="Let's take you back to your lessons." testID="not-found-header" />
      <UliDivider seed={21} />
    </Screen>
  );
}
