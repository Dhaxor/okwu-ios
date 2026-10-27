// The pitch line: the native tone contour drawn over a word's syllables, in
// the same single-stroke language as the uli line. H, L and downstep (D)
// come from the content's tone layer (expected tones, not a measurement).
// `overlay` draws a learner's pitch (0..1 units) as a dashed camwood line,
// for words and short phrases only; never a score.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { artInk, space } from "@/constants/theme";
import { T } from "@/components/ui/T";
import { pitchContour, smoothPath, type Pt, type ToneLevel } from "./geometry";
import { useWidth } from "./useWidth";

export interface PitchLineProps {
  tones: readonly ToneLevel[];
  /** Syllables to set under the line, one per tone (Igbo, NFC). */
  syllables?: readonly string[];
  height?: number;
  /** Learner pitch in 0..1 units (x across the word, y 0 = high). */
  overlay?: readonly Pt[];
  onInk?: boolean;
  /** Spoken summary, e.g. "low, low" (the line itself is decorative to VoiceOver). */
  accessibilityLabel?: string;
  testID?: string;
}

export function PitchLine({ tones, syllables, height = 56, overlay, onInk = false, accessibilityLabel, testID }: PitchLineProps) {
  const [w, onLayout] = useWidth();
  const c = useMemo(() => (w > 0 ? pitchContour(tones, w, height, 10) : null), [w, height, tones]);
  const learner = useMemo(
    () => (w > 0 && overlay && overlay.length > 1 ? smoothPath(overlay.map((p) => ({ x: p.x * w, y: 10 + p.y * (height - 20) }))) : null),
    [w, height, overlay]
  );
  const ink = onInk ? artInk.chalk : artInk.line;
  const label =
    accessibilityLabel ?? `Tones: ${tones.map((t) => (t === "H" ? "high" : t === "L" ? "low" : "downstepped high")).join(", ")}`;
  return (
    <View testID={testID} accessible accessibilityLabel={label} style={styles.wrap}>
      <View onLayout={onLayout} style={{ height }}>
        {c ? (
          <Svg width={w} height={height}>
            <Path d={c.path} stroke={ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {learner ? <Path d={learner} stroke={artInk.red} strokeWidth={2} strokeDasharray="4 5" fill="none" strokeLinecap="round" /> : null}
            {c.points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={4.5} fill={tones[i] === "L" ? artInk.ochre : artInk.red} stroke={onInk ? artInk.line : artInk.paper} strokeWidth={2} />
            ))}
          </Svg>
        ) : null}
      </View>
      {syllables && syllables.length === tones.length ? (
        <View style={styles.syllables}>
          {syllables.map((s, i) => (
            <View key={i} style={styles.col}>
              <T variant="title" igbo tone={onInk ? "onInk" : "primary"} center>
                {s}
              </T>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxs },
  syllables: { flexDirection: "row" },
  col: { flex: 1, alignItems: "center" },
});
