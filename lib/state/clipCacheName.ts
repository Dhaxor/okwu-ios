// Pure helpers for the clip cache (./clipCache.ts): which sources need a local
// copy before they play, and the cache file each one gets.

/** An http(s) address (not a bundled module, a file on the phone, or a blob). */
export function isRemote(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

/**
 * Whether a source must be downloaded before it plays. iOS's AVPlayer streams
 * only from servers that answer HTTP byte-range requests with 206 Partial
 * Content; the recordings host answers them with the whole file (200), and
 * every play fails with AVFoundationErrorDomain -11850. Android and the web
 * play such servers fine.
 */
export function needsLocalCopy(platform: string, uri: string | null | undefined): boolean {
  return platform === "ios" && !!uri && isRemote(uri);
}

/**
 * A stable cache file name for a clip address: a short hash of the whole URL
 * (so two clips never share a file) and its last path segment, made safe, with
 * the audio extension AVPlayer needs to recognise a local file.
 */
export function clipCacheName(url: string): string {
  let h = 2166136261;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const path = url.split(/[?#]/)[0] ?? "";
  const last = (path.split("/").pop() || "clip").replace(/[^A-Za-z0-9._-]/g, "_").slice(-60);
  const named = /\.(m4a|mp4|aac|mp3|wav|caf)$/i.test(last) ? last : `${last}.m4a`;
  return `${h.toString(36)}-${named}`;
}
