// A large single-choice card for onboarding questions (selection over
// typing): a title, a line of detail, and a ring that fills when chosen.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Check, type IconComponent } from "@/components/glyphs/icons";
import { Press, T } from "@/components/ui";
import { colors, radius, shadow, size, space } from "@/constants/theme";

export interface ChoiceCardProps {
  title: string;
  detail?: string;
  icon?: IconComponent;
  selected: boolean;
  onPress: () => void;
  /** Several may be chosen: a square checkbox instead of a radio ring. */
  multi?: boolean;
  testID: string;
}

export function ChoiceCard({ title, detail, icon: Icon, selected, onPress, multi = false, testID }: ChoiceCardProps) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      haptics="select"
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      accessibilityState={{ selected, checked: selected }}
      pressScale={0.98}
      style={[styles.card, selected ? styles.on : styles.off]}
    >
      {Icon ? (
        <View style={[styles.well, selected && styles.wellOn]}>
          <Icon size={size.icon} color={selected ? colors.onInk : colors.accent} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.text}>
        <T variant="body" strong tone="primary">
          {title}
        </T>
        {detail ? <T variant="caption">{detail}</T> : null}
      </View>
      <View style={[styles.ring, multi && styles.box, selected && styles.ringOn]}>{selected ? <Check size={size.iconSm - 4} color={colors.onInk} strokeWidth={3} /> : null}</View>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  off: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong, boxShadow: shadow.card },
  on: { backgroundColor: colors.accent06, borderColor: colors.ink, borderWidth: 2, padding: space.md - 1 },
  well: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accent12, alignItems: "center", justifyContent: "center" },
  wellOn: { backgroundColor: colors.accent },
  text: { flex: 1, gap: space.xxs },
  ring: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: "center", justifyContent: "center" },
  box: { borderRadius: radius.sm - 2 },
  ringOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
