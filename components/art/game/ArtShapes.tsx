// Paint a list of ArtShapes with the artInk pigments.
import React from "react";
import { G, Path } from "react-native-svg";
import { artInk } from "@/constants/theme";
import type { ArtShape } from "./shapes";

export interface ArtShapesProps {
  shapes: readonly ArtShape[];
  /** Draw everything as a faint dashed sketch (a place or plant still to come). */
  ghost?: boolean;
  opacity?: number;
}

export function ArtShapes({ shapes, ghost = false, opacity = 1 }: ArtShapesProps) {
  return (
    <G opacity={opacity}>
      {shapes.map((s, i) =>
        ghost ? (
          s.stroke || s.fill ? (
            <Path
              key={i}
              d={s.d}
              fill="none"
              stroke={artInk.line}
              strokeWidth={Math.max(0.9, (s.width ?? 1.2) * 0.8)}
              strokeDasharray="1.5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.22}
            />
          ) : null
        ) : (
          <Path
            key={i}
            d={s.d}
            fill={s.fill ? artInk[s.fill] : "none"}
            fillOpacity={s.fillOpacity ?? 1}
            stroke={s.stroke ? artInk[s.stroke] : "none"}
            strokeWidth={s.stroke ? s.width ?? 1.2 : 0}
            strokeDasharray={s.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.opacity ?? 1}
          />
        )
      )}
    </G>
  );
}
