// Persisted stores: one versioned key each, read defensively, written in
// order and crash-safe. Pure TypeScript (no react-native import) so bun can
// test it; the app passes AsyncStorage as the `kv`.
//
// Crash safety. Every save writes the value under `key`, then the same value
// under `key~bak`. At most one of the two writes can be cut short by a crash
// or a kill, so one copy always holds a complete value: `load` reads the main
// key and falls back to the backup when the main value is not valid JSON.
// Writes are serialised (a save never overtakes an earlier one) and
// coalesced (a burst of saves writes the last value once).
//
// Versioning. Keys end in `.v<n>` (CONTRACTS §0 rule 7). A store may name
// `legacy` keys with a migration; when the current key is empty the newest
// legacy value is migrated, saved under the current key, and the legacy key
// is left in place (never deleted, so a downgrade still finds it).

/** The subset of AsyncStorage a store needs. */
export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** An in-memory KV for tests and previews. */
export function memoryKV(seed: Record<string, string> = {}): KV & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(seed));
  return {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

export const BACKUP_SUFFIX = "~bak";

export interface StoreOptions<T> {
  key: string;
  kv: KV;
  /** Never throws: anything unreadable becomes a safe value. Receives the raw string (or null). */
  parse: (raw: string | null) => T;
  serialize?: (value: T) => string;
  /** Older keys, newest first, each with a migration from its raw value. */
  legacy?: { key: string; migrate: (raw: string) => T | null }[];
  /** Coalesce bursts of saves (ms). 0 writes on the next tick. */
  debounceMs?: number;
}

export interface PersistedStore<T> {
  readonly key: string;
  load(): Promise<T>;
  /** Queue a write of `value` (the last value of a burst wins). */
  save(value: T): void;
  /** Resolve once every queued write has landed. */
  flush(): Promise<void>;
  /** Remove the value and its backup. */
  clear(): Promise<void>;
}

/** True when `raw` is complete JSON (a value cut off mid-write is not). */
export function isCompleteJson(raw: string | null): raw is string {
  if (raw === null || raw === "") return false;
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

export function createStore<T>(opts: StoreOptions<T>): PersistedStore<T> {
  const { key, kv, parse } = opts;
  const serialize = opts.serialize ?? ((v: T) => JSON.stringify(v));
  const debounceMs = opts.debounceMs ?? 0;
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const safe = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch {
      /* storage full or unavailable: the next save tries again */
    }
  };

  const write = (value: T) => {
    const raw = serialize(value);
    chain = chain.then(async () => {
      await safe(kv.setItem(key, raw));
      await safe(kv.setItem(key + BACKUP_SUFFIX, raw));
    });
    return chain;
  };

  const drain = () => {
    timer = null;
    if (!pending) return chain;
    const { value } = pending;
    pending = null;
    return write(value);
  };

  return {
    key,
    async load() {
      let main: string | null = null;
      let bak: string | null = null;
      try {
        main = await kv.getItem(key);
      } catch {
        main = null;
      }
      if (isCompleteJson(main)) return parse(main);
      try {
        bak = await kv.getItem(key + BACKUP_SUFFIX);
      } catch {
        bak = null;
      }
      if (isCompleteJson(bak)) return parse(bak);
      for (const old of opts.legacy ?? []) {
        let raw: string | null = null;
        try {
          raw = await kv.getItem(old.key);
        } catch {
          raw = null;
        }
        if (!isCompleteJson(raw)) continue;
        let migrated: T | null = null;
        try {
          migrated = old.migrate(raw);
        } catch {
          migrated = null;
        }
        if (migrated !== null) {
          void write(migrated);
          return migrated;
        }
      }
      return parse(null);
    },
    save(value) {
      pending = { value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void drain(), debounceMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await drain();
      await chain;
    },
    async clear() {
      pending = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await chain;
      await safe(kv.removeItem(key));
      await safe(kv.removeItem(key + BACKUP_SUFFIX));
    },
  };
}
