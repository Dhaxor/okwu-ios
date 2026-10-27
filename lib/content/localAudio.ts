// Recordings downloaded to this device (offline packs, lib/tools/offline).
// The audio resolvers ask here before the network: a clip with a file on
// the device plays from it, anything else streams exactly as before.
//   lib/state/audioSource.resolveClip        course audio (AudioRef.key)
//   lib/state/dictionary.resolveDictionaryClip dataset clips (audio/igboapi/<id>.m4a)
// Pure. The offline runtime (lib/tools/useOffline) registers the lookup once
// it has read which packs are on the device; until then nothing is local.

/** An R2 key ("audio/igboapi/ia_….m4a") → the URI of its file on this device, or null. */
export type LocalAudioLookup = (key: string) => string | null;

let lookup: LocalAudioLookup | null = null;

/** Register (or clear, with null) where downloaded clips live. */
export function setLocalAudio(next: LocalAudioLookup | null): void {
  lookup = next;
}

/** Keys are compared without a leading slash and with forward slashes only. */
export function normalizeAudioKey(key: string): string {
  return key.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

/** The on-device URI for a clip's key, or null when it is not downloaded (stream it). Never throws. */
export function localAudioUri(key: string | null | undefined): string | null {
  if (!key || !lookup) return null;
  try {
    return lookup(normalizeAudioKey(key)) || null;
  } catch {
    return null;
  }
}

/** Where dataset (Igbo API) recordings live under the audio base: the dictionary's and the packs' shared key. */
export function datasetClipKey(id: string): string {
  return `audio/igboapi/${id}.m4a`;
}
