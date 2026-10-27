// Small marks for the collections and reward moments, in the uli line.
//   IluMark     a spoken spiral with a drop of palm oil: proverbs are the
//               oil words are eaten with
//   AhaSeal     a ring of dots around a woven lozenge: a name as a seal
//   AkukoMark   an open book with a curl rising from it: a told story
//   MbeFolktale the tortoise of the folktales, his shell mended in patches.
//               Only ever on a folktale's own card, never as a mascot.
//   RewardBloom a ring of uli dots and curls that opens around a moment
//               (no rays, never a sun)
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, G, Path, Polygon } from "react-native-svg";
import { artInk, motion } from "@/constants/theme";
import { calm, useMotion } from "@/components/ui/motion";
import { spiralPath } from "../geometry";
import { curl, ellipse } from "./shapes";

interface MarkProps {
  size?: number;
  onInk?: boolean;
}

function Hidden({ children, size }: { children: React.ReactNode; size: number }) {
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
    </View>
  );
}

const SPOKEN = spiralPath(34, 42, 18, 2.2, -Math.PI / 2, 1);

export function IluMark({ size = 56, onInk = false }: MarkProps) {
  const ink = onInk ? artInk.chalk : artInk.line;
  return (
    <Hidden size={size}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Path d={SPOKEN} fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M58 18 C58 18 50 30 50 36 A8 8 0 0 0 66 36 C66 30 58 18 58 18 Z" fill={artInk.red} stroke={onInk ? artInk.chalk : artInk.line} strokeWidth={1.4} />
        <Path d="M55 34 Q55 30 57 27" fill="none" stroke={artInk.ochreLight} strokeWidth={1.6} strokeLinecap="round" />
        <Circle cx={22} cy={66} r={2.4} fill={artInk.ochre} />
        <Circle cx={30} cy={70} r={1.6} fill={ink} opacity={0.5} />
      </Svg>
    </Hidden>
  );
}

export function AhaSeal({ size = 56, onInk = false }: MarkProps) {
  const ink = onInk ? artInk.chalk : artInk.line;
  const ring = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
    return { x: 40 + Math.cos(a) * 32, y: 40 + Math.sin(a) * 32, big: i % 5 === 0 };
  });
  return (
    <Hidden size={size}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Circle cx={40} cy={40} r={25} fill={onInk ? artInk.line : artInk.ochreLight} stroke={ink} strokeWidth={1.6} />
        <Polygon points="40,22 56,40 40,58 24,40" fill={artInk.red} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
        <Polygon points="40,31 47,40 40,49 33,40" fill={artInk.ochreLight} />
        <Polygon points="40,37 43,40 40,43 37,40" fill={artInk.red} />
        {ring.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={d.big ? 2.4 : 1.4} fill={d.big ? artInk.ochre : ink} opacity={d.big ? 1 : 0.45} />
        ))}
      </Svg>
    </Hidden>
  );
}

export function AkukoMark({ size = 56, onInk = false }: MarkProps) {
  const ink = onInk ? artInk.chalk : artInk.line;
  return (
    <Hidden size={size}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Path d="M40 62 C32 57 20 56 10 58 L10 30 C20 28 32 29 40 34 Z" fill={onInk ? artInk.line : artInk.chalk} stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M40 62 C48 57 60 56 70 58 L70 30 C60 28 48 29 40 34 Z" fill={onInk ? artInk.line : artInk.chalk} stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M16 38 C22 36 28 37 34 39 M16 45 C22 43 28 44 34 46 M46 39 C52 37 58 36 64 38 M46 46 C52 44 58 43 64 45" fill="none" stroke={ink} strokeWidth={1.1} opacity={0.5} strokeLinecap="round" />
        <Path d={curl({ x: 40, y: 28 }, 7, 1.5, 1, 90)} fill="none" stroke={artInk.red} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={52} cy={14} r={2.2} fill={artInk.ochre} />
        <Circle cx={60} cy={20} r={1.4} fill={ink} opacity={0.5} />
      </Svg>
    </Hidden>
  );
}

