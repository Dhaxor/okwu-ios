// The Okwu mark: a spoken word as an uli spiral. The line coils out from a
// centre and leaves as a tail, with a camwood dot where the word lands.
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { artInk } from "@/constants/theme";
import { okwuMark } from "./geometry";

export interface OkwuMarkProps {
  size?: number;
  onInk?: boolean;
  testID?: string;
}

const MARK = okwuMark();
const STROKE = 6;
// Square viewBox around the mark, with room for the stroke.
const SIDE = Math.max(MARK.box.w, MARK.box.h) + STROKE * 2;
const VIEW = `${MARK.box.x + MARK.box.w / 2 - SIDE / 2} ${MARK.box.y + MARK.box.h / 2 - SIDE / 2} ${SIDE} ${SIDE}`;

export function OkwuMark({ size = 48, onInk = false, testID }: OkwuMarkProps) {
  const ink = onInk ? artInk.chalk : artInk.line;
  return (
    <Svg testID={testID} width={size} height={size} viewBox={VIEW} accessibilityLabel="Okwu" accessibilityRole="image">
      <Path d={MARK.path} stroke={ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={MARK.dot.x} cy={MARK.dot.y} r={MARK.dot.r} fill={artInk.red} />
    </Svg>
  );
}
