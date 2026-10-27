// Offline packs, pure (offline.test.ts). The runtime (downloads, files,
// Wi-Fi) is ./useOffline.tsx; the file stores are ./fileStore(.web).ts.
//
// A pack is a list of recordings by their R2 key ("audio/igboapi/ia_….m4a"):
// a unit's, the phrasebook's or the library's, from the audio lists the
// content builds write (scripts/tools/build-packs.ts → generated/packs.json).
// A download fetches `${EXPO_PUBLIC_AUDIO_BASE}/${key}` for each key not on
// the device yet, three at a time, and records each file as it lands, so a
// cancelled or interrupted pack resumes where it stopped. A recording the
// server does not have yet (404) is noted and skipped, never fatal.
//
// okwu.offline.v1 holds the Wi-Fi-only choice, the files on the device
// (key → bytes: the resolver's source of truth) and each pack's state. Files
// shared by two packs stay until neither needs them.
import { normalizeAudioKey } from "@/lib/content/localAudio";

export const OFFLINE_KEY = "okwu.offline.v1";

export type PackKind = "unit" | "phrasebook" | "library";

export interface PackFile {
  key: string;
  bytes: number;
}

export interface PackDef {
  id: string;
  kind: PackKind;
  title: string;
  /** A quiet line: "Unit 1 · Greetings". */
  detail: string;
  /** Unit packs: the unit id (Plus decides downloads for every pack alike: "offline-packs"). */
  unit?: string;
  files: PackFile[];
  bytes: number;
  /** Some sizes are estimates (the clip was not in the local cache when the list was built). */
  estimated: boolean;
}

export interface PacksManifest {
  version: 1;
  builtAt: string;
  /** Which audio lists the build found: "found", "missing", or "bundle" (derived from the content bundle). */
  sources: Record<string, string>;
  packs: PackDef[];
  /** Pack kinds whose list does not exist yet (shown as "on its way"). */
  pending: PackKind[];
}

export const EMPTY_MANIFEST: PacksManifest = { version: 1, builtAt: "", sources: {}, packs: [], pending: [] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const KINDS: readonly PackKind[] = ["unit", "phrasebook", "library"];
const posInt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/** Read the generated manifest defensively (a malformed pack drops out). */
export function parseManifest(raw: unknown): PacksManifest {
  if (!isObj(raw) || !Array.isArray(raw.packs)) return { ...EMPTY_MANIFEST, packs: [], pending: [] };
  const packs: PackDef[] = [];
  const ids = new Set<string>();
  for (const p of raw.packs) {
    if (!isObj(p) || typeof p.id !== "string" || !p.id || ids.has(p.id) || !KINDS.includes(p.kind as PackKind) || typeof p.title !== "string") continue;
    const seen = new Set<string>();
    const files: PackFile[] = [];
    if (Array.isArray(p.files)) {
      for (const f of p.files) {
        if (!isObj(f) || typeof f.key !== "string") continue;
        const key = normalizeAudioKey(f.key);
        if (!key || seen.has(key) || key.includes("..")) continue;
        seen.add(key);
        files.push({ key, bytes: posInt(f.bytes) });
      }
    }
    ids.add(p.id);
    packs.push({
      id: p.id,
      kind: p.kind as PackKind,
      title: p.title,
      detail: typeof p.detail === "string" ? p.detail : "",
      ...(typeof p.unit === "string" ? { unit: p.unit } : {}),
      files,
      bytes: files.reduce((n, f) => n + f.bytes, 0),
      estimated: p.estimated === true,
    });
  }
  const sources: Record<string, string> = {};
  if (isObj(raw.sources)) for (const [k, v] of Object.entries(raw.sources)) if (typeof v === "string") sources[k] = v;
  const pending = Array.isArray(raw.pending) ? (raw.pending.filter((k) => KINDS.includes(k as PackKind)) as PackKind[]) : [];
  return { version: 1, builtAt: typeof raw.builtAt === "string" ? raw.builtAt : "", sources, packs, pending };
}

// ---------------------------------------------------------------------------
// What is on the device
// ---------------------------------------------------------------------------

export interface PackRecord {
  /** Recordings the server did not have (404) at the last download. */
  missing: string[];
  /** Every file landed (or was missing upstream) at the last download. */
  complete: boolean;
  updatedAt: string;
}

export interface OfflineState {
  version: 1;
  wifiOnly: boolean;
  /** key → bytes of every recording on the device. */
  files: Record<string, number>;
  packs: Record<string, PackRecord>;
}

export const EMPTY_OFFLINE: OfflineState = { version: 1, wifiOnly: true, files: {}, packs: {} };

export function emptyOffline(): OfflineState {
  return { version: 1, wifiOnly: true, files: {}, packs: {} };
}

export function parseOffline(raw: string | null | undefined): OfflineState {
  if (!raw) return emptyOffline();
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return emptyOffline();
  }
  if (!isObj(v)) return emptyOffline();
  const files: Record<string, number> = {};
  if (isObj(v.files))
    for (const [k, b] of Object.entries(v.files)) {
      const key = normalizeAudioKey(k);
      if (key && !key.includes("..") && typeof b === "number" && Number.isFinite(b) && b >= 0) files[key] = Math.round(b);
    }
  const packs: Record<string, PackRecord> = {};
  if (isObj(v.packs))
    for (const [id, p] of Object.entries(v.packs)) {
      if (!isObj(p)) continue;
      packs[id] = {
        missing: Array.isArray(p.missing) ? p.missing.filter((x): x is string => typeof x === "string").map(normalizeAudioKey) : [],
        complete: p.complete === true,
        updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date(0).toISOString(),
      };
    }
  return { version: 1, wifiOnly: v.wifiOnly !== false, files, packs };
}

