// The last step: a daily reminder time (or none), then the Learn tab. At
// most one gentle note a day, never written to make anyone feel guilty;
// the game layer plans the copy (lib/game notifications).
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { ChoiceCard } from "@/components/feature/onboarding/ChoiceCard";
import { Bell, CalendarDays, Sparkles } from "@/components/glyphs/icons";
import { Button, Screen, ScreenHeader, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { useProfile, useReminderPermission, type Reminder } from "@/lib/state";

const TIMES: { id: string; title: string; detail: string; reminder: Reminder; icon: typeof Bell }[] = [
  { id: "morning", title: "Morning", detail: "8:00, with breakfast", reminder: { enabled: true, hour: 8, minute: 0 }, icon: Sparkles },
  { id: "midday", title: "Midday", detail: "12:30, a lunchtime lesson", reminder: { enabled: true, hour: 12, minute: 30 }, icon: CalendarDays },
  { id: "evening", title: "Evening", detail: "19:00, winding down", reminder: { enabled: true, hour: 19, minute: 0 }, icon: Bell },
];

export default function ReminderScreen() {
  const router = useRouter();
  const { profile, update } = useProfile();
  const r = profile.reminder;
  const chosen = r.enabled ? TIMES.find((t) => t.reminder.hour === r.hour && t.reminder.minute === r.minute)?.id ?? null : null;

  const permission = useReminderPermission();

  const finish = async (reminder: Reminder) => {
    // The contextual moment: they just chose a reminder time, so iOS asks now (never on launch).
    if (reminder.enabled) await permission.request();
    update({ reminder, onboardedAt: new Date().toISOString() });
    router.replace("/");
  };

  return (
    <Screen
      testID="reminder"
      footer={
        <>
          <Button label="Start learning" onPress={() => void finish(chosen ? profile.reminder : { ...profile.reminder, enabled: false })} testID="reminder-start" block />
          <Button label="No reminders" variant="ghost" onPress={() => void finish({ ...profile.reminder, enabled: false })} testID="reminder-none" block />
        </>
      }
    >
      <ScreenHeader eyebrow="Last step" title="When should Nnenne remind you?" subtitle="At most one gentle note a day. Never on a day you've already practised." onBack={() => router.back()} testID="reminder-header" />
      <View style={styles.list}>
        {TIMES.map((t) => (
          <ChoiceCard key={t.id} title={t.title} detail={t.detail} icon={t.icon} selected={chosen === t.id} onPress={() => update({ reminder: t.reminder })} testID={`reminder-${t.id}`} />
        ))}
      </View>
      <View style={styles.nnenne}>
        <Nnenne size={56} ground="ochre" mood="glad" />
        <T variant="caption" style={styles.flex}>
          You can change the time, or turn reminders off, any time in Me.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  nnenne: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
});
