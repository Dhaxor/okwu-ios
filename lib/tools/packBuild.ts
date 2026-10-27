// Building the offline pack list, pure (packBuild.test.ts). The script is
// scripts/tools/build-packs.ts; it writes lib/tools/generated/packs.json.
//
// Packs come from the audio lists the content builds write:
//   content/exports/course-audio-needs.txt   the course (grouped into unit packs)
//   content/phrasebook/audio-needs.txt       the phrasebook (one pack)
//   content/library/audio-needs.txt          the culture library (one pack)
// The list format is read tolerantly: one clip per line, "#" comments,
// fields split by tabs, commas or spaces. A line names a clip by its R2 key
// ("audio/…/x.m4a"), a dataset AudioId ("ia_…", "iax_…", stored under
// audio/igboapi/) or a recording code ("l1_u03_w045_f_natural_t2", under
// audio/v1/); a unit id ("u03", or an item id "u03.…") on the line puts it
// in that unit's pack, else the content bundle says which unit uses it.
// A list that does not exist yet is fine: the course falls back to the
// recorded clips in the bundle, and the other packs show as on their way.
import type { AudioRef, ContentBundle, Item } from "@/lib/content/types";
import { datasetClipKey, normalizeAudioKey } from "@/lib/content/localAudio";
import { courseUnits } from "./decks";
import type { PackDef, PackKind, PacksManifest } from "./offline";

export const NEEDS_FILES: Record<"course" | "phrasebook" | "library", string> = {
  course: "content/exports/course-audio-needs.txt",
  phrasebook: "content/phrasebook/audio-needs.txt",
  library: "content/library/audio-needs.txt",
};

/** 64 kbps mono AAC is about 8 bytes a millisecond, plus the container. */
export const BYTES_PER_MS = 8;
export const CONTAINER_BYTES = 2_048;
/** A clip of unknown length: a short word or phrase. */
export const DEFAULT_CLIP_BYTES = 20_000;

const DATASET_ID = /^iax?_[A-Za-z0-9-]{8,96}$/;
const RECORDING_CODE = /^l\d+_u\d+_[A-Za-z0-9-]+_[fm]_(natural|slow)_t\d+$/;
const KEY = /^\/?audio\/[^\s,]+\.(m4a|mp3|aac|wav|caf)$/i;
const UNIT = /^u\d{2,}$/;
const ITEM_UNIT = /^(u\d{2,})\.[^\s]+$/;

export interface NeedsLine {
  key: string;
  unit: string | null;
}

/** One clip per line; anything unreadable is skipped (and counted). */
export function parseNeeds(text: string): { lines: NeedsLine[]; skipped: number } {
  const lines: NeedsLine[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const rawLine of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const tokens = line
      .split(/[\t,]+|\s+/)
      .map((t) => t.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    let key: string | null = null;
    let unit: string | null = null;
    for (const t of tokens) {
      if (!key && KEY.test(t)) key = normalizeAudioKey(t);
      else if (!key && DATASET_ID.test(t)) key = datasetClipKey(t);
      else if (!key && RECORDING_CODE.test(t)) key = `audio/v1/${t}.m4a`;
      if (!unit && UNIT.test(t)) unit = t;
      else if (!unit && ITEM_UNIT.test(t)) unit = (ITEM_UNIT.exec(t) as RegExpExecArray)[1] as string;
    }
    // A dataset path ("audio/archive-0/x.mp3") is not where the app reads a clip: prefer the AudioId when the line has one.
    if (key && !key.startsWith("audio/igboapi/") && !key.startsWith("audio/v1/")) {
      const id = tokens.find((t) => DATASET_ID.test(t));
      if (id) key = datasetClipKey(id);
    }
    if (!key) {
      skipped++;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ key, unit });
  }
  return { lines, skipped };
}

/** A clip the app could play once hosted: a human recording with a file (hashed), not failed in QA. */
export function recorded(ref: AudioRef): boolean {
  return ref.sha256.length > 0 && ref.synthetic === false && ref.qa.status !== "failed";
}

function refsOf(item: Item): AudioRef[] {
  return [...item.audio, ...item.dialects.flatMap((d) => d.audio)];
}

/** Every unit's items (introduced or used in its exercises), in course order. */
function unitItems(bundle: ContentBundle, track?: string): { unit: string; items: string[] }[] {
  return courseUnits(bundle, track).map((u) => {
    const ids = new Set<string>();
    for (const l of u.lessons) {
      const lesson = bundle.lessons[l];
      if (!lesson) continue;
      for (const id of lesson.introduces) ids.add(id);
      for (const ex of lesson.exercises) for (const id of ex.items) ids.add(id);
    }
    return { unit: u.id as string, items: [...ids] };
  });
}

