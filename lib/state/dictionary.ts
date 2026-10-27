// The dictionary screens' pure logic (dictionary.test.ts): recent searches,
// the dictionary's word of the day, a word page's definitions, pitch line,
// regional forms and examples, and where each recording plays from.
// The hooks are in ./useDictionary.ts.
//
// Recordings (resolveDictionaryClip):
//   1. a clip bundled in a development build (content/audio/dev) plays from the app;
//      a clip downloaded in an offline pack plays from the device;
//   2. otherwise, with a CDN configured (EXPO_PUBLIC_AUDIO_BASE, later
//      Cloudflare R2), it streams `${base}/audio/igboapi/<AudioId>.m4a`,
//      the transcoded file name the fetcher's manifest records;
//   3. otherwise it is "pending": the screen says "Recording coming soon".
// In development, scripts/content/audio-dev-server.mjs serves that layout
// from data/igboapi/audio-cache and fetches a missing clip on demand.
import { stripDots } from "@/lib/igbo/letters";
import { describeTones, markedSyllables, parseToneText } from "@/lib/igbo/syllables";
import { nfc } from "@/lib/igbo/text";
import { NO_DETAILS, igboKey, type DictionaryEntry, type DictionaryHit, type DictionaryIndex, type WordDetails, type WordExample } from "@/lib/content";
import { datasetClipKey, localAudioUri } from "@/lib/content/localAudio";
import type { Tone } from "@/lib/content/types";

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------

/** Where dataset recordings live under the audio base (the R2 key prefix). */
export const DATASET_AUDIO_PREFIX = "audio/igboapi";

/** A base URL from the environment, or null when unset or not http(s). */
export function cleanBase(value: string | undefined | null): string | null {
  const v = (value ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : null;
}

/**
 * The CDN base for dictionary recordings: EXPO_PUBLIC_AUDIO_BASE, or the
 * course audio's EXPO_PUBLIC_OKWU_AUDIO when that one is set. Read as plain
 * process.env properties so Metro inlines them. Null: nothing is hosted
 * yet, so the dictionary says "Recording coming soon".
 */
export const DICTIONARY_AUDIO_BASE: string | null = cleanBase(process.env.EXPO_PUBLIC_AUDIO_BASE) ?? cleanBase(process.env.EXPO_PUBLIC_OKWU_AUDIO);

export function datasetClipUrl(base: string, id: string): string {
  return `${base.replace(/\/+$/, "")}/${DATASET_AUDIO_PREFIX}/${encodeURIComponent(id)}.m4a`;
}

export type DictClip = { kind: "asset"; module: number; id: string } | { kind: "url"; uri: string; id: string } | { kind: "pending"; id: string } | { kind: "none" };

export interface DictClipEnv {
  /** devAudioAsset from lib/content (always null in a release build). */
  devAsset: (id: string) => number | null;
  base: string | null;
  /** A clip downloaded in an offline pack: its URI on this device, or null. Default: lib/content/localAudio. */
  local?: (key: string) => string | null;
}

export function resolveDictionaryClip(id: string | null | undefined, env: DictClipEnv): DictClip {
  if (!id) return { kind: "none" };
  const mod = env.devAsset(id);
  if (mod !== null) return { kind: "asset", module: mod, id };
  const local = (env.local ?? localAudioUri)(datasetClipKey(id));
  if (local) return { kind: "url", uri: local, id };
  if (env.base) return { kind: "url", uri: datasetClipUrl(env.base, id), id };
  return { kind: "pending", id };
}

// ---------------------------------------------------------------------------
// Recent searches
// ---------------------------------------------------------------------------

export const RECENT_SEARCHES_KEY = "okwu.dictrecent.v1";
export const MAX_RECENT = 8;

export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const q of v) {
      if (typeof q !== "string") continue;
      const t = nfc(q).trim().slice(0, 64);
      if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    }
    return out.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Newest first, no duplicates (case-insensitive), at most MAX_RECENT. */
