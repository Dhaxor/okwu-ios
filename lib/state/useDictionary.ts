// Dictionary hooks for the Practice screens. The pure logic is in
// ./dictionary.ts (tested); this file loads, persists and plays.
//   useDictionary()        the index (5,095 headwords), loaded on first use
//   useWordDetails()       regional recordings and examples, loaded on the first word page
//   useRecentSearches()    okwu.dictrecent.v1, shared by every screen that shows it
//   useDictionaryAudio()   play a dataset recording by AudioId (bundled, CDN, or "coming soon")
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { devAudioAsset, loadDictionary, loadWordDetails, type DictionaryIndex, type WordDetailsFile } from "@/lib/content";
import { useItemAudio } from "./audio";
import { DICTIONARY_AUDIO_BASE, RECENT_SEARCHES_KEY, parseRecent, pushRecent, resolveDictionaryClip, type DictClip } from "./dictionary";
import { deviceKV } from "./kv";
import { createStore } from "./store";

export type LoadStatus = "loading" | "ready" | "error";

export function useDictionary(): { status: LoadStatus; index: DictionaryIndex | null; retry: () => void } {
  const [state, setState] = useState<{ status: LoadStatus; index: DictionaryIndex | null }>({ status: "loading", index: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadDictionary()
      .then((index) => live && setState({ status: "ready", index }))
      .catch(() => live && setState({ status: "error", index: null }));
    return () => {
      live = false;
    };
  }, [attempt]);
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}

export function useWordDetails(): WordDetailsFile | null {
  const [file, setFile] = useState<WordDetailsFile | null>(null);
  useEffect(() => {
    let live = true;
    loadWordDetails()
      .then((f) => live && setFile(f))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return file;
}

// ---------------------------------------------------------------------------
// Recent searches: one store, every subscriber in step
// ---------------------------------------------------------------------------

const recentStore = createStore<string[]>({ key: RECENT_SEARCHES_KEY, kv: deviceKV, parse: parseRecent, debounceMs: 300 });
let recent: string[] = [];
let recentLoaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  if (!recentLoaded) {
    recentLoaded = true;
    void recentStore.load().then((v) => {
      recent = v;
      emit();
    });
  }
  return () => listeners.delete(l);
}

export function useRecentSearches(): { recent: string[]; add: (query: string) => void; clear: () => void } {
  const list = useSyncExternalStore(subscribe, () => recent, () => recent);
  const add = useCallback((query: string) => {
    const next = pushRecent(recent, query);
    if (next.join("\u0000") === recent.join("\u0000")) return;
    recent = next;
    recentStore.save(next);
    emit();
  }, []);
  const clear = useCallback(() => {
    recent = [];
    void recentStore.clear();
    emit();
  }, []);
  return { recent: list, add, clear };
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export interface DictionaryAudio {
  /** Play a recording by AudioId; "pending" means show "Recording coming soon". */
  play: (id: string | null | undefined, key?: string) => DictClip["kind"];
  availability: (id: string | null | undefined) => DictClip["kind"];
  stop: () => void;
  playing: boolean;
  current: string | null;
}

const env = { devAsset: devAudioAsset, base: DICTIONARY_AUDIO_BASE };

export function useDictionaryAudio(): DictionaryAudio {
  const audio = useItemAudio();
  const availability = useCallback((id: string | null | undefined) => resolveDictionaryClip(id, env).kind, []);
  const play = useCallback(
    (id: string | null | undefined, key?: string) => {
      const clip = resolveDictionaryClip(id, env);
      if (clip.kind === "asset") audio.playModule(clip.module, key ?? clip.id);
      else if (clip.kind === "url") audio.playUri(clip.uri, key ?? clip.id);
      return clip.kind;
    },
    [audio]
  );
  return { play, availability, stop: audio.stop, playing: audio.playing, current: audio.current };
}
