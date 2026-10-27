// Which clip to play for an item, and where it lives. Pure (tested); the
// player hook (./audio.ts) hands the source to expo-audio.
//   development: the bundled dataset clip (devAudioAsset) when one exists,
//     else, when EXPO_PUBLIC_AUDIO_BASE is set (the audio dev server), the stream
//   release: the R2 object (`${AUDIO_BASE}/${ref.key}`), cached by the OS
// No recording (or none through QA) is "pending": the screen shows the
// RECORDING_PENDING notice. There is no synthetic fallback, ever.
// A clip downloaded in an offline pack plays from the device first
// (lib/content/localAudio), then the network as before.
import { allowsUnreviewedAudio, audioFor } from "@/lib/content";
import { localAudioUri } from "@/lib/content/localAudio";
import type { AudioRef, AudioSpeed, ContentBundle, DialectId, Item, VoiceId } from "@/lib/content/types";

/**
 * The audio CDN (Cloudflare R2). EXPO_PUBLIC_AUDIO_BASE (shared with the
 * dictionary), else EXPO_PUBLIC_OKWU_AUDIO, else the default. Read as plain
 * process.env properties so Metro inlines them in release builds.
 */
export const AUDIO_BASE = (process.env.EXPO_PUBLIC_AUDIO_BASE || process.env.EXPO_PUBLIC_OKWU_AUDIO || "https://audio.okwu.app").replace(/\/+$/, "");

/** Whether an audio base was set for this build (a development build streams only then, e.g. from the audio dev server). */
export const AUDIO_BASE_SET = Boolean(process.env.EXPO_PUBLIC_AUDIO_BASE || process.env.EXPO_PUBLIC_OKWU_AUDIO);

/**
 * Whether course audio streams from the audio base when no clip is bundled
 * or downloaded: always in release builds; in development only when a base
 * was set (scripts/content/audio-dev-server.mjs), so a plain development
 * build still says "Recording coming soon" instead of failing to load.
 */
export function streamsCourseAudio(production: boolean, baseSet: boolean = AUDIO_BASE_SET): boolean {
  return production || baseSet;
}

export type ClipSource =
  | { kind: "asset"; module: number; ref: AudioRef; rate: number }
  | { kind: "url"; uri: string; ref: AudioRef; rate: number }
  | { kind: "pending" }
  | { kind: "none" };

export interface ClipRequest {
  speed?: AudioSpeed;
  voice?: VoiceId;
  dialect?: DialectId;
}

export interface ClipEnv {
  /** devAudioAsset from lib/content (null in release). */
  devAsset: (id: string) => number | null;
  /** Stream from R2 when no bundled clip exists (release builds). */
  stream: boolean;
  base?: string;
  /** A downloaded copy of a clip (offline packs): its URI on this device, or null. Default: lib/content/localAudio. */
  local?: (key: string) => string | null;
}

/** A slow request with no slow recording plays the natural clip a little slower (pitch kept). */
export const SLOW_RATE = 0.8;

export function resolveClip(bundle: ContentBundle, item: Pick<Item, "audio" | "dialects"> | undefined, req: ClipRequest, env: ClipEnv): ClipSource {
  if (!item) return { kind: "none" };
  const state = audioFor(item, { ...req, allowUnreviewed: allowsUnreviewedAudio(bundle) });
  if (state.state !== "ready") return { kind: state.state };
  // Prefer a clip we can actually load: bundled first (development), else the requested ranking.
  const ranked = [state.ref, ...state.alternatives];
  const rateFor = (r: AudioRef) => (req.speed === "slow" && r.speed !== "slow" ? SLOW_RATE : 1);
  for (const ref of ranked) {
    const mod = env.devAsset(ref.id);
    if (mod !== null) return { kind: "asset", module: mod, ref, rate: rateFor(ref) };
  }
  const local = env.local ?? localAudioUri;
  for (const ref of ranked) {
    const uri = local(ref.key);
    if (uri) return { kind: "url", uri, ref, rate: rateFor(ref) };
  }
  if (env.stream) {
    const ref = state.ref;
    return { kind: "url", uri: `${(env.base ?? AUDIO_BASE).replace(/\/+$/, "")}/${ref.key.replace(/^\/+/, "")}`, ref, rate: rateFor(ref) };
  }
  return { kind: "pending" };
}

/** Pick the voice for the n-th play of a tone-pair trial (many voices: high-variability practice). */
export function voiceForTrial(voices: readonly VoiceId[], trial: number): VoiceId | undefined {
  if (voices.length === 0) return undefined;
  return voices[((trial % voices.length) + voices.length) % voices.length];
}
