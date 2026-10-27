// The uli line as a divider or a header flourish: one unbroken ink stroke
// that wanders, ends in spirals, with a few curls and camwood dots.
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { artInk } from "@/constants/theme";
import { meander } from "./geometry";
import { useWidth } from "./useWidth";

export interface UliDividerProps {
  seed?: number;
  height?: number;
  /** Ink strength 0..1 (default 0.9). */
  opacity?: number;
  /** On an ink surface: draw in chalk. */
  onInk?: boolean;
  testID?: string;
}

export function UliDivider({ seed = 1, height = 40, opacity = 0.9, onInk = false, testID }: UliDividerProps) {
  const [w, onLayout] = useWidth();
  const m = useMemo(() => (w > 0 ? meander(w, height, seed) : null), [w, height, seed]);
  const line = onInk ? artInk.chalk : artInk.line;
  return (
    <View testID={testID} onLayout={onLayout} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {m ? (
        <Svg width={w} height={height}>
          <G opacity={opacity} fill="none" stroke={line} strokeLinecap="round" strokeLinejoin="round">
            <Path d={m.line} strokeWidth={1.6} />
            {m.ends.map((d, i) => (
              <Path key={`e${i}`} d={d} strokeWidth={1.6} />
            ))}
            {m.curls.map((d, i) => (
              <Path key={`c${i}`} d={d} strokeWidth={1.2} />
            ))}
          </G>
          {m.dots.map((p, i) => (
            <Circle key={`d${i}`} cx={p.x} cy={p.y} r={p.r} fill={i % 2 === 0 ? artInk.red : line} opacity={opacity} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
