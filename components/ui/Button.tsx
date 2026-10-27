// Buttons. One primary (ink) CTA per screen, placed in the thumb zone.
//   primary    filled ink, the "ink seal": the screen's one main action
//   secondary  ink at 6% with a hairline: alternatives
//   ghost      text only: low-stakes actions (Skip, Not now)
//   danger     filled oxblood: destructive confirms only
// IconButton has no visible text, so its accessibilityLabel is required.
import React from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, shadow, size, space } from "@/constants/theme";
import type { IconComponent } from "@/components/glyphs/icons";
import { Press } from "./Press";
import { T, type TTone } from "./T";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  testID: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  iconPosition?: "leading" | "trailing";
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  /** The label is Igbo (NFC, Igbo-safe face). */
  igbo?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { lg: size.buttonLg, md: size.buttonMd, sm: size.buttonSm };
const PAD: Record<ButtonSize, number> = { lg: space.lg, md: space.md, sm: space.sm };

const FG: Record<ButtonVariant, { tone: TTone; color: string }> = {
  primary: { tone: "onInk", color: colors.onInk },
  secondary: { tone: "primary", color: colors.ink },
  ghost: { tone: "primary", color: colors.ink },
  danger: { tone: "onInk", color: colors.onInk },
};

export function Button({
  label,
  onPress,
  testID,
  variant = "primary",
  size: s = "lg",
  icon: Icon,
  iconPosition = "leading",
  loading = false,
  disabled = false,
  block = false,
  igbo = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const fg = FG[variant];
  const inert = disabled || loading;
  const iconEl = Icon ? <Icon size={s === "sm" ? size.iconSm : size.icon} color={fg.color} strokeWidth={2} /> : null;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={inert}
      haptics={variant === "primary" || variant === "danger" ? "tap" : "select"}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading, disabled: inert }}
      hitSlop={s === "sm" ? 4 : undefined}
      style={[
        styles.base,
        { height: HEIGHT[s], paddingHorizontal: PAD[s] },
        styles[variant],
        block && styles.block,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg.color} />
      ) : (
        <View style={styles.row}>
          {iconPosition === "leading" ? iconEl : null}
          <T variant={s === "sm" ? "caption" : "body"} strong igbo={igbo} tone={fg.tone} numberOfLines={1}>
            {label}
          </T>
          {iconPosition === "trailing" ? iconEl : null}
        </View>
      )}
    </Press>
  );
}

export type IconButtonVariant = "plain" | "tinted" | "ink";

export interface IconButtonProps {
  icon: IconComponent;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  onPress: () => void;
  testID: string;
  variant?: IconButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon: Icon, accessibilityLabel, onPress, testID, variant = "plain", disabled, style }: IconButtonProps) {
  const color = variant === "ink" ? colors.onInk : colors.ink;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptics="select"
      accessibilityLabel={accessibilityLabel}
      style={[styles.icon, styles[`icon_${variant}`], disabled && styles.disabled, style]}
    >
      <Icon size={size.icon} color={color} strokeWidth={2} />
    </Press>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
  block: { alignSelf: "stretch" },
  primary: { backgroundColor: colors.ink, boxShadow: shadow.inkButton },
  secondary: { backgroundColor: colors.ink06, borderWidth: 1, borderColor: colors.hairline },
  ghost: { backgroundColor: colors.transparent },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.4 },
  icon: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  icon_plain: { backgroundColor: colors.transparent },
  icon_tinted: { backgroundColor: colors.ink06, borderWidth: 1, borderColor: colors.hairline },
  icon_ink: { backgroundColor: colors.ink, boxShadow: shadow.inkButton },
});
