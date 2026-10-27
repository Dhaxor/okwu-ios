// "Still" mode for deterministic screenshots: on web, `?still=1` in the URL
// renders every animation at its end state and stops ambient motion.
// Native never runs still.

let cached: boolean | null = null;

export function isStill(): boolean {
  if (cached !== null) return cached;
  const loc = (globalThis as { location?: { search?: string } }).location;
  cached = typeof loc?.search === "string" && /(?:^|[?&])still=1(?:&|$)/.test(loc.search);
  return cached;
}
