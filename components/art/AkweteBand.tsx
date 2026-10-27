// An akwete-inspired woven band: edge stripes, nested lozenges and zigzag
// teeth in camwood, ochre and chalk on indigo. Use as a card's top edge, a
// lesson header, or a progress "loom". Fills its container's width.
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Polygon, Rect } from "react-native-svg";
import { artInk } from "@/constants/theme";
import { akweteBand, type BandShape } from "./geometry";
import { useWidth } from "./useWidth";

export interface AkweteBandProps {
  height?: number;
  variant?: "lozenge" | "teeth";
  /** Draw on indigo (default) or on paper. */
  ground?: "ink" | "paper";
  testID?: string;
}

export function AkweteBand({ height = 32, variant = "lozenge", ground = "ink", testID }: AkweteBandProps) {
  const [w, onLayout] = useWidth();
  const shapes = useMemo(() => (w > 0 ? akweteBand(w, height, variant) : []), [w, height, variant]);
  const fill = (f: BandShape["fill"]) =>
    f === "line" ? (ground === "ink" ? artInk.chalk : artInk.line) : f === "red" ? artInk.red : f === "ochre" ? artInk.ochre : f === "paperSunk" ? artInk.paperSunk : artInk.chalk;
  return (
    <View testID={testID} onLayout={onLayout} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Rect x={0} y={0} width={w} height={height} fill={ground === "ink" ? artInk.line : artInk.paperSunk} />
          {shapes.map((s, i) =>
            s.kind === "rect" ? (
              <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={fill(s.fill)} opacity={0.9} />
            ) : (
              <Polygon key={i} points={s.points} fill={fill(s.fill)} />
            )
          )}
        </Svg>
      ) : null}
    </View>
  );
}
