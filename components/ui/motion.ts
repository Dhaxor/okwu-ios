// Motion policy in one hook. Every animated primitive asks it before moving.
//   Reduce Motion (OS): no slides or springs; state changes become fades.
//   Still (web ?still=1): end states only, for screenshots.
import { Easing, useReducedMotion } from "react-native-reanimated";
import { motion } from "@/constants/theme";
import { isStill } from "@/lib/still";

export interface MotionPolicy {
  /** OS Reduce Motion is on. */
  readonly reduced: boolean;
  /** Screenshot mode: render end states. */
  readonly still: boolean;
  /** Things may slide, spring and scale. False → fade or jump. */
  readonly moves: boolean;
}

export function useMotion(): MotionPolicy {
  const reduced = useReducedMotion();
  const still = isStill();
  return { reduced, still, moves: !reduced && !still };
}

/** The calm ease-out used everywhere. */
export const calm = Easing.bezier(...motion.ease);

export const pressSpring = { damping: motion.press.damping, stiffness: motion.press.stiffness } as const;
