// Chips: tappable choices (selection over typing), filters and tags.
// Selected chips fill with ink; a `tone` chip without onPress is a static tag.
import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, size, space } from "@/constants/theme";
import type { IconComponent } from "@/components/glyphs/icons";
import { Press } from "./Press";
import { T, type TTone } from "./T";

export type ChipTone = "neutral" | "accent" | "success" | "reward";

export interface ChipProps {
  label: string;
  testID: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: IconComponent;
  /** Static tag colour (only for chips without onPress). */
  tone?: ChipTone;
  igbo?: boolean;
  disabled?: boolean;
}

const TAG: Record<ChipTone, { bg: string; fg: TTone; icon: string }> = {
  neutral: { bg: colors.ink06, fg: "secondary", icon: colors.ink80 },
  accent: { bg: colors.accent12, fg: "accent", icon: colors.accent },
  success: { bg: colors.success12, fg: "success", icon: colors.success },
  reward: { bg: colors.reward12, fg: "reward", icon: colors.rewardText },
};

export function Chip({ label, testID, onPress, selected = false, icon: Icon, tone = "neutral", igbo, disabled }: ChipProps) {
  if (!onPress) {
    const t = TAG[tone];
    return (
      <View testID={testID} style={[styles.base, styles.tag, { backgroundColor: t.bg }]}>
        {Icon ? <Icon size={size.iconSm - 4} color={t.icon} strokeWidth={2.25} /> : null}
        <T variant="caption" strong tone={t.fg} igbo={igbo}>
          {label}
        </T>
      </View>
    );
  }
  const fg = selected ? colors.onInk : colors.ink;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptics="select"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      hitSlop={4}
      style={[styles.base, styles.choice, selected ? styles.selected : styles.idle, disabled && styles.disabled]}
    >
      {Icon ? <Icon size={size.iconSm} color={fg} strokeWidth={2} /> : null}
      <T variant="body" tone={selected ? "onInk" : "primary"} igbo={igbo} numberOfLines={1}>
        {label}
      </T>
    </Press>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: radius.pill, gap: space.xs },
  tag: { paddingHorizontal: space.sm, paddingVertical: space.xxs },
  choice: { height: size.chip, paddingHorizontal: space.md, borderWidth: 1 },
  idle: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  disabled: { opacity: 0.4 },
});
