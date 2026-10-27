// Tactile feedback, one vocabulary for the whole app. No-ops on web.
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type HapticKind = "tap" | "select" | "success" | "warning" | "none";

export function haptic(kind: HapticKind): void {
  if (Platform.OS === "web" || kind === "none") return;
  const run = async () => {
    switch (kind) {
      case "tap":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case "select":
        return Haptics.selectionAsync();
      case "success":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case "warning":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  run().catch(() => {});
}
