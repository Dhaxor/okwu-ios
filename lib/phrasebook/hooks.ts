// Hooks for the phrasebook and conversation screens. The pure logic is in
// ./phrasebook, ./favourites and ./conversation (tested); these load, hold
// and persist.
//   usePhrasebook()       the index, loaded on first use
//   useFavourites()       okwu.phrasefavs.v1, one list shared by every screen
//   usePracticeLog()      okwu.convpractice.v1, which conversations you practised
//   useCopyPhrase()       copy a phrase and confirm with a toast
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/ui";
import { devAudioAsset } from "@/lib/content";
import { useItemAudio } from "@/lib/state/audio";
import { DICTIONARY_AUDIO_BASE, resolveDictionaryClip, type DictClip } from "@/lib/state/dictionary";
import { deviceKV } from "@/lib/state/kv";
import { createStore } from "@/lib/state/store";
import { copyText } from "./clipboard";
import { PRACTICE_LOG_KEY, parsePracticeLog, recordPractice, type PracticeLog, type PracticeMode } from "./conversation";
import { FAVOURITES_KEY, parseFavourites, toggleFavourite } from "./favourites";
import { loadPhrasebook } from "./index";
import { copyTextOf, type PhrasebookIndex } from "./phrasebook";
import type { ConversationId, Phrase } from "./types";

export type LoadStatus = "loading" | "ready" | "error";

export function usePhrasebook(): { status: LoadStatus; index: PhrasebookIndex | null; retry: () => void } {
  const [state, setState] = useState<{ status: LoadStatus; index: PhrasebookIndex | null }>({ status: "loading", index: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadPhrasebook()
      .then((index) => live && setState({ status: "ready", index }))
      .catch(() => live && setState({ status: "error", index: null }));
    return () => {
      live = false;
    };
  }, [attempt]);
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}

// ---------------------------------------------------------------------------
// A tiny shared store: one value, every subscriber in step, persisted.
// ---------------------------------------------------------------------------

function sharedStore<T>(key: string, parse: (raw: string | null) => T, empty: T) {
  const store = createStore<T>({ key, kv: deviceKV, parse, debounceMs: 200 });
  let value = empty;
  let loaded = false;
  let touched = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    subscribe(l: () => void) {
      listeners.add(l);
      if (!loaded) {
        loaded = true;
        void store.load().then((v) => {
          // A change made before the first read finished wins over the stored value.
          if (!touched) value = v;
          emit();
        });
      }
      return () => listeners.delete(l);
    },
    get: () => value,
    set(next: T) {
      touched = true;
      value = next;
      store.save(next);
      emit();
    },
  };
}

const favourites = sharedStore<string[]>(FAVOURITES_KEY, parseFavourites, []);

export function useFavourites(): { ids: string[]; isFavourite: (id: string) => boolean; toggle: (id: string) => boolean } {
  const ids = useSyncExternalStore(favourites.subscribe, favourites.get, favourites.get);
  const isFav = useCallback((id: string) => ids.includes(id), [ids]);
  /** Returns true when the phrase is now a favourite. */
  const toggle = useCallback((id: string) => {
    const next = toggleFavourite(favourites.get(), id);
    favourites.set(next);
    return next.includes(id);
  }, []);
  return { ids, isFavourite: isFav, toggle };
}

const practiceLog = sharedStore<PracticeLog>(PRACTICE_LOG_KEY, parsePracticeLog, {});

export function usePracticeLog(): { log: PracticeLog; record: (id: ConversationId, mode: PracticeMode) => void } {
  const log = useSyncExternalStore(practiceLog.subscribe, practiceLog.get, practiceLog.get);
  const record = useCallback((id: ConversationId, mode: PracticeMode) => practiceLog.set(recordPractice(practiceLog.get(), id, mode, new Date())), []);
  return { log, record };
}

// ---------------------------------------------------------------------------
// Audio: dataset recordings by AudioId (the dictionary's clip layer: a bundled
// development clip, an offline-pack file, the CDN, else "coming soon"), and
// the learner's own take. One player, so one sound at a time.
// ---------------------------------------------------------------------------

export type ClipKind = DictClip["kind"];

export interface PhraseAudio {
  /** Play a recording; "pending" means show "Recording coming soon". */
  play: (id: string | null | undefined, key: string) => ClipKind;
  availability: (id: string | null | undefined) => ClipKind;
  /** The learner's own recording (shadowing), on this device only. */
  playMine: (uri: string, key: string) => void;
  stop: () => void;
  playing: boolean;
  current: string | null;
  /** The key of the clip that last played to its end (see ItemAudio.finished). */
  finished: string | null;
}

const clipEnv = { devAsset: devAudioAsset, base: DICTIONARY_AUDIO_BASE };

export function usePhraseAudio(): PhraseAudio {
  const audio = useItemAudio();
  const availability = useCallback((id: string | null | undefined) => resolveDictionaryClip(id, clipEnv).kind, []);
  const play = useCallback(
    (id: string | null | undefined, key: string) => {
      const clip = resolveDictionaryClip(id, clipEnv);
      if (clip.kind === "asset") audio.playModule(clip.module, key);
      else if (clip.kind === "url") audio.playUri(clip.uri, key);
      return clip.kind;
    },
    [audio]
  );
  return { play, availability, playMine: audio.playUri, stop: audio.stop, playing: audio.playing, current: audio.current, finished: audio.finished };
}

/** True when a clip kind can be played now. */
export const playable = (kind: ClipKind) => kind === "asset" || kind === "url";

/** Copy the Igbo and English of a phrase; a toast says what happened (the share sheet speaks for itself). */
export function useCopyPhrase(): (phrase: Pick<Phrase, "igbo" | "en">) => void {
  const toast = useToast();
  return useCallback(
    (phrase) => {
      void copyText(copyTextOf(phrase)).then((r) => {
        if (r === "copied") toast.show("Copied the Igbo and the English.", { tone: "success" });
        else if (r === "failed") toast.show("Couldn't copy here. Press and hold the phrase to select it.", { tone: "warning" });
      });
    },
    [toast]
  );
}
