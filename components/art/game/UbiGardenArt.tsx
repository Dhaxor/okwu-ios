// The Ubi garden scene: two earth beds, eight plots, each plant drawn from
// its own procedural geometry. Plants sway very gently (a breath, not a
// dance) and a plant that reaches a new stage fades and settles in. Under
// Reduce Motion nothing sways and new stages only fade; in still mode the
// garden renders its end state. Decorative: the feature component gives
// VoiceOver the summary.
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";
import { artInk, motion } from "@/constants/theme";
import { calm, useMotion } from "@/components/ui/motion";
import type { PlantView } from "@/lib/game/types";
import { rng, seedFrom } from "../geometry";
import { useWidth } from "../useWidth";
import { ArtShapes } from "./ArtShapes";
import { emptyPlot, PLANT_BOX, PLANT_GROUND, plantShapes } from "./plants";
import { circle, dots } from "./shapes";

/** Three ochre uli dots above a ripe plant: ready to gather. */
const RIPE_DOTS = dots([{ x: 80, y: 18 }, { x: 87, y: 12 }, { x: 88, y: 21 }], 2.2);

/** Plot positions: x and ground line as fractions of the scene, and a depth scale. */
export const PLOT_LAYOUT: readonly { x: number; y: number; scale: number }[] = [
  { x: 0.16, y: 0.5, scale: 0.82 },
  { x: 0.387, y: 0.5, scale: 0.82 },
  { x: 0.613, y: 0.5, scale: 0.82 },
  { x: 0.84, y: 0.5, scale: 0.82 },
  { x: 0.14, y: 0.93, scale: 1 },
  { x: 0.38, y: 0.93, scale: 1 },
  { x: 0.62, y: 0.93, scale: 1 },
  { x: 0.86, y: 0.93, scale: 1 },
];

export const GARDEN_ASPECT = 0.64;
/** A plant's box width at scale 1, as a share of the scene width. */
const BOX_SHARE = 0.27;

export interface UbiGardenArtProps {
  plots: readonly (PlantView | null)[];
  /** Away a while: the garden is waiting (drawn a touch quieter, never wilted). */
  resting?: boolean;
  testID?: string;
}

/** Sky above the back row the tallest plant needs: a young garden does not leave an empty band. */
export function skyCrop(plots: readonly (PlantView | null)[]): number {
  const backTallest = plots.slice(0, 4).reduce((m, p) => Math.max(m, p?.stage ?? 0), 0);
  const frontTallest = plots.slice(4).reduce((m, p) => Math.max(m, p?.stage ?? 0), 0);
  const need = Math.max(backTallest, frontTallest - 1);
  return need >= 3 ? 0 : need === 2 ? 0.16 : 0.3;
}

