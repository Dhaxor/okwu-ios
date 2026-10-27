// The Culture and heritage library (engineer E2): data access for the
// screens in app/library. Pure TypeScript (bun-tested); the hooks that
// persist and play live in ./useLibrary.ts.
//
// Data: ./generated/*.json, compiled by `bun scripts/library/build.ts` from
// content/library/*.yaml and the Igbo API dataset. Each file loads on first
// use, so a screen pays only for what it shows. Every Igbo string is dataset
// text; our English is pending cultural-advisor review (see `REVIEW_NOTE`).
import type { CalendarFile, CustomsFile, LibraryCustom, LibraryMeta, LibraryName, LibraryProverb, LibraryTale, NamesFile, ProverbTheme, ProverbsFile, TalesFile } from "./types";

export type * from "./types";
export * from "./names";
export * from "./calendar";
export * from "./familyNames";

let names: NamesFile | null = null;
let proverbs: ProverbsFile | null = null;
let tales: TalesFile | null = null;
let customs: CustomsFile | null = null;
let calendar: CalendarFile | null = null;
let meta: LibraryMeta | null = null;

export function namesFile(): NamesFile {
  return (names ??= require("./generated/names.json") as NamesFile);
}
export function proverbsFile(): ProverbsFile {
  return (proverbs ??= require("./generated/proverbs.json") as ProverbsFile);
}
export function talesFile(): TalesFile {
  return (tales ??= require("./generated/tales.json") as TalesFile);
}
export function customsFile(): CustomsFile {
  return (customs ??= require("./generated/customs.json") as CustomsFile);
}
export function calendarFile(): CalendarFile {
  return (calendar ??= require("./generated/calendar.json") as CalendarFile);
}
export function libraryMeta(): LibraryMeta {
  return (meta ??= require("./generated/meta.json") as LibraryMeta);
}

/** Which library edition a learner saw, for content reports. */
export const libraryVersion = (): string => `library ${libraryMeta().builtAt}`;

export const nameById = (id: string): LibraryName | undefined => namesFile().names.find((n) => n.id === id);
export const proverbById = (id: string): LibraryProverb | undefined => proverbsFile().proverbs.find((p) => p.id === id);
export const taleById = (id: string): LibraryTale | undefined => talesFile().tales.find((t) => t.id === id);
export const customById = (id: string): LibraryCustom | undefined => customsFile().customs.find((c) => c.id === id);

/** The item after `id` in a list, wrapping to the first. */
export function nextOf<T extends { id: string }>(list: readonly T[], id: string): T | null {
  if (list.length < 2) return null;
  const i = list.findIndex((x) => x.id === id);
  return list[(i + 1) % list.length] ?? null;
}

/** A stable small hash of a string (FNV-1a), for the proverb of the day. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The same proverb all day, a different one tomorrow; only proverbs with a drafted meaning are featured. */
export function proverbOfTheDay(list: readonly LibraryProverb[], dayKey: string): LibraryProverb | null {
  const pool = list.filter((p) => p.meaning);
  if (pool.length === 0) return list[0] ?? null;
  return pool[hash(`ilu:${dayKey}`) % pool.length] ?? null;
}

export function proverbsInTheme(list: readonly LibraryProverb[], theme: ProverbTheme | null): LibraryProverb[] {
  return theme ? list.filter((p) => p.theme === theme) : [...list];
}

/** Shown wherever our English (meanings, retellings, explainers) appears. */
export const REVIEW_NOTE = "Pending cultural review";
/** Shown wherever dataset entries appear unreviewed. */
export const DATASET_NOTE = "From the Nkọwa okwu dataset · not yet reviewed by Okwu";
export const SOURCE_LINE = "Igbo text and recordings: Nkọwa okwu (Igbo API), CC BY 4.0, used with permission. Not yet reviewed by Okwu.";
