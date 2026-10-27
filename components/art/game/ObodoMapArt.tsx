// The Obodo map: seven places on a winding path, from home (bottom) up to
// homecoming (top). The path is drawn in camwood as far as the learner has
// restored, and as a quiet dotted line beyond. Whole places breathe gently
// (their life layer); the place being restored now has a soft camwood ring.
// Under Reduce Motion and in still mode nothing moves. Decorative: the
// feature component (ObodoMap) supplies labels, taps and VoiceOver text.
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";
import { artInk } from "@/constants/theme";
import { useMotion } from "@/components/ui/motion";
import { OBODO_PLACES } from "@/lib/game/rules";
import type { ObodoPlace, ObodoStage } from "@/lib/game/types";
import type { Pt } from "../geometry";
import { ArtShapes } from "./ArtShapes";
import { MAP_ASPECT, MAP_LAYOUT, mapScenery, placeArt, VIGNETTE, VIGNETTE_SHARE } from "./obodo";
import { ellipse } from "./shapes";

export interface ObodoMapArtProps {
  width: number;
  stages: Record<ObodoPlace, ObodoStage>;
  /** The place being restored now (ringed). */
  next: ObodoPlace | null;
}

/** Geometry of the map at a width: each place's box and the path's anchor points. */
export function mapGeometry(width: number) {
  const height = Math.round(width * MAP_ASPECT);
  const vw = width * VIGNETTE_SHARE;
  const vh = (vw * VIGNETTE.h) / VIGNETTE.w;
  const boxes = Object.fromEntries(
    OBODO_PLACES.map((p) => {
      const c = MAP_LAYOUT[p];
      return [p, { x: c.x * width - vw / 2, y: c.y * height - vh / 2, w: vw, h: vh }];
    })
  ) as Record<ObodoPlace, { x: number; y: number; w: number; h: number }>;
  // The path touches each place at its inner front corner, so it runs down the middle between them.
  const anchors: Pt[] = OBODO_PLACES.map((p) => {
    const c = MAP_LAYOUT[p];
    const inward = c.x < 0.5 ? 1 : -1;
    return { x: c.x * width + inward * vw * 0.36, y: c.y * height + vh * 0.4 };
  });
  return { width, height, vw, vh, boxes, anchors };
}

/** One Catmull-Rom segment (matches smoothPath) between anchors i and i+1. */
function segment(pts: Pt[], i: number): string {
  const p0 = pts[i - 1] ?? (pts[i] as Pt);
  const p1 = pts[i] as Pt;
  const p2 = pts[i + 1] as Pt;
  const p3 = pts[i + 2] ?? p2;
  const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
  const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
  const r = (n: number) => Math.round(n * 10) / 10;
  return `M${r(p1.x)} ${r(p1.y)} C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`;
}

export function ObodoMapArt({ width, stages, next }: ObodoMapArtProps) {
  const policy = useMotion();
  const g = useMemo(() => mapGeometry(width), [width]);
  const scenery = useMemo(() => mapScenery(g.width, g.height), [g.width, g.height]);
  const scale = g.vw / VIGNETTE.w;

  const breathe = useSharedValue(1);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!policy.moves) {
      breathe.value = 1;
      pulse.value = 1;
      return;
    }
    breathe.value = withRepeat(withTiming(0.72, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    pulse.value = withRepeat(withTiming(0.35, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [policy.moves, breathe, pulse]);
  const lifeStyle = useAnimatedStyle(() => ({ opacity: breathe.value }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const place = (p: ObodoPlace) => g.boxes[p];
  const transformFor = (p: ObodoPlace) => `translate(${place(p).x} ${place(p).y}) scale(${scale})`;

  return (
    <View style={{ width: g.width, height: g.height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={g.width} height={g.height}>
        <ArtShapes shapes={scenery} />
        {/* The path, segment by segment: restored stretches in camwood. */}
        {OBODO_PLACES.slice(1).map((p, i) => {
          const on = stages[p] > 0;
          return (
            <Path
              key={`seg-${p}`}
              d={segment(g.anchors, i)}
              fill="none"
              stroke={on ? artInk.red : artInk.line}
              strokeWidth={on ? 2.2 : 1.4}
              strokeDasharray={on ? undefined : "1.5 6"}
              strokeLinecap="round"
              opacity={on ? 0.85 : 0.4}
            />
          );
        })}
        {OBODO_PLACES.map((p) => {
          const stage = stages[p];
          const art = placeArt(p);
          return (
            <G key={p} transform={transformFor(p)}>
              <Path d={ellipse(60, 82, 57, 7.5)} fill={stage >= 2 ? artInk.paperDeep : artInk.paperSunk} opacity={stage === 0 ? 0.55 : 0.85} />
              {stage === 0 ? <ArtShapes shapes={art.base} ghost /> : null}
              {stage >= 2 ? <ArtShapes shapes={art.fills} /> : null}
              {stage >= 1 ? <ArtShapes shapes={art.base} /> : null}
            </G>
          );
        })}
        {OBODO_PLACES.map((p, i) => (
          <Path key={`dot-${p}`} d={ellipse(g.anchors[i]!.x, g.anchors[i]!.y, 3.6, 3.6)} fill={stages[p] > 0 ? artInk.red : artInk.paper} stroke={stages[p] > 0 ? artInk.red : artInk.line} strokeWidth={1.2} opacity={stages[p] > 0 ? 1 : 0.5} />
        ))}
      </Svg>

      {/* Life: whole places breathe. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lifeStyle]}>
        <Svg width={g.width} height={g.height}>
          {OBODO_PLACES.filter((p) => stages[p] >= 3).map((p) => (
            <G key={p} transform={transformFor(p)}>
              <ArtShapes shapes={placeArt(p).life} />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {next ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ringStyle]}>
          <Svg width={g.width} height={g.height}>
            <G transform={transformFor(next)}>
              <Path d={ellipse(60, 82, 60, 10)} fill="none" stroke={artInk.red} strokeWidth={2 / scale} strokeDasharray={`${4 / scale} ${4 / scale}`} />
            </G>
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
