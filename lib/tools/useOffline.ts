// Offline packs at runtime: the record of what is on the device
// (okwu.offline.v1), downloads with progress and cancel, Wi-Fi only, and
// the registry the audio resolvers read (lib/content/localAudio). Pure
// logic: ./offline.ts. Files: ./fileStore(.web).ts.
//
//   ensureOfflineAudio()   called by the audio hooks on first use, so a
//                          downloaded clip plays from the device on every screen
//   useOffline()           the Offline packs screen and the Me tab
//
// Packs come from generated/packs.json (bun scripts/tools/build-packs.ts).
// Files are fetched from EXPO_PUBLIC_AUDIO_BASE (Cloudflare R2; in
// development scripts/content/audio-dev-server.mjs). Okwu Plus opens
// downloads ("offline-packs"); the screen asks usePlus(), not this module.
import { useCallback, useSyncExternalStore } from "react";
import * as Network from "expo-network";
import { setLocalAudio } from "@/lib/content/localAudio";
import { cleanBase } from "@/lib/state/dictionary";
import manifestJson from "./generated/packs.json";
import { fileStore } from "./fileStore";
import {
  OFFLINE_KEY,
  downloadFiles,
  filesToRemove,
  parseManifest,
  parseOffline,
  serializeOffline,
  toFetch,
  withFile,
  withPack,
  withoutFiles,
  type DownloadFailure,
  type DownloadProgress,
  type OfflineState,
  type PacksManifest,
} from "./offline";
import { shared, useShared } from "./persisted";

export const MANIFEST: PacksManifest = parseManifest(manifestJson);

/** Where packs download from: EXPO_PUBLIC_AUDIO_BASE (read as a plain property so Metro inlines it). Null: not hosted yet. */
export const PACKS_BASE: string | null = cleanBase(process.env.EXPO_PUBLIC_AUDIO_BASE);

export const offlineStore = shared<OfflineState>({ key: OFFLINE_KEY, parse: parseOffline, serialize: serializeOffline, debounceMs: 400 });

// ---------------------------------------------------------------------------
// The resolver registry: downloaded keys → their file
// ---------------------------------------------------------------------------

let started: Promise<void> | null = null;

/** Read what is on the device, drop records of files that have gone, and let the resolvers find them. Idempotent. */
export function ensureOfflineAudio(): Promise<void> {
  if (!started) {
    started = offlineStore
      .load()
      .then(async (state) => {
        const keys = Object.keys(state.files);
        if (keys.length > 0) {
          const there = await fileStore.verify(keys);
          const gone = keys.filter((k) => !there.has(k));
          if (gone.length) offlineStore.set((s) => withoutFiles(s, gone));
        }
      })
      .catch(() => {})
      .finally(() => {
        setLocalAudio((key) => (offlineStore.get().files[key] !== undefined ? fileStore.uri(key) : null));
      });
  }
  return started;
}

// ---------------------------------------------------------------------------
// Downloads in flight (one per pack), and the last failure of each pack
// ---------------------------------------------------------------------------

export interface Job {
  progress: DownloadProgress;
  controller: AbortController;
}

let jobs: Readonly<Record<string, Job>> = {};
let failures: Readonly<Record<string, DownloadFailure>> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getJobs = () => jobs;
const getFailures = () => failures;

function setJob(id: string, job: Job | null) {
  const next = { ...jobs };
  if (job) next[id] = job;
  else delete next[id];
  jobs = next;
  emit();
}

function setFailure(id: string, f: DownloadFailure | null) {
  const next = { ...failures };
  if (f) next[id] = f;
  else delete next[id];
  failures = next;
  emit();
}

/** Connected, and on Wi-Fi when the learner asked for Wi-Fi only (unknown network types are allowed). */
async function networkCheck(): Promise<DownloadFailure | null> {
  try {
    const s = await Network.getNetworkStateAsync();
    if (s.isConnected === false || s.type === Network.NetworkStateType.NONE) return "offline";
    if (offlineStore.get().wifiOnly && s.type === Network.NetworkStateType.CELLULAR) return "wifi";
    return null;
  } catch {
    return null;
  }
}

