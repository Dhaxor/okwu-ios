// One persisted value shared by every screen that reads it: a crash-safe
// createStore (lib/state/store, versioned key, defensive parse) behind a
// tiny external store, so every subscriber stays in step and writes are
// flushed when the app leaves the foreground. The pattern of
// lib/state/useDictionary's recent searches, made reusable for the tools.
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { deviceKV } from "@/lib/state/kv";
import { createStore, type PersistedStore } from "@/lib/state/store";

export interface Shared<T> {
  readonly store: PersistedStore<T>;
  get(): T;
  ready(): boolean;
  /** Load once (later calls return the same promise). */
  load(): Promise<T>;
  /** Replace the value (persisted, every subscriber re-renders). */
  set(next: T | ((prev: T) => T)): T;
  subscribe(listener: () => void): () => void;
}

const all: Shared<unknown>[] = [];
let flushing = false;

function watchForeground() {
  if (flushing) return;
  flushing = true;
  try {
    AppState.addEventListener("change", (s) => {
      if (s !== "active") for (const x of all) void x.store.flush();
    });
  } catch {
    /* no AppState (tests): writes still land on their debounce */
  }
}

export function shared<T>(opts: { key: string; parse: (raw: string | null) => T; serialize?: (v: T) => string; debounceMs?: number }): Shared<T> {
  const store = createStore<T>({ key: opts.key, kv: deviceKV, parse: opts.parse, serialize: opts.serialize, debounceMs: opts.debounceMs ?? 200 });
  let value = opts.parse(null);
  let loaded = false;
  /** Changes made before the stored value arrived: replayed onto it, so nothing stored is lost. */
  let queued: ((prev: T) => T)[] = [];
  let loading: Promise<T> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const self: Shared<T> = {
    store,
    get: () => value,
    ready: () => loaded,
    load() {
      if (!loading) {
        loading = store
          .load()
          .then((v) => {
            value = v;
            for (const op of queued) value = op(value);
            if (queued.length) store.save(value);
            queued = [];
            loaded = true;
            return value;
          })
          .catch(() => value)
          .finally(() => {
            loaded = true;
            emit();
          });
      }
      return loading;
    },
    set(next) {
      const op = typeof next === "function" ? (next as (p: T) => T) : () => next;
      value = op(value);
      if (loaded) store.save(value);
      else {
        queued.push(op);
        void self.load();
      }
      emit();
      return value;
    },
    subscribe(l) {
      listeners.add(l);
      void self.load();
      return () => {
        listeners.delete(l);
      };
    },
  };
  all.push(self as Shared<unknown>);
  watchForeground();
  return self;
}

/** Read a shared value; re-renders on change. `ready` is false until the stored value is in. */
export function useShared<T>(s: Shared<T>): { value: T; ready: boolean } {
  const value = useSyncExternalStore(s.subscribe, s.get, s.get);
  const ready = useSyncExternalStore(s.subscribe, s.ready, s.ready);
  return { value, ready };
}