export function MbeFolktale({ size = 72, onInk = false }: MarkProps) {
  const ink = onInk ? artInk.chalk : artInk.line;
  return (
    <Hidden size={size}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Path d="M12 56 C12 36 26 26 40 26 C54 26 66 36 66 56 Z" fill={artInk.ochreLight} stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
        {/* The shell, mended in patches (the folktale's cracked shell). */}
        <Path d="M40 27 L40 56 M24 32 L31 44 L22 56 M56 32 L49 44 L58 56 M31 44 L49 44 M14 47 L22 48 M66 47 L58 48" fill="none" stroke={ink} strokeWidth={1.3} strokeLinejoin="round" />
        <Path d="M40 35 L45 44 L40 52 L35 44 Z" fill={artInk.red} opacity={0.9} />
        <Path d="M66 51 C72 49 76 44 74 40 C72 37 66 39 64 44" fill={artInk.ochreLight} stroke={ink} strokeWidth={1.6} />
        <Circle cx={71} cy={42.5} r={1.2} fill={ink} />
        <Path d="M18 56 L16 63 L22 63 L24 56 M54 56 L54 63 L60 63 L59 56" fill={artInk.ochreLight} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M12 52 C8 52 6 54 6 56" fill="none" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M4 66 L76 66" stroke={ink} strokeWidth={1} opacity={0.3} strokeLinecap="round" />
      </Svg>
    </Hidden>
  );
}

export interface RewardBloomProps {
  size?: number;
  children?: React.ReactNode;
  /** Play the bloom on mount (still mode and Reduce Motion show the end state, faded in). */
  play?: boolean;
}

/** A ring of uli dots and curls that opens around the moment's centrepiece. */
export function RewardBloom({ size = 200, children, play = true }: RewardBloomProps) {
  const policy = useMotion();
  const open = useSharedValue(play && !policy.still ? 0 : 1);
  useEffect(() => {
    if (!play || policy.still) {
      open.value = 1;
      return;
    }
    open.value = 0;
    open.value = withDelay(120, withTiming(1, { duration: motion.celebrate * 1.4, easing: calm }));
  }, [play, policy.still, open]);
  const ring = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: policy.moves ? [{ scale: 0.82 + 0.18 * open.value }] : [],
  }));
  const dots = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    return { x: 100 + Math.cos(a) * 78, y: 100 + Math.sin(a) * 78, big: i % 4 === 0 };
  });
  const curls = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
    const at = { x: 100 + Math.cos(a) * 92, y: 100 + Math.sin(a) * 92 };
    return curl(at, 4.5, 1.2, i % 2 === 0 ? 1 : -1, (a * 180) / Math.PI);
  });
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, ring]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Path d={ellipse(100, 100, 64, 64)} fill={artInk.ochreLight} opacity={0.45} />
          <G fill="none" stroke={artInk.line} strokeWidth={1.5} strokeLinecap="round" opacity={0.42}>
            {curls.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </G>
          {dots.map((d, i) => (
            <Circle key={i} cx={d.x} cy={d.y} r={d.big ? 4 : 2.2} fill={d.big ? artInk.red : artInk.ochre} />
          ))}
        </Svg>
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
});

/** An achievement's seal: a ring of dots around a woven lozenge; quiet and dashed until it is earned. */
export function AchievementSeal({ size = 44, earned = true }: { size?: number; earned?: boolean }) {
  const ring = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: 22 + Math.cos(a) * 18, y: 22 + Math.sin(a) * 18, big: i % 3 === 0 };
  });
  return (
    <Hidden size={size}>
      <Svg width={size} height={size} viewBox="0 0 44 44">
        {earned ? (
          <>
            <Circle cx={22} cy={22} r={13} fill={artInk.ochreLight} stroke={artInk.line} strokeWidth={1.2} />
            <Polygon points="22,13 30,22 22,31 14,22" fill={artInk.red} />
            <Polygon points="22,18 26,22 22,26 18,22" fill={artInk.ochreLight} />
            {ring.map((d, i) => (
              <Circle key={i} cx={d.x} cy={d.y} r={d.big ? 1.8 : 1.1} fill={d.big ? artInk.ochre : artInk.line} opacity={d.big ? 1 : 0.5} />
            ))}
          </>
        ) : (
          <>
            <Circle cx={22} cy={22} r={13} fill={artInk.paperSunk} stroke={artInk.line} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
            <Polygon points="22,15 29,22 22,29 15,22" fill="none" stroke={artInk.line} strokeWidth={1} opacity={0.3} />
          </>
        )}
      </Svg>
    </Hidden>
  );
}