export function serializeOffline(s: OfflineState): string {
  return JSON.stringify(s);
}

export type PackPhase = "none" | "partial" | "ready";

export interface PackStatus {
  phase: PackPhase;
  /** Files of the pack on the device. */
  have: number;
  /** Files the pack lists. */
  total: number;
  /** Files the server did not have at the last try. */
  missing: number;
  /** Bytes of the pack on the device. */
  bytesHere: number;
  /** Bytes still to fetch (estimates where the size is not known). */
  bytesToGo: number;
}

export function packStatus(pack: PackDef, state: OfflineState): PackStatus {
  const rec = state.packs[pack.id];
  const missing = new Set(rec?.missing ?? []);
  let have = 0;
  let bytesHere = 0;
  let bytesToGo = 0;
  let gone = 0;
  for (const f of pack.files) {
    const b = state.files[f.key];
    if (b !== undefined) {
      have++;
      bytesHere += b;
    } else if (missing.has(f.key)) gone++;
    else bytesToGo += f.bytes;
  }
  const total = pack.files.length;
  const phase: PackPhase = total > 0 && have + gone >= total && have > 0 ? "ready" : have > 0 || rec ? "partial" : "none";
  return { phase, have, total, missing: gone, bytesHere, bytesToGo };
}

/** Bytes of every recording on the device. */
export function storageUsed(state: OfflineState): number {
  let n = 0;
  for (const b of Object.values(state.files)) n += b;
  return n;
}

/** Keys a pack still needs (not on the device, not known missing unless `retryMissing`). */
export function toFetch(pack: PackDef, state: OfflineState, retryMissing = true): PackFile[] {
  const missing = new Set(retryMissing ? [] : (state.packs[pack.id]?.missing ?? []));
  return pack.files.filter((f) => state.files[f.key] === undefined && !missing.has(f.key));
}

/** Files to delete when a pack goes: its files that no other kept pack lists. */
export function filesToRemove(pack: PackDef, all: readonly PackDef[], state: OfflineState): string[] {
  const keep = new Set<string>();
  for (const p of all) {
    if (p.id === pack.id || !state.packs[p.id]) continue;
    for (const f of p.files) keep.add(f.key);
  }
  return pack.files.map((f) => f.key).filter((k) => state.files[k] !== undefined && !keep.has(k));
}

export function withFile(state: OfflineState, key: string, bytes: number): OfflineState {
  return { ...state, files: { ...state.files, [normalizeAudioKey(key)]: Math.max(0, Math.round(bytes)) } };
}

