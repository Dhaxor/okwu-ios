// Offline pack files in the web preview: the browser's Cache Storage, so the
// download, progress, cancel and remove flows run for real against the
// development audio server. A downloaded clip plays from a blob: URL made
// when it lands (or when the app starts, for clips already kept).
import { normalizeAudioKey } from "@/lib/content/localAudio";
import type { FileStore } from "./offline";

const CACHE = "okwu-audio-v1";
const urls = new Map<string, string>();

const supported = typeof window !== "undefined" && typeof caches !== "undefined" && typeof fetch === "function";
const requestFor = (key: string) => `/__okwu-offline/${normalizeAudioKey(key)}`;

async function readAll(res: Response, signal: AbortSignal, onBytes: (written: number, total: number) => void): Promise<Blob> {
  const total = Number(res.headers.get("content-length")) || -1;
  if (!res.body) {
    const b = await res.blob();
    onBytes(b.size, b.size);
    return b;
  }
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let written = 0;
  for (;;) {
    if (signal.aborted) {
      void reader.cancel().catch(() => {});
      throw Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
    }
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as BlobPart);
    written += value.byteLength;
    onBytes(written, total);
  }
  return new Blob(chunks, { type: res.headers.get("content-type") || "audio/mp4" });
}

export const fileStore: FileStore = {
  supported,
  async download(url, key, { signal, onBytes }) {
    if (!supported) throw new Error("unsupported");
    const res = await fetch(url, { signal });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const blob = await readAll(res, signal, onBytes);
    const cache = await caches.open(CACHE);
    await cache.put(requestFor(key), new Response(blob, { headers: { "content-type": blob.type, "content-length": String(blob.size) } }));
    const k = normalizeAudioKey(key);
    const old = urls.get(k);
    if (old) URL.revokeObjectURL(old);
    urls.set(k, URL.createObjectURL(blob));
    return blob.size;
  },
  async remove(key) {
    const k = normalizeAudioKey(key);
    const old = urls.get(k);
    if (old) URL.revokeObjectURL(old);
    urls.delete(k);
    if (!supported) return;
    const cache = await caches.open(CACHE);
    await cache.delete(requestFor(k));
  },
  uri(key) {
    return urls.get(normalizeAudioKey(key)) ?? null;
  },
  async verify(keys) {
    const out = new Set<string>();
    if (!supported) return out;
    const cache = await caches.open(CACHE);
    for (const key of keys) {
      const k = normalizeAudioKey(key);
      const res = await cache.match(requestFor(k));
      if (!res) continue;
      if (!urls.has(k)) urls.set(k, URL.createObjectURL(await res.blob()));
      out.add(k);
    }
    return out;
  },
  freeBytes() {
    return null;
  },
};