export interface SizeInfo {
  bytes: number;
  exact: boolean;
}

export interface BuildInput {
  bundle: ContentBundle;
  /** File text of each list, or null when the file does not exist. */
  course: string | null;
  phrasebook: string | null;
  library: string | null;
  /** The exact size of a clip when the local cache has it. */
  cachedSize: (key: string) => number | null;
  builtAt: string;
}

export interface BuildReport {
  manifest: PacksManifest;
  /** Course clips no unit claims (listed, but not used by any unit in the bundle). */
  unassigned: string[];
  skippedLines: number;
}

export function buildPacks(input: BuildInput): BuildReport {
  const { bundle } = input;
  const durations = new Map<string, number>();
  for (const item of Object.values(bundle.items)) for (const r of refsOf(item)) if (r.durationMs > 0) durations.set(normalizeAudioKey(r.key), r.durationMs);
  const size = (key: string): SizeInfo => {
    const exact = input.cachedSize(key);
    if (exact !== null && exact > 0) return { bytes: exact, exact: true };
    const ms = durations.get(key);
    return { bytes: ms ? Math.round(ms * BYTES_PER_MS + CONTAINER_BYTES) : DEFAULT_CLIP_BYTES, exact: false };
  };

  const units = unitItems(bundle);
  const keyUnit = new Map<string, string>();
  const bundleKeys = new Map<string, string[]>();
  for (const { unit, items } of units) {
    const keys: string[] = [];
    for (const id of items) {
      const item = bundle.items[id];
      if (!item || item.status === "retired") continue;
      for (const r of refsOf(item)) {
        const key = normalizeAudioKey(r.key);
        if (!keyUnit.has(key)) keyUnit.set(key, unit);
        if (recorded(r) && !keys.includes(key)) keys.push(key);
      }
    }
    bundleKeys.set(unit, keys);
  }

  const sources: Record<string, string> = {};
  let skippedLines = 0;
  const unassigned: string[] = [];
  const perUnit = new Map<string, string[]>();
  if (input.course !== null) {
    sources.course = "found";
    const parsed = parseNeeds(input.course);
    skippedLines += parsed.skipped;
    for (const l of parsed.lines) {
      const unit = l.unit && bundle.units[l.unit] ? l.unit : (keyUnit.get(l.key) ?? null);
      if (!unit) {
        unassigned.push(l.key);
        continue;
      }
      const list = perUnit.get(unit) ?? [];
      list.push(l.key);
      perUnit.set(unit, list);
    }
  } else {
    sources.course = "bundle";
    for (const [unit, keys] of bundleKeys) perUnit.set(unit, keys);
  }

  const packs: PackDef[] = [];
  const pending: PackKind[] = [];
  const make = (id: string, kind: PackKind, title: string, detail: string, keys: readonly string[], unit?: string): PackDef => {
    const files = keys.map((key) => ({ key, ...size(key) }));
    return {
      id,
      kind,
      title,
      detail,
      ...(unit ? { unit } : {}),
      files: files.map(({ key, bytes }) => ({ key, bytes })),
      bytes: files.reduce((n, f) => n + f.bytes, 0),
      estimated: files.some((f) => !f.exact),
    };
  };
  for (const u of courseUnits(bundle)) {
    const keys = perUnit.get(u.id) ?? [];
    if (keys.length === 0) continue;
    packs.push(make(`unit-${u.id}`, "unit", u.title, `Unit ${u.index + 1}`, keys, u.id)); // the Learn path's numbering (u00 is Unit 1)
  }
  for (const kind of ["phrasebook", "library"] as const) {
    const text = input[kind];
    if (text === null) {
      sources[kind] = "missing";
      pending.push(kind);
      continue;
    }
    sources[kind] = "found";
    const parsed = parseNeeds(text);
    skippedLines += parsed.skipped;
    if (parsed.lines.length === 0) {
      pending.push(kind);
      continue;
    }
    packs.push(
      make(
        kind,
        kind,
        kind === "phrasebook" ? "Phrasebook" : "Culture library",
        kind === "phrasebook" ? "Everyday phrases" : "Stories, proverbs and culture",
        parsed.lines.map((l) => l.key)
      )
    );
  }
  return { manifest: { version: 1, builtAt: input.builtAt, sources, packs, pending }, unassigned, skippedLines };
}
