// Nnenne, the grandmother guide, drawn with respect: a cameo silhouette in
// profile (a wrapped head-tie, the line of brow, nose and chin, a shoulder
// drape), no facial features, no caricature. A ring of uli dots frames her
// like a seal. `mood` only changes the ring's accent, never her face: she
// celebrates every attempt and never scolds.
import React from "react";
import Svg, { Circle, ClipPath, Defs, G, Path } from "react-native-svg";
import { artInk } from "@/constants/theme";

export interface NnenneProps {
  size?: number;
  /** Ground behind the silhouette. */
  ground?: "ochre" | "paper" | "ink";
  mood?: "calm" | "glad";
  testID?: string;
}

// 120×120 artboard, facing right. One closed silhouette path.
const SILHOUETTE =
  "M70 77 C72 76 75 74 76 72 C77 70.5 76.5 69 76 68.5 C77.5 68 78.5 66.8 78 65.6 C79 65 79.2 63.8 78.4 63 " +
  "C79 62.4 80 61.6 79.6 60.8 C81.5 60.6 82.6 59.6 82 58.4 C80 56 78.5 53.5 77.6 51 C77.4 49.6 77.8 48.4 77.2 47 " +
  "C76.6 45 75.6 43.6 74.6 42.6 C76 40 78 36 77 31 C75 22 66 15 55 16 C47 16.5 41 20 38 26 " +
  "C33 24 28 26 29 31 C30 35 34 37 37 37 C36 41 37 46 41 50 C44 53 47 58 50 64 C51 68 51 72 50 76 " +
  "C49.5 80 48 84 44 88 C36 92 26 96 20 104 C16 110 14 116 14 124 L106 124 C106 112 102 104 94 99 " +
  "C86 94 76 92 72 88 C70 85 69.5 81 70 77 Z";

// Folds of the head-tie, drawn in the ground colour over the silhouette.
const FOLDS = ["M74.5 40.5 C66 37 54 33 42 31.5", "M76 32 C68 27 58 23.5 46 23.5", "M41 49 C47 45 56 43 63 43.5"];

// The drape's edge across the shoulder.
const DRAPE = "M44 88 C54 96 70 100 94 99";

export function Nnenne({ size = 96, ground = "ochre", mood = "calm", testID }: NnenneProps) {
  const groundFill = ground === "ochre" ? artInk.ochreLight : ground === "ink" ? artInk.line : artInk.paperSunk;
  const figure = ground === "ink" ? artInk.chalk : artInk.line;
  const fold = ground === "ink" ? artInk.line : artInk.ochre;
  const ringDots = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    return { x: 60 + Math.cos(a) * 56, y: 60 + Math.sin(a) * 56, big: i % 6 === 0 };
  });
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Nnenne" accessibilityRole="image">
      <Defs>
        <ClipPath id="nnenne-clip">
          <Circle cx={60} cy={60} r={50} />
        </ClipPath>
      </Defs>
      <Circle cx={60} cy={60} r={50} fill={groundFill} />
      <G clipPath="url(#nnenne-clip)">
        <Path d={SILHOUETTE} fill={figure} />
        <G stroke={fold} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.8}>
          {FOLDS.map((d) => (
            <Path key={d} d={d} />
          ))}
          <Path d={DRAPE} />
        </G>
        <Circle cx={56.5} cy={69} r={2.2} fill={artInk.ochre} />
      </G>
      {ringDots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.big ? 2.2 : 1.3} fill={d.big ? (mood === "glad" ? artInk.ochre : artInk.red) : figure} opacity={d.big ? 1 : 0.4} />
      ))}
    </Svg>
  );
}