export function UbiGardenArt({ plots, resting = false, testID }: UbiGardenArtProps) {
  const [w, onLayout] = useWidth();
  const h = Math.round(w * GARDEN_ASPECT);
  const crop = Math.round(h * skyCrop(plots));
  return (
    <View testID={testID} onLayout={onLayout} style={{ height: h ? h - crop : undefined, aspectRatio: w ? undefined : 1 / GARDEN_ASPECT, overflow: "hidden" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {w > 0 ? (
        <View style={{ height: h, marginTop: -crop }}>
          <Beds w={w} h={h} />
          {PLOT_LAYOUT.map((slot, i) => {
            const plant = plots[i] ?? null;
            const boxW = w * BOX_SHARE * slot.scale;
            const boxH = (boxW * PLANT_BOX.h) / PLANT_BOX.w;
            const left = slot.x * w - boxW / 2;
            const top = slot.y * h - (boxH * PLANT_GROUND) / PLANT_BOX.h;
            return (
              <View key={i} pointerEvents="none" style={[styles.slot, { left, top, width: boxW, height: boxH, zIndex: i < 4 ? 1 : 2 }]}>
                {plant ? <SwayingPlant plant={plant} width={boxW} height={boxH} index={i} resting={resting} /> : <EmptyPlot width={boxW} height={boxH} />}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** The two raised beds with furrows and a few pebbles: the ground the plants stand on. */
function Beds({ w, h }: { w: number; h: number }) {
  const marks = useMemo(() => {
    const r = rng(seedFrom(`ubi-${Math.round(w)}`));
    return Array.from({ length: 18 }, () => ({ x: (0.04 + r() * 0.92) * w, y: (r() < 0.5 ? 0.55 : 0.975) * h - r() * h * 0.05, r: 0.8 + r() * 1.2 }));
  }, [w, h]);
  const bed = (y: number, depth: number, inset: number) => {
    const top = (y - depth) * h;
    const bottom = Math.min(h - 1, (y + depth * 0.55) * h);
    const l = inset * w;
    const rr = (1 - inset) * w;
    return `M${l} ${bottom} C${l - w * 0.02} ${top + (bottom - top) * 0.3} ${l + w * 0.04} ${top} ${l + w * 0.1} ${top} L${rr - w * 0.1} ${top} C${rr - w * 0.04} ${top} ${rr + w * 0.02} ${top + (bottom - top) * 0.3} ${rr} ${bottom} Z`;
  };
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Path d={bed(0.5, 0.07, 0.03)} fill={artInk.paperSunk} />
      <Path d={bed(0.93, 0.085, 0.0)} fill={artInk.paperSunk} />
      <G stroke={artInk.line} strokeWidth={1} strokeLinecap="round" opacity={0.14} fill="none">
        <Path d={`M${w * 0.08} ${h * 0.535} Q${w * 0.5} ${h * 0.55} ${w * 0.92} ${h * 0.535}`} />
        <Path d={`M${w * 0.04} ${h * 0.965} Q${w * 0.5} ${h * 0.98} ${w * 0.96} ${h * 0.965}`} />
      </G>
      <G fill={artInk.line} opacity={0.18}>
        {marks.map((m, i) => (
          <Path key={i} d={circle(m.x, m.y, m.r)} />
        ))}
      </G>
    </Svg>
  );
}

function EmptyPlot({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${PLANT_BOX.w} ${PLANT_BOX.h}`}>
      <ArtShapes shapes={emptyPlot()} />
    </Svg>
  );
}

function SwayingPlant({ plant, width, height, index, resting }: { plant: PlantView; width: number; height: number; index: number; resting: boolean }) {
  const policy = useMotion();
  const sway = useSharedValue(0);
  const enter = useSharedValue(policy.still ? 1 : 0);
  const shapes = useMemo(() => plantShapes(plant.kind, plant.stage, seedFrom(plant.id)), [plant.kind, plant.stage, plant.id]);

  useEffect(() => {
    if (!policy.moves || plant.stage === 0 || resting) {
      sway.value = 0;
      return;
    }
    const half = 2400 + (index % 3) * 400;
    sway.value = withDelay(
      index * 260,
      withRepeat(withSequence(withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: half, easing: Easing.inOut(Easing.sin) })), -1, true)
    );
  }, [policy.moves, plant.stage, resting, index, sway]);

  // A new stage fades in (and settles, when motion is allowed).
  useEffect(() => {
    enter.value = 0;
    enter.value = policy.still ? 1 : withTiming(1, { duration: motion.celebrate, easing: calm });
  }, [plant.stage, policy.still, enter]);

  const amp = plant.stage >= 3 ? 1.1 : 1.8;
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * enter.value,
    transform: [{ rotate: `${sway.value * amp}deg` }, { scale: policy.moves ? 0.94 + 0.06 * enter.value : 1 }],
  }));

  return (
    <Animated.View style={[styles.fill, { transformOrigin: `50% ${(PLANT_GROUND / PLANT_BOX.h) * 100}%` }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${PLANT_BOX.w} ${PLANT_BOX.h}`}>
        <ArtShapes shapes={shapes} opacity={resting ? 0.86 : 1} />
        {plant.ripe ? <Path d={RIPE_DOTS} fill={artInk.ochre} /> : null}
      </Svg>
    </Animated.View>
  );
}

/** One plant on its own (legends, cards, reward moments). */
export function PlantArt({ kind, stage, seed = 1, size = 48 }: { kind: PlantView["kind"]; stage: PlantView["stage"]; seed?: number; size?: number }) {
  const shapes = useMemo(() => plantShapes(kind, stage, seed), [kind, stage, seed]);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={(size * PLANT_BOX.h) / PLANT_BOX.w} viewBox={`0 0 ${PLANT_BOX.w} ${PLANT_BOX.h}`}>
        <ArtShapes shapes={shapes} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: "absolute" },
  fill: { flex: 1 },
});
