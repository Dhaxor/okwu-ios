// Progress: a calm bar that fills with camwood (or another earth tone).
// With `steps` it becomes a row of short beads, one per exercise in a lesson.
//
// The fill is a percentage of the track (./progress.ts), never a measured
// width: a bar that replaces the beads mid-session gets no fresh layout
// event on iOS, and a fill sized from width 0 never drew. Each shape also
// mounts as its own view (keyed), so nothing carries over between them.
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors, motion, radius, size, space } from "@/constants/theme";
import { calm, useMotion } from "./motion";
import { progressShape } from "./progress";

export type ProgressTone = "accent" | "success" | "reward" | "ink";

const FILL: Record<ProgressTone, string> = {
  accent: colors.accent,
  success: colors.success,
  reward: colors.reward,
  ink: colors.ink,
};

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  accessibilityLabel: string;
  tone?: ProgressTone;
  /** Draw as `steps` beads instead of one bar. */
  steps?: number;
  /** On an ink card. */
  onInk?: boolean;
  testID?: string;
}

export function ProgressBar({ value, accessibilityLabel, tone = "accent", steps, onInk = false, testID }: ProgressBarProps) {
  const shape = progressShape(value, steps);
  const trackColor = onInk ? colors.onInk12 : colors.surfaceSunk;
  const a11y = {
    accessibilityRole: "progressbar" as const,
    accessibilityLabel,
    accessibilityValue: { min: 0, max: 100, now: Math.round((shape.kind === "bar" ? shape.fraction : shape.done / shape.steps) * 100) },
  };

  if (shape.kind === "beads") {
    return (
      <View key="beads" testID={testID} {...a11y} style={styles.beads}>
        {Array.from({ length: shape.steps }, (_, i) => (
          <View key={i} style={[styles.bead, { backgroundColor: i < shape.done ? FILL[tone] : trackColor }]} />
        ))}
      </View>
    );
  }
  return <Bar key="bar" fraction={shape.fraction} color={FILL[tone]} trackColor={trackColor} a11y={a11y} testID={testID} />;
}

function Bar({ fraction, color, trackColor, a11y, testID }: { fraction: number; color: string; trackColor: string; a11y: object; testID?: string }) {
  const policy = useMotion();
  const fill = useSharedValue(policy.moves ? 0 : fraction);

  useEffect(() => {
    fill.value = policy.moves ? withTiming(fraction, { duration: motion.enter, easing: calm }) : fraction;
  }, [fraction, policy.moves, fill]);

  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, fill.value)) * 100}%` }));

  return (
    <View testID={testID} {...a11y} style={[styles.track, { backgroundColor: trackColor }]}>
      <Animated.View testID={testID ? `${testID}-fill` : undefined} style={[styles.fill, { backgroundColor: color }, bar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: size.progress, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  beads: { flexDirection: "row", gap: space.xxs },
  bead: { flex: 1, height: size.progress, borderRadius: radius.pill },
});
