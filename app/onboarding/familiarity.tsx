// "Do you understand some Igbo?" Heritage learners often understand far
// more than they can say; they take a short listening check next. New
// learners go straight on to the sounds.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChoiceCard } from "@/components/feature/onboarding/ChoiceCard";
import { Ear, MessageCircle, Sparkles } from "@/components/glyphs/icons";
import { Button, Screen, ScreenHeader, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { placeLearner } from "@/lib/learning";
import { useContent, usePlay, useProfile, type Familiarity } from "@/lib/state";

const OPTIONS: { value: Familiarity; title: string; detail: string; icon: typeof Ear }[] = [
  { value: "new", title: "I'm new to Igbo", detail: "Start with the sounds and the first words.", icon: Sparkles },
  { value: "some", title: "I understand a little", detail: "Greetings and words from home.", icon: Ear },
  { value: "lots", title: "I understand a lot, but speaking is hard", detail: "You follow conversations; the words don't come out.", icon: MessageCircle },
];

export default function FamiliarityScreen() {
  const router = useRouter();
  const { profile, update } = useProfile();
  const { bundle } = useContent();
  const play = usePlay();
  const chosen = profile.familiarity;

  const go = () => {
    if (!chosen) return;
    if (chosen !== "new") {
      router.push("/onboarding/placement");
      return;
    }
    if (bundle) {
      const p = placeLearner({ bundle, understandsSome: false });
      play.place(p);
      update({ track: p.track, placement: { takenAt: new Date().toISOString(), correct: 0, total: 0, reason: p.reason } });
    }
    router.push("/onboarding/dialect");
  };

  return (
    <Screen testID="familiarity" footer={<Button label="Continue" onPress={go} disabled={!chosen} testID="familiarity-continue" block />}>
      <ScreenHeader eyebrow="Your Igbo" title="Do you understand some Igbo?" subtitle="There's no wrong answer. It decides where you start." onBack={() => router.back()} testID="familiarity-header" />
      <View style={styles.list}>
        {OPTIONS.map((o) => (
          <ChoiceCard
            key={o.value}
            title={o.title}
            detail={o.detail}
            icon={o.icon}
            selected={chosen === o.value}
            onPress={() => update({ familiarity: o.value, heritage: o.value !== "new" })}
            testID={`familiarity-${o.value}`}
          />
        ))}
      </View>
      {chosen && chosen !== "new" ? (
        <T variant="caption" testID="familiarity-next-note">
          Next, a short listening check: a few everyday phrases, about a minute. It only decides where you start.
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
