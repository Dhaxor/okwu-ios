// Home dialect (optional). Okwu teaches Standard Igbo (Igbo Izugbe); a
// learner may add the area their family is from, and its regional forms
// are then accepted as answers, with "also said as" notes. Areas are listed
// alphabetically, as the Nkọwa okwu registry names them. None is ranked.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Chip, Screen, ScreenHeader, T } from "@/components/ui";
import { space } from "@/constants/theme";
import type { DialectId } from "@/lib/content/types";
import { dialectOptions, toggleDialect, useDialectLabels, useProfile } from "@/lib/state";

export default function DialectScreen() {
  const router = useRouter();
  const { profile, set } = useProfile();
  const labels = useDialectLabels();
  const options = dialectOptions(labels);
  const chosen = new Set<string>(profile.dialects);
  const go = () => router.push("/onboarding/lesson");

  return (
    <Screen
      testID="dialect"
      footer={
        <>
          <Button label={chosen.size > 0 ? "Continue" : "Continue with Standard Igbo"} onPress={go} testID="dialect-continue" block />
          {chosen.size > 0 ? <Button label="Clear my choices" variant="ghost" onPress={() => set((p) => ({ ...p, dialects: [] }))} testID="dialect-clear" block /> : null}
        </>
      }
    >
      <ScreenHeader
        eyebrow="Optional"
        title="Where is your family from?"
        subtitle="You'll learn Standard Igbo. Choose your family's area and we'll accept the way it's said there too."
        onBack={() => router.back()}
        testID="dialect-header"
      />
      {options.length === 0 ? (
        <T variant="caption">Loading the list of areas…</T>
      ) : (
        <View style={styles.chips} testID="dialect-list">
          {options.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              igbo
              selected={chosen.has(o.id)}
              onPress={() => set((p) => toggleDialect(p, o.id as DialectId, !chosen.has(o.id)))}
              testID={`dialect-${o.id}`}
            />
          ))}
        </View>
      )}
      <T variant="caption">
        Area names and regional forms from{" "}
        <T variant="caption" igbo>
          Nkọwa okwu
        </T>{" "}
        (Igbo API), CC BY 4.0. You can change this any time in Me.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
