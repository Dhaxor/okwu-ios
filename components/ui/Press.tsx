// The one pressable surface. A short spring down to .97 with a light haptic
// (an opacity dip under Reduce Motion), so every tap in Okwu feels the same.
// `testID` is required: every interactive element is addressable by e2e.
import React from "react";
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "@/constants/theme";
import { haptic, type HapticKind } from "./haptics";
import { pressSpring, useMotion } from "./motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressProps extends Omit<PressableProps, "style" | "children" | "testID"> {
  testID: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Scale while held. Default .97; pass 1 for rows that should only dim. */
  pressScale?: number;
  /** Haptic on press-in. Default "tap". */
  haptics?: HapticKind;
}

export function Press({
  style,
  children,
  pressScale = motion.press.scale,
  haptics = "tap",
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressProps) {
  const policy = useMotion();
  const pressed = useSharedValue(0);
  const dims = policy.reduced || pressScale === 1;

  const animated = useAnimatedStyle(() =>
    dims ? { opacity: 1 - pressed.value * 0.28 } : { transform: [{ scale: 1 - pressed.value * (1 - pressScale) }] }
  );

  const handleIn = (e: GestureResponderEvent) => {
    pressed.value = dims ? withTiming(1, { duration: motion.tap }) : withSpring(1, pressSpring);
    if (!disabled) haptic(haptics);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    pressed.value = dims ? withTiming(0, { duration: motion.tap }) : withSpring(0, pressSpring);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