export function withoutFiles(state: OfflineState, keys: readonly string[]): OfflineState {
  if (keys.length === 0) return state;
  const files = { ...state.files };
  for (const k of keys) delete files[normalizeAudioKey(k)];
  return { ...state, files };
}

export function withPack(state: OfflineState, id: string, rec: PackRecord | null): OfflineState {
  const packs = { ...state.packs };
  if (rec) packs[id] = rec;
  else delete packs[id];
  return { ...state, packs };
}

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

/** "980 KB", "1.2 MB", "2.4 GB". Decimal units, as iOS Settings shows storage. */
export function formatBytes(bytes: number): string {
  const b = Math.max(0, bytes);
  if (b < 1000) return b === 0 ? "0 KB" : "1 KB";
  if (b < 1_000_000) return `${Math.round(b / 1000)} KB`;
  if (b < 1_000_000_000) {
    const mb = b / 1_000_000;
    return `${mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb)} MB`;
  }
  return `${Math.round((b / 1_000_000_000) * 10) / 10} GB`;
}

// ---------------------------------------------------------------------------
// Downloading
// ---------------------------------------------------------------------------

export type DownloadFailure = "offline" | "wifi" | "storage" | "server" | "not-configured" | "unsupported" | "unknown";

/** Where files go. Native: expo-file-system (./fileStore.ts). Web preview: Cache Storage (./fileStore.web.ts). */
export interface FileStore {
  /** False where packs cannot be kept (shown honestly on the screen). */
  readonly supported: boolean;
  /** Fetch `url` into the file for `key`. Resolves with the bytes written; rejects on failure or abort. */
  download(url: string, key: string, opts: { signal: AbortSignal; onBytes: (written: number, total: number) => void }): Promise<number>;
  remove(key: string): Promise<void>;
  /** The URI the player can open for a downloaded key (sync; null when unknown). */
  uri(key: string): string | null;
  /** Keys of `keys` whose files are really there (drops records of files the system removed). */
  verify(keys: readonly string[]): Promise<Set<string>>;
  /** Free space on the device in bytes, when the platform says. */
  freeBytes(): number | null;
}

/** An error from a store or the network, sorted into what the screen can say. */
export function classifyFailure(error: unknown): DownloadFailure | "not-found" | "cancelled" {
  const e = error as { name?: string; code?: string; message?: string; status?: number } | null;
  const name = String(e?.name ?? "");
  const msg = `${e?.code ?? ""} ${e?.message ?? String(error ?? "")}`;
  if (name === "AbortError" || /\babort(ed)?\b|cancell?ed/i.test(msg)) return "cancelled";
  if (e?.status === 404 || /\b404\b|not found/i.test(msg)) return "not-found";
  if (/ENOSPC|no space|not enough space|disk (is )?full|storage (is )?full|quota/i.test(msg)) return "storage";
  if (typeof e?.status === "number" && e.status >= 500) return "server";
  if (/\b5\d\d\b/.test(msg)) return "server";
  if (/network|offline|internet|timed? ?out|failed to fetch|unable to resolve|connection|NSURLErrorDomain|ECONN|ENOTFOUND|EAI_AGAIN/i.test(msg)) return "offline";
  return "unknown";
}

export const FAILURE_COPY: Record<DownloadFailure, string> = {
  offline: "You're offline. Connect, then try again. What's saved stays saved.",
  wifi: "Waiting for Wi-Fi. Connect to Wi-Fi, or turn off Wi-Fi only to use mobile data.",
  storage: "Your phone is out of space. Free some up, then pick up where you stopped.",
  server: "The recordings didn't come through just now. Try again in a little while.",
  "not-configured": "Downloads open once Okwu's recordings are online.",
  unsupported: "Offline packs work in the iPhone app.",
  unknown: "That download stopped. Try again: what's saved stays saved.",
};

export interface DownloadProgress {
  done: number;
  total: number;
  /** 0..1 by bytes (estimates where sizes are not known). */
  fraction: number;
}

