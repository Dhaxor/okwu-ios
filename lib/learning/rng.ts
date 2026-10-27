// Seeded randomness for sessions: the same seed always gives the same
// session (CONTRACTS §2). mulberry32 + FNV-1a, as in the art geometry, but
// owned here so the engine never imports UI code.

/** mulberry32: 0 ≤ r < 1. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit seed from text (FNV-1a over UTF-16 units). */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix a seed with a label (for per-exercise seeds). */
export function subSeed(seed: number, label: string): number {
  return seedFrom(`${seed >>> 0}:${label}`);
}

/** Fisher–Yates with a seeded generator; returns a new array. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** A shuffled order of indices 0..n-1. */
export function permutation(n: number, random: () => number): number[] {
  return shuffle(
    Array.from({ length: n }, (_, i) => i),
    random
  );
}

/** Pick up to n items without replacement. */
export function sample<T>(items: readonly T[], n: number, random: () => number): T[] {
  return shuffle(items, random).slice(0, Math.max(0, n));
}
