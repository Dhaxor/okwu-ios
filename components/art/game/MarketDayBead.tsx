// A market day of the izu as a woven bead (an akwete lozenge).
//   practised  camwood with an ochre heart: this day is marked
//   today      a camwood ring around paper: today, not yet practised
//   rest       a quiet sunk bead with a small uli curl (a breath): a rest day, by design
//   open       paper with a hairline: still to come
//   missed     a sunk, quiet bead (never red, never crossed out)
import React from "react";
import { View } from "react-native";
import Svg, { Path, Polygon } from "react-native-svg";
import { artInk, colors } from "@/constants/theme";
import type { IzuCellState } from "@/lib/game/types";
import { spiralPath } from "../geometry";

const REST_CURL = spiralPath(14, 14, 5, 1.6, Math.PI / 2, 1);

export interface MarketDayBeadProps {
  state: IzuCellState;
  size?: number;
  /** Draw on an ink surface. */
  onInk?: boolean;
  /** Ring it as today (a practised day can also be today). */
  today?: boolean;
}

export function MarketDayBead({ state, size = 28, onInk = false, today = false }: MarketDayBeadProps) {
  const paper = onInk ? artInk.line : artInk.chalk;
  const hair = onInk ? colors.onInk24 : colors.hairlineStrong;
  const outer = "14,1.5 26.5,14 14,26.5 1.5,14";
  const inner = "14,8 20,14 14,20 8,14";
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {state === "practised" ? (
        <>
          <Polygon points={outer} fill={artInk.red} stroke={today ? (onInk ? artInk.chalk : artInk.line) : artInk.red} strokeWidth={today ? 1.6 : 1} strokeLinejoin="round" />
          <Polygon points={inner} fill={artInk.ochreLight} />
          <Polygon points="14,12 16,14 14,16 12,14" fill={artInk.red} />
        </>
      ) : state === "today" ? (
        <>
          <Polygon points={outer} fill={paper} stroke={artInk.red} strokeWidth={2.2} strokeLinejoin="round" />
          <Polygon points="14,11 17,14 14,17 11,14" fill={artInk.red} />
        </>
      ) : state === "rest" ? (
        <>
          <Polygon points={outer} fill={onInk ? colors.onInk12 : artInk.paperSunk} stroke={hair} strokeWidth={1} strokeLinejoin="round" />
          <Path d={REST_CURL} fill="none" stroke={onInk ? artInk.chalk : artInk.ochre} strokeWidth={1.6} strokeLinecap="round" />
        </>
      ) : state === "missed" ? (
        <Polygon points={outer} fill={onInk ? colors.onInk12 : artInk.paperSunk} stroke={hair} strokeWidth={1} strokeDasharray="2 2.5" strokeLinejoin="round" />
      ) : (
        <Polygon points={outer} fill={paper} stroke={hair} strokeWidth={1.2} strokeLinejoin="round" />
      )}
    </Svg>
    </View>
  );
}
