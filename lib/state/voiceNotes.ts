// Family Circle voice notes on the device: record one (up to 60 s, audio
// only) and play one (with the account's Bearer header, as the server
// requires). expo-audio underneath.
//
//   const rec = useNoteRecorder();           rec.supported is false on web
//   await rec.start(); await rec.stop();     rec.uri, rec.durationMs, rec.elapsedMs
//   const player = useNotePlayer();
//   await player.toggle(note.id, () => client.audioSource(note));
//
// In a development build on web with the mock server, `simulate` makes a
// pretend take so the send flow can be checked; nothing is recorded.
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from "expo-audio";
import { LIMITS } from "@/lib/social";

export type NoteRecorderState = "idle" | "recording" | "recorded" | "denied" | "error";

export interface NoteRecorder {
  supported: boolean;
  state: NoteRecorderState;
  uri: string | null;
  durationMs: number;
  /** Time recorded so far while recording (for the timer). */
  elapsedMs: number;
  maxMs: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

export const NOTE_MAX_MS = LIMITS.voiceNoteMaxMs;
/** Shorter than this is a slip of the thumb, not a note (the server refuses it). */
export const NOTE_MIN_MS = 1000;

function useTicker(on: boolean, startedAt: { current: number }): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!on) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(t);
  }, [on, startedAt]);
  return elapsed;
}

function useNativeNoteRecorder(): NoteRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<NoteRecorderState>("idle");
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDuration] = useState(0);
  const startedAt = useRef(0);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedMs = useTicker(state === "recording", startedAt);

  const stop = useCallback(async () => {
    if (limit.current) clearTimeout(limit.current);
    limit.current = null;
    try {
      await recorder.stop();
      const ms = Date.now() - startedAt.current;
      setUri(recorder.uri);
      setDuration(Math.min(ms, NOTE_MAX_MS));
      setState(recorder.uri && ms >= NOTE_MIN_MS ? "recorded" : "idle");
    } catch {
      setState("error");
    } finally {
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
      limit.current = setTimeout(() => void stop(), NOTE_MAX_MS);
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

  return { supported: true, state, uri, durationMs, elapsedMs, maxMs: NOTE_MAX_MS, start, stop, reset };
}

/** Web: no recording. With `simulate` (development + mock), a pretend take. */
function useWebNoteRecorder(simulate: boolean): NoteRecorder {
  const [state, setState] = useState<NoteRecorderState>("idle");
  const [durationMs, setDuration] = useState(0);
  const startedAt = useRef(0);
  const elapsedMs = useTicker(state === "recording", startedAt);
  const start = useCallback(async () => {
    if (!simulate) return;
    startedAt.current = Date.now();
    setState("recording");
  }, [simulate]);
  const stop = useCallback(async () => {
    if (!simulate) return;
    setDuration(Math.max(NOTE_MIN_MS, Math.min(NOTE_MAX_MS, Date.now() - startedAt.current)));
    setState("recorded");
  }, [simulate]);
  const reset = useCallback(() => {
    setDuration(0);
    setState("idle");
  }, []);
  return { supported: simulate, state, uri: state === "recorded" ? "mock:take.m4a" : null, durationMs, elapsedMs, maxMs: NOTE_MAX_MS, start, stop, reset };
}

export function useNoteRecorder(opts: { simulate?: boolean } = {}): NoteRecorder {
  // The platform never changes at runtime, so the hook order is stable.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return Platform.OS === "web" ? useWebNoteRecorder(!!opts.simulate) : useNativeNoteRecorder();
}

export interface NotePlayer {
  /** The note playing now (or loading). */
  current: string | null;
  playing: boolean;
  /** 0..1 through the current note. */
  progress: number;
  toggle: (id: string, source: () => Promise<{ uri: string; headers: Record<string, string> }>) => Promise<"playing" | "paused" | "unavailable">;
  stop: () => void;
}

export function useNotePlayer(): NotePlayer {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (status.didJustFinish) setCurrent(null);
  }, [status.didJustFinish]);

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {
      /* already released */
    }
    setCurrent(null);
  }, [player]);

  const toggle = useCallback<NotePlayer["toggle"]>(
    async (id, source) => {
      if (current === id && status.playing) {
        player.pause();
        return "paused";
      }
      try {
        const s = await source();
        if (!s.uri) return "unavailable";
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
        player.replace({ uri: s.uri, headers: s.headers });
        void player.seekTo(0).catch(() => {});
        player.play();
        setCurrent(id);
        return "playing";
      } catch {
        return "unavailable";
      }
    },
    [current, player, status.playing]
  );

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  return { current, playing: status.playing, progress, toggle, stop };
}
