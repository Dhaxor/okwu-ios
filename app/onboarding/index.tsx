// Welcome. Nnenne, the promise, and one action: start. The first lesson
// comes before any account; nothing is asked that the lesson doesn't need.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Nnenne, OkwuMark, UliDivider, UliField } from "@/components/art";
import { Button, Screen, T } from "@/components/ui";
import { space } from "@/constants/theme";

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen
      testID="welcome"
      scroll={false}
      backdrop={<UliField seed={5} cell={64} opacity={0.1} />}
      contentStyle={styles.content}
      footer={<Button label="Start your first lesson" onPress={() => router.push("/onboarding/motive")} testID="welcome-start" block />}
    >
      <View style={styles.center}>
        <Nnenne size={176} ground="ochre" testID="welcome-nnenne" />
        <View style={styles.brand}>
          <OkwuMark size={28} />
          <T variant="title" strong>
            Okwu
          </T>
        </View>
        <T variant="display" center accessibilityRole="header">
          Speak Igbo with your family.
        </T>
        <T variant="body" tone="muted" center>
          Real voices, real tones, real conversations. Nnenne will guide you, one small step at a time.
        </T>
        <View style={styles.divider}>
          <UliDivider seed={3} height={36} />
        </View>
        <T variant="caption" center>
          Your first lesson takes about five minutes. No account needed.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center" },
  center: { alignItems: "center", gap: space.md, paddingHorizontal: space.xs },
  brand: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xs },
  divider: { width: "80%", marginTop: space.xs },
});
