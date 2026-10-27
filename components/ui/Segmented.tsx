// Segmented control: 2–4 mutually exclusive options on one line. The lifted
// paper thumb glides to the chosen option. Each option is a button with its
// own testID (`${testID}-${value}`).
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors, motion, radius, shadow, size, space } from "@/constants/theme";
import { Press } from "./Press";
import { T } from "./T";
import { calm, useMotion } from "./motion";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedProps<V extends string> {
  options: readonly SegmentedOption<V>[];
  /** The chosen value, or null before the user has chosen. */
  value: V | null;
  onChange: (value: V) => void;
  testID: string;
  accessibilityLabel: string;
}

const PAD = space.xxs;

export function Segmented<V extends string>({ options, value, onChange, testID, accessibilityLabel }: SegmentedProps<V>) {
  const policy = useMotion();
  const [width, setWidth] = useState(0);
  // -1 when nothing is chosen yet (no thumb): a question must not pre-answer itself.
  const index = options.findIndex((o) => o.value === value);
  const segW = options.length ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(Math.max(0, index) * segW);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (index < 0) return;
    const to = index * segW;
    // The first placement jumps; later changes glide.
    x.value = policy.moves && placed ? withTiming(to, { duration: motion.state, easing: calm }) : to;
    if (segW > 0) setPlaced(true);
  }, [index, segW, policy.moves, x, placed]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.track}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && index >= 0 ? <Animated.View style={[styles.thumb, { width: segW }, thumb]} /> : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Press
            key={o.value}
            testID={`${testID}-${o.value}`}
            onPress={() => onChange(o.value)}
            haptics="select"
            pressScale={1}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, checked: selected }}
            style={styles.segment}
          >
            <T variant="caption" strong={selected} tone={selected ? "primary" : "muted"} numberOfLines={1}>
              {o.label}
            </T>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: size.buttonSm + PAD * 2,
    padding: PAD,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunk,
  },
  thumb: {
    position: "absolute",
    top: PAD,
    left: PAD,
    bottom: PAD,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    boxShadow: shadow.lift,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xs },
});
