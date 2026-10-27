// Paper cards.
//   raised  lighter paper with a warm shadow: the default container
//   flat    lighter paper with a hairline, no shadow: dense lists
//   sunk    a pressed-in well: secondary info, empty states
//   ink     deep indigo: the one featured card on a screen
// A card with onPress is one button: it needs a testID and a label.
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, shadow, space } from "@/constants/theme";
import { Press } from "./Press";

export type CardVariant = "raised" | "flat" | "sunk" | "ink";

interface CardBase {
  variant?: CardVariant;
  /** Inner padding from the space scale. Default lg (24). */
  padding?: keyof typeof space | "none";
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export type CardProps = CardBase &
  (
    | { onPress?: undefined; testID?: string; accessibilityLabel?: string }
    | { onPress: () => void; testID: string; accessibilityLabel: string }
  );

export function Card({ variant = "raised", padding = "lg", style, children, ...rest }: CardProps) {
  const pad = padding === "none" ? 0 : space[padding];
  const look = [styles.base, styles[variant], { padding: pad }, style];
  if (rest.onPress) {
    return (
      <Press testID={rest.testID} onPress={rest.onPress} accessibilityLabel={rest.accessibilityLabel} pressScale={0.98} style={look}>
        {children}
      </Press>
    );
  }
  return (
    <View testID={rest.testID} style={look}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.xl, overflow: "hidden" },
  raised: { backgroundColor: colors.surface, boxShadow: shadow.card },
  flat: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  sunk: { backgroundColor: colors.surfaceSunk },
  ink: { backgroundColor: colors.ink, boxShadow: shadow.inkButton },
});
