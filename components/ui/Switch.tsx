// On/off switch, drawn the same on every platform: leaf green when on, a
// lifted paper thumb. It is a "switch" to screen readers and needs a label.
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors, motion, radius, shadow, size } from "@/constants/theme";
import { Press } from "./Press";
import { calm, useMotion } from "./motion";

export interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  testID: string;
  disabled?: boolean;
}

const INSET = 2;
const THUMB = size.switchH - INSET * 2;
const TRAVEL = size.switchW - THUMB - INSET * 2;

export function Switch({ value, onValueChange, accessibilityLabel, testID, disabled }: SwitchProps) {
  const policy = useMotion();
  const p = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    p.value = policy.moves ? withTiming(value ? 1 : 0, { duration: motion.state, easing: calm }) : value ? 1 : 0;
  }, [value, policy.moves, p]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.surfaceDeep, colors.success]),
  }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * TRAVEL }] }));

  return (
    <Press
      testID={testID}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      haptics="select"
      pressScale={1}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.hit, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.thumb, thumb]} />
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  hit: { justifyContent: "center" },
  track: { width: size.switchW, height: size.switchH, borderRadius: radius.pill, padding: INSET },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: shadow.lift },
  disabled: { opacity: 0.4 },
});
