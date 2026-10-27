// What a ProgressBar draws, as plain data (progress.test.ts). Pure: no
// react-native import, so bun can test it.
//
// The bar's fill is a percentage of its track, not a measured width: the
// track's onLayout may never fire when the same view switches from beads to
// a bar mid-session (its frame does not change, so iOS sends no layout
// event), and a fill sized from a width of 0 never draws. A percentage needs
// no measurement at all.

export type ProgressShape = { kind: "beads"; steps: number; done: number } | { kind: "bar"; fraction: number };

/** Clamp to 0..1; anything not a finite number is 0. */
export function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function progressShape(value: number, steps?: number): ProgressShape {
  const v = clampProgress(value);
  if (steps !== undefined && Number.isFinite(steps) && steps > 0) {
    const n = Math.floor(steps);
    return { kind: "beads", steps: n, done: Math.round(v * n) };
  }
  return { kind: "bar", fraction: v };
}

/** The fill's width for a fraction, as a style percentage ("62%"). */
export function fillWidth(fraction: number): `${number}%` {
  return `${Math.round(clampProgress(fraction) * 10000) / 100}%`;
}
