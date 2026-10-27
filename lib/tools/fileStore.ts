// Offline pack files on iPhone (and Android): expo-file-system's File API,
// under <Documents>/okwu-audio/<key>. iOS never clears Documents to free
// space; a file that has gone anyway is dropped from the record at start-up
// (verify) and simply streams again. The web preview uses ./fileStore.web.ts.
import { Directory, File, Paths } from "expo-file-system";
import { normalizeAudioKey } from "@/lib/content/localAudio";
import type { FileStore } from "./offline";

const ROOT = "okwu-audio";

function fileOf(key: string): File {
  const parts = normalizeAudioKey(key)
    .split("/")
    .filter((p) => p && p !== "." && p !== "..");
  return new File(new Directory(Paths.document, ROOT), ...parts);
}

export const fileStore: FileStore = {
  supported: true,
  async download(url, key, { signal, onBytes }) {
    const target = fileOf(key);
    const dir = target.parentDirectory;
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const out = await File.downloadFileAsync(url, target, {
      idempotent: true,
      signal,
      onProgress: (p) => onBytes(p.bytesWritten, p.totalBytes),
    });
    return out.size ?? 0;
  },
  async remove(key) {
    const f = fileOf(key);
    if (f.exists) f.delete();
  },
  uri(key) {
    try {
      return fileOf(key).uri;
    } catch {
      return null;
    }
  },
  async verify(keys) {
    const out = new Set<string>();
    for (const k of keys) {
      try {
        if (fileOf(k).exists) out.add(k);
      } catch {
        /* unreadable: treat as gone */
      }
    }
    return out;
  },
  freeBytes() {
    try {
      const n = Paths.availableDiskSpace;
      return typeof n === "number" && Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  },
};