export interface DownloadInput {
  pack: PackDef;
  files: readonly PackFile[];
  base: string;
  store: FileStore;
  signal: AbortSignal;
  /** Files at a time (default 3). */
  concurrency?: number;
  /** Tries per file on a network error (default 2). */
  attempts?: number;
  /** Asked before each file: a reason to stop (no network, Wi-Fi only on mobile data), or null to go on. */
  check?: () => Promise<DownloadFailure | null>;
  onFile: (key: string, bytes: number) => void;
  onProgress: (p: DownloadProgress) => void;
  /** Wait between tries (tests pass a no-op). */
  wait?: (ms: number) => Promise<void>;
  /** A file that sends nothing for this long is dropped and tried again (default 45 s). */
  stallMs?: number;
}

export interface DownloadResult {
  /** Keys the server did not have. */
  missing: string[];
  /** Why it stopped early; null when every file was tried. */
  failure: DownloadFailure | "cancelled" | null;
}

export function fileUrl(base: string, key: string): string {
  return `${base.replace(/\/+$/, "")}/${normalizeAudioKey(key).split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Fetch a pack's files. Each file that lands is reported at once (so the
 * state survives an interruption), a 404 is noted and skipped, a network
 * error is tried again, and storage, Wi-Fi, offline and cancel stop every
 * worker cleanly.
 */
export async function downloadFiles(input: DownloadInput): Promise<DownloadResult> {
  const queue = [...input.files];
  const total = queue.length;
  const weight = (f: PackFile) => Math.max(1, f.bytes || 20_000);
  const totalWeight = queue.reduce((n, f) => n + weight(f), 0) || 1;
  const inflight = new Map<string, number>();
  let doneWeight = 0;
  let done = 0;
  const missing: string[] = [];
  let failure: DownloadResult["failure"] = null;
  const wait = input.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const attempts = Math.max(1, input.attempts ?? 2);
  const stallMs = Math.max(1, input.stallMs ?? 45_000);

  const report = () => {
    let partial = 0;
    for (const v of inflight.values()) partial += v;
    input.onProgress({ done, total, fraction: Math.min(1, (doneWeight + partial) / totalWeight) });
  };
  const stop = (why: NonNullable<DownloadResult["failure"]>) => {
    if (!failure) failure = why;
  };

  const worker = async () => {
    while (queue.length > 0 && !failure) {
      if (input.signal.aborted) return stop("cancelled");
      const f = queue.shift() as PackFile;
      const why = input.check ? await input.check() : null;
      if (why) {
        queue.unshift(f);
        return stop(why);
      }
      for (let attempt = 1; ; attempt++) {
        // One file's own signal: the learner's cancel, or a stall (nothing received for stallMs).
        const own = new AbortController();
        let stalled = false;
        const cancel = () => own.abort();
        input.signal.addEventListener("abort", cancel);
        let timer: ReturnType<typeof setTimeout> | null = null;
        const arm = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            stalled = true;
            own.abort();
          }, stallMs);
        };
        const disarm = () => {
          if (timer) clearTimeout(timer);
          input.signal.removeEventListener("abort", cancel);
        };
        try {
          inflight.set(f.key, 0);
          arm();
          const bytes = await input.store.download(fileUrl(input.base, f.key), f.key, {
            signal: own.signal,
            onBytes: (written, size) => {
              arm();
              const of = size > 0 ? size : weight(f);
              inflight.set(f.key, Math.min(1, written / of) * weight(f));
              report();
            },
          });
          disarm();
          inflight.delete(f.key);
          done++;
          doneWeight += weight(f);
          input.onFile(f.key, bytes);
          report();
          break;
        } catch (e) {
          disarm();
          inflight.delete(f.key);
          const kind = input.signal.aborted ? "cancelled" : stalled ? "offline" : classifyFailure(e);
          if (kind === "not-found") {
            missing.push(f.key);
            done++;
            doneWeight += weight(f);
            report();
            break;
          }
          if ((kind === "offline" || kind === "server" || kind === "unknown") && attempt < attempts && !input.signal.aborted) {
            await wait(400 * attempt);
            continue;
          }
          return stop(kind);
        }
      }
    }
  };

  report();
  const n = Math.max(1, Math.min(input.concurrency ?? 3, queue.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return { missing, failure };
}
