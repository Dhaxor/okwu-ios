// Hooks for the library screens: the learner's family names (persisted on
// this device only), today's place in the izu, and dataset recordings
// (played exactly as the dictionary plays them).
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { deviceCalendar } from "@/lib/game";
import { createStore, useGame } from "@/lib/state";
import { deviceKV } from "@/lib/state/kv";
import { useDictionaryAudio, type DictionaryAudio } from "@/lib/state/useDictionary";
import { calendarBasis, marketDayOn, type CalendarBasis } from "./calendar";
import { FAMILY_NAMES_KEY, addOwnName, isSaved, parseFamilyNames, removeFamilyName, saveBookName, type AddNameResult, type FamilyName } from "./familyNames";
import type { LibraryName } from "./types";

// ---------------------------------------------------------------------------
// Family names: one store, every screen in step
// ---------------------------------------------------------------------------

const store = createStore<FamilyName[]>({ key: FAMILY_NAMES_KEY, kv: deviceKV, parse: parseFamilyNames, debounceMs: 200 });
let current: FamilyName[] = [];
let loaded = false;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  if (!loaded) {
    loaded = true;
    void store.load().then((v) => {
      current = v;
      ready = true;
      emit();
    });
  }
  return () => listeners.delete(l);
}

function commit(next: FamilyName[]) {
  current = next;
  store.save(next);
  emit();
}

export interface FamilyNames {
  ready: boolean;
  list: FamilyName[];
  isSaved: (bookId: string) => boolean;
  saveBook: (name: Pick<LibraryName, "id" | "spelling">) => void;
  addOwn: (name: string, note: string) => AddNameResult;
  remove: (id: string) => void;
}

export function useFamilyNames(): FamilyNames {
  const list = useSyncExternalStore(subscribe, () => current, () => current);
  const isReady = useSyncExternalStore(subscribe, () => ready, () => ready);
  const saveBook = useCallback((name: Pick<LibraryName, "id" | "spelling">) => commit(saveBookName(current, name, new Date())), []);
  const addOwn = useCallback((name: string, note: string) => {
    const r = addOwnName(current, name, note, new Date());
    if (r.ok) commit(r.list);
    return r;
  }, []);
  const remove = useCallback((id: string) => commit(removeFamilyName(current, id)), []);
  return useMemo(
    () => ({ ready: isReady, list, isSaved: (bookId: string) => isSaved(list, bookId), saveBook, addOwn, remove }),
    [isReady, list, saveBook, addOwn, remove]
  );
}

// ---------------------------------------------------------------------------
// Today in the izu
// ---------------------------------------------------------------------------

export interface TodayInIzu extends CalendarBasis {
  today: string;
  day: ReturnType<typeof marketDayOn>;
}

/** Today's market day: from the verified anchor once there is one, else the learner's own izu (as the izu chain counts it). */
export function useTodayInIzu(): TodayInIzu {
  const game = useGame();
  const today = deviceCalendar.dayKey(new Date());
  const startedOn = game.ready ? game.state.startedOn : today;
  return useMemo(() => {
    const basis = calendarBasis(startedOn);
    return { ...basis, today, day: marketDayOn(today, basis.align) };
  }, [startedOn, today]);
}

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------

export type LibraryAudio = DictionaryAudio;

/** Dataset clips play exactly as the dictionary's do: bundled in development, the CDN in release, or "coming soon". */
export function useLibraryAudio(): LibraryAudio {
  return useDictionaryAudio();
}
