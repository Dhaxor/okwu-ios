// Audio hooks over expo-audio.
//
//   const audio = useItemAudio();
//   audio.play(item, { voice, speed })   → "playing" | "pending" | "none"
//   audio.playUri(uri, "mine")            the learner's own recording
//   audio.playing, audio.current          what is playing now (a key)
//   audio.stop()
//
//   const rec = useVoiceRecorder();      shadowing: record and replay, never scored
//   rec.supported (false on web), rec.state, await rec.start(), await rec.stop()
//
// Clips resolve through ./audioSource (dev: the bundled dataset clip; a
// clip in a downloaded offline pack: the file on the device; release: R2).
// A missing recording returns "pending": show
// RECORDING_PENDING_NOTICE. There is no text-to-speech anywhere.
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  type AudioSource,
} from "expo-audio";
import { devAudioAsset } from "@/lib/content";
import type { Item } from "@/lib/content/types";
import { ensureOfflineAudio } from "@/lib/tools/useOffline";
import { useContent } from "./AppState";
import { useProfile } from "./ProfileProvider";
import { resolveClip, streamsCourseAudio, type ClipRequest } from "./audioSource";

const isProduction = () => (typeof __DEV__ !== "undefined" ? !__DEV__ : true);

let modeSet = false;
/** Lessons play with the silent switch on (iOS), and through the speaker. Call once at start. */
export function configurePlayback(): void {
  if (modeSet) return;
  modeSet = true;
  setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {
    modeSet = false;
  });
}

export type PlayResult = "playing" | "pending" | "none";

export interface ItemAudio {
  play: (item: Item | undefined, req?: ClipRequest & { key?: string }) => PlayResult;
  playUri: (uri: string, key: string) => void;
  /** A bundled asset module (a development clip, e.g. for the dictionary). */
  playModule: (module: number, key: string) => void;
  stop: () => void;
  playing: boolean;
  /** The key of what is playing or last played (item id by default). */
  current: string | null;
  /**
   * The key of the clip that last played to its end (or failed), null while one is underway.
   * Hands-free runs advance on this, not on `playing` going false: on web `playing` drops
   * while a clip loads or seeks, which cut every conversation line after ~0.7 s.
   */
  finished: string | null;
  /** What `play` would do for an item, without playing (to show the pending notice up front). */
  availability: (item: Item | undefined, req?: ClipRequest) => PlayResult;
}

export function useItemAudio(): ItemAudio {
  const { bundle } = useContent();
  const { profile } = useProfile();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<string | null>(null);
  const [finished, setFinished] = useState<string | null>(null);
  const currentRef = useRef<string | null>(null);

  // A clip's end (or failure) is reported once, against the key that was playing.
  useEffect(() => {
    if (status.didJustFinish || status.error) setFinished(currentRef.current);
  }, [status.didJustFinish, status.error]);

  useEffect(() => {
    configurePlayback();
    // Offline packs: clips on the device play from there (lib/content/localAudio).
    void ensureOfflineAudio();
  }, []);

  const env = useRef({ devAsset: devAudioAsset, stream: streamsCourseAudio(isProduction()) }).current;

  const resolve = useCallback(
    (item: Item | undefined, req: ClipRequest = {}) => (bundle ? resolveClip(bundle, item, { speed: profile.audioSpeed, ...req }, env) : ({ kind: "none" } as const)),
    [bundle, profile.audioSpeed, env]
  );

  const start = useCallback(
    (source: AudioSource, rate: number, key: string) => {
      try {
        player.replace(source);
        player.shouldCorrectPitch = true;
        player.setPlaybackRate(rate);
        void player.seekTo(0).catch(() => {});
        player.play();
        currentRef.current = key;
        setFinished(null);
        setCurrent(key);
      } catch {
        /* a clip that cannot load stays silent; the screen still works */
      }
    },
    [player]
  );

  const play = useCallback<ItemAudio["play"]>(
    (item, req = {}) => {
      const clip = resolve(item, req);
      if (clip.kind === "pending" || clip.kind === "none") return clip.kind;
      start(clip.kind === "asset" ? clip.module : { uri: clip.uri }, clip.rate, req.key ?? item?.id ?? clip.ref.id);
      return "playing";
    },
    [resolve, start]
  );

  const availability = useCallback<ItemAudio["availability"]>(
    (item, req = {}) => {
      const clip = resolve(item, req);
      return clip.kind === "pending" || clip.kind === "none" ? clip.kind : "playing";
    },
    [resolve]
  );

  const playUri = useCallback((uri: string, key: string) => start({ uri }, 1, key), [start]);
  const playModule = useCallback((module: number, key: string) => start(module, 1, key), [start]);

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {
      /* already released */
    }
  }, [player]);

  return { play, playUri, playModule, stop, playing: status.playing, current, finished, availability };
}

// ---------------------------------------------------------------------------
// Recording (shadowing). Native only: the web build explains instead.
// ---------------------------------------------------------------------------

export type RecorderState = "idle" | "recording" | "recorded" | "denied" | "error";

export interface VoiceRecorder {
  supported: boolean;
  state: RecorderState;
  uri: string | null;
  durationMs: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

/** Longest take for a word or phrase; recording stops by itself after this. */
export const MAX_TAKE_MS = 10_000;

function useNativeRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecorderState>("idle");
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDuration] = useState(0);
  const startedAt = useRef(0);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(async () => {
    if (limit.current) clearTimeout(limit.current);
    limit.current = null;
    try {
      await recorder.stop();
      setUri(recorder.uri);
      setDuration(Date.now() - startedAt.current);
      setState(recorder.uri ? "recorded" : "error");
    } catch {
      setState("error");
    } finally {
      // Back to playback through the speaker (recording mode routes to the earpiece on iOS).
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    }
  }, [recorder]);

  const start = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setState("denied");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setUri(null);
      setState("recording");
      limit.current = setTimeout(() => void stop(), MAX_TAKE_MS);
    } catch {
      setState("error");
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    }
  }, [recorder, stop]);

  useEffect(
    () => () => {
      if (limit.current) clearTimeout(limit.current);
    },
    []
  );

  const reset = useCallback(() => {
    setUri(null);
    setDuration(0);
    setState("idle");
  }, []);

  return { supported: true, state, uri, durationMs, start, stop, reset };
}

function useNoRecorder(): VoiceRecorder {
  return { supported: false, state: "idle", uri: null, durationMs: 0, start: async () => {}, stop: async () => {}, reset: () => {} };
}

/** Record-and-replay for shadowing. On web it is unsupported and the screen says so kindly. */
export const useVoiceRecorder: () => VoiceRecorder = Platform.OS === "web" ? useNoRecorder : useNativeRecorder;