export function pushRecent(list: readonly string[], query: string): string[] {
  const q = nfc(query).trim().replace(/\s+/g, " ").slice(0, 64);
  if (!q) return [...list];
  return [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
}

/** Starting points for an empty search: English words, and one Igbo word typed without its dot. */
export const SUGGESTED_SEARCHES: readonly string[] = ["kedu", "thank you", "market", "water", "mother", "yam", "friend", "house"];

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export function entries(index: DictionaryIndex): DictionaryEntry[] {
  return index.keyed.map((k) => k.entry);
}

export function entryById(index: DictionaryIndex, id: string): DictionaryEntry | null {
  return index.keyed.find((k) => k.entry.id === id)?.entry ?? null;
}

function dayNumber(day: string): number {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
}

/** Good for a word of the day: tone-marked, recorded, a short plain meaning, not an affix or a name. */
export function wordOfTheDayCandidate(e: DictionaryEntry): boolean {
  return !!e.toned && !!e.audio && !e.affix && !e.name && e.gloss.length > 0 && e.gloss.length <= 48 && !/[()]/.test(e.gloss) && !e.spelling.includes(" ") && pitchOf(e.toned) !== null;
}

/** The dictionary's word of the day: the same all day, a different word tomorrow. */
export function dictionaryWordOfTheDay(index: DictionaryIndex, day: string): DictionaryEntry | null {
  const pool = entries(index)
    .filter(wordOfTheDayCandidate)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (pool.length === 0) return null;
  // A stride through the pool so neighbouring days are not alphabetical neighbours.
  const i = (dayNumber(day) * 7919) % pool.length;
  return pool[i] ?? null;
}

/** "market; a place were things are sold" → ["Market", "A place were things are sold"]. */
export function definitionsOf(gloss: string): string[] {
  const parts = gloss
    .split(/\s*;\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const cap = p.charAt(0).toUpperCase() + p.slice(1);
    if (!out.some((o) => o.toLowerCase() === cap.toLowerCase())) out.push(cap);
  }
  return out;
}

export interface Pitch {
  tones: Tone[];
  syllables: string[];
  label: string;
}

/** The pitch line for a tone-marked headword, or null when any syllable is unmarked. */
export function pitchOf(toned: string | null): Pitch | null {
  if (!toned) return null;
  const parsed = parseToneText(nfc(toned));
  if (!parsed.complete || parsed.syllables.length === 0 || parsed.syllables.length > 12) return null;
  const syllables = parsed.syllables.map((s) => ({ text: s.text, tone: s.tone as Tone }));
  const tones = syllables.map((s) => s.tone);
  return { tones, syllables: markedSyllables(syllables), label: describeTones(tones) };
}

/** Part of speech in words: the source's own word class when it has one. */
export function wordClassLabel(entry: Pick<DictionaryEntry, "pos" | "name" | "affix">, details: Pick<WordDetails, "wordClass"> = NO_DETAILS): string | null {
  if (details.wordClass) return details.wordClass;
  if (entry.name) return "Name";
  if (entry.affix) return "Affix";
  return entry.pos ? entry.pos.charAt(0).toUpperCase() + entry.pos.slice(1) : null;
}

export interface VariantLine {
  /** NFC spelling as recorded. */
  spelling: string;
  /** Dialects that say it this way, alphabetical (never ranked). */
  dialects: { id: string; label: string }[];
  /** "Ọnịcha, Obosi". */
  where: string;
  audio: string | null;
}

const sortKey = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** "Also said as …" lines, leaving out forms that only repeat the headword without a recording. */
export function variantLines(entry: DictionaryEntry, labels: Record<string, string>, details: WordDetails = NO_DETAILS): VariantLine[] {
  const head = igboKey(entry.spelling);
  const out: VariantLine[] = [];
  entry.variants.forEach((v, i) => {
    const audio = details.variantAudio[i] ?? null;
    if (igboKey(v.spelling) === head && !audio) return;
    const dialects = v.dialects.map((id) => ({ id, label: labels[id] ?? id })).sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label)));
    out.push({ spelling: nfc(v.spelling), dialects, where: dialects.map((d) => d.label).join(", "), audio });
  });
  return out;
}

export function examplesOf(details: WordDetails): WordExample[] {
  return details.examples;
}

/** Why a result matched, in words, when it is not the plain headword. */
export function matchNote(hit: DictionaryHit, labels: Record<string, string>): string | null {
  switch (hit.match) {
    case "without-dots":
      return `Mind the dots: ${nfc(hit.entry.spelling)}`;
    case "dialect-form": {
      const v = hit.entry.variants.find((x) => x.spelling === hit.form);
      const where = (v?.dialects ?? []).map((d) => labels[d] ?? d).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      if (where.length === 0) return `Regional form ${hit.form}`;
      if (where.length <= 3) return `${hit.form} in ${where.join(", ")}`;
      return `${hit.form} in ${where.slice(0, 2).join(", ")} and ${where.length - 2} more`;
    }
    case "english":
      return null;
    default:
      return null;
  }
}

/** True when the typed query has no dots but the word has them (for a gentle "mind the dot" note). */
export function droppedDots(query: string, entry: DictionaryEntry): boolean {
  const q = igboKey(query);
  return q.length > 0 && q === stripDots(q) && stripDots(igboKey(entry.spelling)) === q && igboKey(entry.spelling) !== q;
}
