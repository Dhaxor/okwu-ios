// <T> is the only way to set text in Okwu. A variant picks the family and
// size from the scale; weight comes from real font files (`strong`), so
// fontWeight / fontStyle / fontFamily are stripped from any style passed in.
//
// <T igbo> sets Igbo: NFC-normalised, in the Igbo-safe face (Gentium Book
// Plus) at every size, with the taller Igbo line height so stacked marks
// never clip, no letter-spacing (tracking can split a letter from its tone
// mark on iOS) and no case transform. Screen readers get lang "ig".
import React from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";
import {
  colors,
  fonts,
  igboLineHeight,
  labelTracking,
  typeScale,
  variantFamily,
  type TypeVariant,
} from "@/constants/theme";
import { nfc } from "@/lib/igbo/text";

export type TTone =
  | "primary"
  | "secondary"
  | "muted"
  | "faint"
  | "accent"
  | "success"
  | "reward"
  | "danger"
  | "onInk"
  | "onInkMuted";

const TONES: Record<TTone, string> = {
  primary: colors.ink,
  secondary: colors.ink80,
  muted: colors.ink68,
  faint: colors.ink48,
  accent: colors.accent,
  success: colors.success,
  reward: colors.rewardText,
  danger: colors.danger,
  onInk: colors.onInk,
  onInkMuted: colors.onInk68,
};

/** Headings at full ink, body at 80%, small print at 68%. */
const DEFAULT_TONE: Record<TypeVariant, TTone> = {
  display: "primary",
  title: "primary",
  body: "secondary",
  caption: "muted",
  label: "muted",
};

/** Dynamic Type ceilings: big type grows less so layouts survive the largest sizes. */
const MAX_SCALE: Record<TypeVariant, number> = {
  display: 1.25,
  title: 1.4,
  body: 1.8,
  caption: 1.8,
  label: 1.5,
};

export interface TProps extends TextProps {
  variant?: TypeVariant;
  tone?: TTone;
  /** The bold file of the variant's family. */
  strong?: boolean;
  /** Igbo text: NFC, Igbo-safe face, taller lines, no tracking or case transform. */
  igbo?: boolean;
  center?: boolean;
  /** Tabular figures for counts and timers. */
  numeric?: boolean;
  children?: React.ReactNode;
}

/** The family a piece of text renders in. */
export function familyFor(variant: TypeVariant, strong: boolean, igbo: boolean): string {
  if (igbo) return strong || variant === "label" ? fonts.igboBold : fonts.igbo;
  const fam = variantFamily[variant];
  return strong ? fam.bold : fam.regular;
}

/** NFC every string in a children tree; elements pass through untouched. */
export function normalizeChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return nfc(children);
  if (Array.isArray(children)) return children.map((c) => normalizeChildren(c));
  return children;
}

const STRIP_ALWAYS: (keyof TextStyle)[] = ["fontWeight", "fontStyle", "fontFamily"];
const STRIP_IGBO: (keyof TextStyle)[] = ["letterSpacing", "textTransform"];

function sanitize(style: TextProps["style"], igbo: boolean): TextStyle | undefined {
  if (!style) return undefined;
  const flat: TextStyle = { ...StyleSheet.flatten(style) };
  for (const k of STRIP_ALWAYS) delete flat[k];
  if (igbo) for (const k of STRIP_IGBO) delete flat[k];
  return flat;
}

export function T({
  variant = "body",
  tone,
  strong = false,
  igbo = false,
  center = false,
  numeric = false,
  style,
  children,
  ...rest
}: TProps) {
  const scale = typeScale[variant];
  const isLabel = variant === "label" && !igbo;
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      accessibilityLanguage={igbo ? "ig" : undefined}
      {...rest}
      style={[
        { fontSize: scale.fontSize, lineHeight: igbo ? igboLineHeight[variant] : scale.lineHeight },
        { fontFamily: familyFor(variant, strong, igbo), color: TONES[tone ?? DEFAULT_TONE[variant]] },
        isLabel && styles.label,
        numeric && styles.numeric,
        center && styles.center,
        sanitize(style, igbo),
      ]}
    >
      {igbo ? normalizeChildren(children) : children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { textTransform: "uppercase", letterSpacing: labelTracking },
  numeric: { fontVariant: ["tabular-nums"] },
  center: { textAlign: "center" },
});
