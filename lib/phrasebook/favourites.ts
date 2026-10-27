// Favourite phrases, kept on the device (okwu.phrasefavs.v1). Pure
// (favourites.test.ts); the hook that holds and persists them is in
// ./hooks.ts. Newest first, no duplicates, read defensively.
export const FAVOURITES_KEY = "okwu.phrasefavs.v1";
/** Plenty for a personal phrase list, and a bound on what a bad write can grow to. */
export const MAX_FAVOURITES = 500;

/** Phrase ids are dataset sentence ids: "ia.x.<id>" (examples) or "ia.s.<id>" (expansion). */
const ID = /^ia\.[xs]\.[A-Za-z0-9-]{4,96}$/;

export function parseFavourites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const id of v) {
      if (typeof id === "string" && ID.test(id) && !out.includes(id)) out.push(id);
      if (out.length >= MAX_FAVOURITES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function isFavourite(list: readonly string[], id: string): boolean {
  return list.includes(id);
}

/** Add to the front, or remove when already there. */
export function toggleFavourite(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [id, ...list].slice(0, MAX_FAVOURITES);
}