export async function downloadPack(id: string): Promise<DownloadFailure | "cancelled" | null> {
  const pack = MANIFEST.packs.find((p) => p.id === id);
  if (!pack || jobs[id]) return null;
  await ensureOfflineAudio();
  setFailure(id, null);
  const fail = (f: DownloadFailure) => {
    setFailure(id, f);
    return f;
  };
  if (!fileStore.supported) return fail("unsupported");
  if (!PACKS_BASE) return fail("not-configured");
  const before = await networkCheck();
  if (before) return fail(before);
  const files = toFetch(pack, offlineStore.get());
  const controller = new AbortController();
  setJob(id, { progress: { done: 0, total: files.length, fraction: 0 }, controller });
  let last = 0;
  let checks = 0;
  const result = await downloadFiles({
    pack,
    files,
    base: PACKS_BASE,
    store: fileStore,
    signal: controller.signal,
    // The network is asked again every few files, so Wi-Fi only holds when a phone walks out of range.
    check: async () => (checks++ % 4 === 3 ? networkCheck() : null),
    onFile: (key, bytes) => {
      offlineStore.set((s) => withFile(s, key, bytes));
    },
    onProgress: (p) => {
      const now = Date.now();
      if (now - last < 120 && p.fraction < 1) return;
      last = now;
      if (jobs[id]) setJob(id, { ...jobs[id]!, progress: p });
    },
  });
  offlineStore.set((s) => withPack(s, id, { missing: result.missing, complete: result.failure === null, updatedAt: new Date().toISOString() }));
  setJob(id, null);
  if (result.failure && result.failure !== "cancelled") setFailure(id, result.failure);
  void offlineStore.store.flush();
  return result.failure;
}

export function cancelPack(id: string): void {
  jobs[id]?.controller.abort();
}

export async function removePack(id: string): Promise<void> {
  const pack = MANIFEST.packs.find((p) => p.id === id);
  if (!pack) return;
  const job = jobs[id];
  if (job) {
    job.controller.abort();
    // Let the workers stop before the files go.
    await new Promise((r) => setTimeout(r, 50));
  }
  const keys = filesToRemove(pack, MANIFEST.packs, offlineStore.get());
  for (const k of keys) await fileStore.remove(k).catch(() => {});
  offlineStore.set((s) => withPack(withoutFiles(s, keys), id, null));
  setFailure(id, null);
  void offlineStore.store.flush();
}

export async function removeAllPacks(): Promise<void> {
  for (const j of Object.values(jobs)) j.controller.abort();
  await new Promise((r) => setTimeout(r, 50));
  const keys = Object.keys(offlineStore.get().files);
  for (const k of keys) await fileStore.remove(k).catch(() => {});
  offlineStore.set((s) => ({ ...s, files: {}, packs: {} }));
  failures = {};
  emit();
  void offlineStore.store.flush();
}

export function setWifiOnly(on: boolean): void {
  offlineStore.set((s) => ({ ...s, wifiOnly: on }));
}

export interface OfflineView {
  ready: boolean;
  state: OfflineState;
  manifest: PacksManifest;
  jobs: Readonly<Record<string, Job>>;
  failures: Readonly<Record<string, DownloadFailure>>;
  base: string | null;
  supported: boolean;
  freeBytes: number | null;
  download: (id: string) => Promise<DownloadFailure | "cancelled" | null>;
  cancel: (id: string) => void;
  remove: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
  setWifiOnly: (on: boolean) => void;
  dismissFailure: (id: string) => void;
}

export function useOffline(): OfflineView {
  const { value, ready } = useShared(offlineStore);
  const j = useSyncExternalStore(subscribe, getJobs, getJobs);
  const f = useSyncExternalStore(subscribe, getFailures, getFailures);
  const dismissFailure = useCallback((id: string) => setFailure(id, null), []);
  return {
    ready,
    state: value,
    manifest: MANIFEST,
    jobs: j,
    failures: f,
    base: PACKS_BASE,
    supported: fileStore.supported,
    freeBytes: fileStore.freeBytes(),
    download: downloadPack,
    cancel: cancelPack,
    remove: removePack,
    removeAll: removeAllPacks,
    setWifiOnly,
    dismissFailure,
  };
}
