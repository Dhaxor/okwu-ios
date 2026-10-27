// Why Igbo? Selection over typing; any that fit. It shapes the copy of the
// first lessons and the reminders, never what the learner may do.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { HeartHandshake, Languages, Sparkles, Users, BookOpen } from "@/components/glyphs/icons";
import { ChoiceCard } from "@/components/feature/onboarding/ChoiceCard";
import { Button, Screen, ScreenHeader } from "@/components/ui";
import { space } from "@/constants/theme";
import { useProfile, type Motive } from "@/lib/state";
import type { IconComponent } from "@/components/glyphs/icons";

const OPTIONS: { value: Motive; label: string; detail: string; icon: IconComponent }[] = [
  { value: "family", label: "Talk with my family", detail: "Parents, grandparents, aunties and uncles", icon: HeartHandshake },
  { value: "roots", label: "Reconnect with my roots", detail: "The language of home, wherever home is", icon: Sparkles },
  { value: "partner", label: "My partner's family", detail: "Weddings, visits, being welcomed", icon: Users },
  { value: "school", label: "School or work", detail: "Exams, research or a job", icon: BookOpen },
  { value: "curious", label: "Just curious", detail: "A beautiful tonal language", icon: Languages },
];

export default function MotiveScreen() {
  const router = useRouter();
  const { profile, update } = useProfile();
  const chosen = new Set(profile.motives);
  const toggle = (m: Motive) => {
    const next = new Set(chosen);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    update({ motives: [...next] });
  };
  return (
    <Screen testID="motive" footer={<Button label="Continue" onPress={() => router.push("/onboarding/familiarity")} disabled={chosen.size === 0} testID="motive-continue" block />}>
      <ScreenHeader eyebrow="Why Igbo?" title="What brings you here?" subtitle="Choose any that fit." onBack={() => router.back()} testID="motive-header" />
      <View style={styles.list}>
        {OPTIONS.map((o) => (
          <ChoiceCard key={o.value} title={o.label} detail={o.detail} icon={o.icon} selected={chosen.has(o.value)} onPress={() => toggle(o.value)} multi testID={`motive-${o.value}`} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
