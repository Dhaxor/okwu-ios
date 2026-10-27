// A remote recording, downloaded once into the cache and played from the file
// (iPhone). See ./clipCacheName.ts for why: the recordings host does not answer
// byte-range requests, which AVPlayer needs to stream. Clips are 5-60 KB, so
// the first play waits a moment and every later one is instant. iOS may purge
// the cache directory when space runs low; a purged clip just downloads again.
// The web build uses ./clipCache.web.ts.
import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { clipCacheName, needsLocalCopy } from "./clipCacheName";

const DIR = "okwu-clips";
const inflight = new Map<string, Promise<string>>();

/** Whether `uri` should go through `localCopy` before it plays on this platform. */
export function wantsLocalCopy(uri: string | null | undefined): boolean {
  return needsLocalCopy(Platform.OS, uri);
}

/** The file URI of a cached copy of `url`, downloading it first when needed. */
export async function localCopy(url: string): Promise<string> {
  const dir = new Directory(Paths.cache, DIR);
  const file = new File(dir, clipCacheName(url));
  if (file.exists && (file.size ?? 0) > 0) return file.uri;
  const pending = inflight.get(file.uri);
  if (pending) return pending;
  const job = (async () => {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const out = await File.downloadFileAsync(url, file, { idempotent: true });
    return out.uri;
  })().finally(() => inflight.delete(file.uri));
  inflight.set(file.uri, job);
  return job;
}
