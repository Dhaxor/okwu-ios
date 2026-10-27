// A quiet scatter of uli marks (dots, rings, crescents, small spirals) for
// hero backgrounds. Low ink, lots of air; absolutely fills its parent.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { artInk } from "@/constants/theme";
import { uliField } from "./geometry";

export interface UliFieldProps {
  seed?: number;
  /** Mark density: cell size in pt (smaller = denser). Default 64. */
  cell?: number;
  /** Overall ink (default 0.14). */
  opacity?: number;
  onInk?: boolean;
}

export function UliField({ seed = 1, cell = 64, opacity = 0.14, onInk = false }: UliFieldProps) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const marks = useMemo(() => (box.w > 0 ? uliField(box.w, box.h, seed, cell) : []), [box, seed, cell]);
  const ink = onInk ? artInk.chalk : artInk.line;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {box.w > 0 ? (
        <Svg width={box.w} height={box.h}>
          <G opacity={opacity} stroke={ink} strokeWidth={1.4} strokeLinecap="round" fill="none">
            {marks.map((m, i) => {
              if (m.kind === "dot") return <Circle key={i} cx={m.x} cy={m.y} r={m.r} fill={m.accent ? artInk.red : ink} stroke="none" />;
              if (m.kind === "ring") return <Circle key={i} cx={m.x} cy={m.y} r={m.r} />;
              return <Path key={i} d={m.d} />;
            })}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
