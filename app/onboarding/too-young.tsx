// Under 13: Okwu can't hold an account or keep progress for you yet. Said
// kindly, with nothing kept beyond the answer itself (COPPA; CONTRACTS §4).
import React from "react";
import { StyleSheet, View } from "react-native";
import { Nnenne, UliDivider, UliField } from "@/components/art";
import { Screen, T } from "@/components/ui";
import { space } from "@/constants/theme";

export default function TooYoung() {
  return (
    <Screen testID="too-young" center backdrop={<UliField seed={9} cell={72} opacity={0.08} />}>
      <View style={styles.center}>
        <Nnenne size={160} ground="ochre" mood="glad" />
        <T variant="display" center accessibilityRole="header">
          We'll be so glad to welcome you later.
        </T>
        <T variant="body" tone="muted" center>
          Okwu is for people aged 13 and over, so we can't keep your progress yet. Nothing about you has been saved.
        </T>
        <View style={styles.divider}>
          <UliDivider seed={4} height={32} />
        </View>
        <T variant="body" tone="secondary" center>
          Ask a parent or a grandparent to teach you a word today. Igbo is best learned together.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md, paddingHorizontal: space.xs },
  divider: { width: "70%" },
});
