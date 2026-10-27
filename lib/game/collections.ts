// Collections (docs/CONTRACTS.md §3): Ilu (proverb cards), Aha (name cards)
// and Akụkọ (story chapters). A proverb or name is collected the first time
// the learner meets it as a new item; a chapter, the first time it is read.
//
// The real ids come from owner A's content (items tagged as proverbs and
// names, and graded stories). Until then PLACEHOLDER_CATALOG stands in, and
// screens pass the real catalog to createGameEngine({ catalog }).
import type { ItemId, StoryId } from "@/lib/content/types";
import type { CollectionCatalog, CollectionEntry, CollectionKind, CollectionsView, GameEffect } from "./types";

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`);

/** Placeholder ids (no Igbo): replaced by A's content ids. */
export const PLACEHOLDER_CATALOG: CollectionCatalog = {
  ilu: ids("placeholder-ilu", 12),
  aha: ids("placeholder-aha", 12),
  akuko: [
    { story: "placeholder-akuko-1", chapters: 4 },
    { story: "placeholder-akuko-2", chapters: 3 },
  ],
};

export function chapterId(story: string, chapter: number): string {
  return `${story}:${chapter}`;
}

function entryId(e: CollectionEntry): string {
  return "item" in e.ref ? e.ref.item : chapterId(e.ref.story, e.ref.chapter);
}

export function hasEntry(entries: readonly CollectionEntry[], kind: CollectionKind, id: string): boolean {
  return entries.some((e) => e.kind === kind && entryId(e) === id);
}

/** Collect a proverb or name the learner just met (no-op for other items and repeats). */
export function collectItem(
  entries: CollectionEntry[],
  item: string,
  catalog: CollectionCatalog,
  nowIso: string
): { entries: CollectionEntry[]; effects: GameEffect[] } {
  const kind: CollectionKind | null = catalog.ilu.includes(item) ? "ilu" : catalog.aha.includes(item) ? "aha" : null;
  if (!kind || hasEntry(entries, kind, item)) return { entries, effects: [] };
  const entry: CollectionEntry = { kind, ref: { item: item as ItemId }, unlockedAt: nowIso };
  return { entries: [...entries, entry], effects: [{ kind: "collection", entry }] };
}

/** Collect a story chapter (first read only). */
export function collectChapter(
  entries: CollectionEntry[],
  story: string,
  chapter: number,
  nowIso: string
): { entries: CollectionEntry[]; effects: GameEffect[]; first: boolean } {
  if (hasEntry(entries, "akuko", chapterId(story, chapter))) return { entries, effects: [], first: false };
  const entry: CollectionEntry = { kind: "akuko", ref: { story: story as StoryId, chapter }, unlockedAt: nowIso };
  return { entries: [...entries, entry], effects: [{ kind: "collection", entry }], first: true };
}

/** Every slot in the catalog, unlocked or waiting, plus anything collected outside it. */
export function collectionsView(entries: readonly CollectionEntry[], catalog: CollectionCatalog): CollectionsView {
  const when = new Map(entries.map((e) => [`${e.kind}|${entryId(e)}`, e.unlockedAt]));
  const slots = (kind: CollectionKind, all: readonly string[]) => {
    const extra = entries.filter((e) => e.kind === kind && !all.includes(entryId(e))).map(entryId);
    return [...all, ...extra].map((id) => ({ kind, id, unlockedAt: when.get(`${kind}|${id}`) ?? null }));
  };
  return {
    ilu: slots("ilu", catalog.ilu),
    aha: slots("aha", catalog.aha),
    akuko: slots(
      "akuko",
      catalog.akuko.flatMap((s) => Array.from({ length: s.chapters }, (_, i) => chapterId(s.story, i + 1)))
    ),
  };
}
