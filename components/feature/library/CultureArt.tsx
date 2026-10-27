// Original procedural uli art for the library: one motif per tale or
// explainer (geometry in ./artGeometry, tested). Decorative only, hidden
// from screen readers. "none" (the masquerade note) draws nothing at all.
import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { UliField } from "@/components/art";
import { smoothPath } from "@/components/art/geometry";
import { artInk, colors } from "@/constants/theme";
import type { CultureMotif } from "@/lib/library/types";
import { ART_H, ART_W, cultureArt, type ArtShape, type Ink } from "./artGeometry";

const INK: Record<Ink, string> = {
  line: artInk.line,
  red: artInk.red,
  ochre: artInk.ochre,
  ochreLight: artInk.ochreLight,
  chalk: artInk.chalk,
  sunk: artInk.paperSunk,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function pathOf(s: Extract<ArtShape, { kind: "path" }>): string {
  if (s.smooth) {
    const pts = s.closed ? [...s.pts, s.pts[0]!] : s.pts;
    const d = smoothPath(pts);
    return s.closed ? `${d} Z` : d;
  }
  const d = s.pts.map((p, i) => `${i ? "L" : "M"}${r2(p.x)} ${r2(p.y)}`).join(" ");
  return s.closed ? `${d} Z` : d;
}

export interface CultureArtProps {
  motif: CultureMotif;
  /** Drawn height; the art keeps its 5:3 box, centred. */
  height?: number;
  seed?: number;
  /** The paper behind the art. */
  ground?: "sunk" | "surface" | "none";
  /** A faint scatter of uli marks behind the motif, for wide banners. */
  field?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function CultureArt({ motif, height = 120, seed = 1, ground = "sunk", field = false, style, testID }: CultureArtProps) {
  const shapes = useMemo(() => cultureArt(motif, seed), [motif, seed]);
  return (
    <View
      testID={testID}
      style={[styles.box, { height }, ground === "sunk" ? styles.sunk : ground === "surface" ? styles.surface : null, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {field && shapes.length ? <UliField seed={seed + 40} cell={56} opacity={0.1} /> : null}
      {shapes.length ? (
        <Svg width="100%" height="100%" viewBox={`0 0 ${ART_W} ${ART_H}`} preserveAspectRatio="xMidYMid meet">
          {shapes.map((s, i) =>
            s.kind === "dot" ? (
              <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.fill ? INK[s.fill] : "none"} stroke={s.stroke ? INK[s.stroke] : undefined} strokeWidth={s.width} opacity={s.opacity} />
            ) : (
              <Path
                key={i}
                d={pathOf(s)}
                fill={s.fill ? INK[s.fill] : "none"}
                stroke={s.stroke ? INK[s.stroke] : "none"}
                strokeWidth={s.width ?? 1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s.opacity}
              />
            )
          )}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  sunk: { backgroundColor: colors.surfaceSunk },
  surface: { backgroundColor: colors.surface },
});
