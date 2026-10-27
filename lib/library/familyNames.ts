// "Your family's names": names a learner keeps from the names book, or adds
// in their own family's spelling. On this device only (okwu.familynames.v1),
// never synced or shared. Pure (familyNames.test.ts); the hook that persists
// it is in ./useFamilyNames.ts.
import { graphemeCount, nfc } from "@/lib/igbo/text";
import { fold } from "./names";
import type { LibraryName } from "./types";

export const FAMILY_NAMES_KEY = "okwu.familynames.v1";
export const MAX_FAMILY_NAMES = 40;
export const MAX_NAME_GRAPHEMES = 40;
export const MAX_NOTE_GRAPHEMES = 60;

export interface FamilyName {
  /** "book:<name id>" for a name from the book, "own:<time>" for one the learner typed. */
  id: string;
  /** The name as the family writes it (NFC). */
  name: string;
  /** Who carries it, in the learner's words ("my grandmother"); may be empty. */
  note: string;
  /** The names-book entry, when it came from the book. */
  bookId: string | null;
  savedAt: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? nfc(v).replace(/\s+/g, " ").trim() : "").slice(0, max * 4);

/** Never throws: anything unreadable is dropped. */
export function parseFamilyNames(raw: string | null): FamilyName[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: FamilyName[] = [];
    for (const x of v) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const id = typeof o.id === "string" && /^(book|own):[\w.:-]{1,80}$/.test(o.id) ? o.id : null;
      const name = str(o.name, MAX_NAME_GRAPHEMES);
      if (!id || !name || graphemeCount(name) > MAX_NAME_GRAPHEMES) continue;
      if (out.some((f) => f.id === id)) continue;
      out.push({
        id,
        name,
        note: str(o.note, MAX_NOTE_GRAPHEMES),
        bookId: typeof o.bookId === "string" ? o.bookId : null,
        savedAt: typeof o.savedAt === "string" ? o.savedAt : "",
      });
      if (out.length >= MAX_FAMILY_NAMES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function isSaved(list: readonly FamilyName[], bookId: string): boolean {
  return list.some((f) => f.bookId === bookId);
}

/** Keep a name from the book (newest first); saving it twice changes nothing. */
export function saveBookName(list: readonly FamilyName[], name: Pick<LibraryName, "id" | "spelling">, now: Date): FamilyName[] {
  if (isSaved(list, name.id)) return [...list];
  const entry: FamilyName = { id: `book:${name.id}`, name: name.spelling, note: "", bookId: name.id, savedAt: now.toISOString() };
  return [entry, ...list].slice(0, MAX_FAMILY_NAMES);
}

export type AddNameResult = { ok: true; list: FamilyName[]; entry: FamilyName } | { ok: false; error: string };

/** Add a name in the family's own spelling, with an optional note on who carries it. */
export function addOwnName(list: readonly FamilyName[], name: string, note: string, now: Date): AddNameResult {
  const n = nfc(name).replace(/\s+/g, " ").trim();
  const w = nfc(note).replace(/\s+/g, " ").trim();
  if (!n) return { ok: false, error: "Type the name first." };
  if (graphemeCount(n) > MAX_NAME_GRAPHEMES) return { ok: false, error: `Keep the name under ${MAX_NAME_GRAPHEMES} letters.` };
  if (graphemeCount(w) > MAX_NOTE_GRAPHEMES) return { ok: false, error: `Keep the note under ${MAX_NOTE_GRAPHEMES} letters.` };
  if (list.some((f) => fold(f.name) === fold(n))) return { ok: false, error: "That name is already in your list." };
  if (list.length >= MAX_FAMILY_NAMES) return { ok: false, error: `Your list holds up to ${MAX_FAMILY_NAMES} names.` };
  const entry: FamilyName = { id: `own:${now.getTime()}`, name: n, note: w, bookId: null, savedAt: now.toISOString() };
  return { ok: true, list: [entry, ...list], entry };
}

export function removeFamilyName(list: readonly FamilyName[], id: string): FamilyName[] {
  return list.filter((f) => f.id !== id);
}

/** The names-book entry a typed name matches, if any (so the list can show its meaning). */
export function bookMatch(names: readonly LibraryName[], typed: string): LibraryName | null {
  const t = fold(typed);
  if (!t) return null;
  return names.find((n) => [n.spelling, n.datasetSpelling, n.toned].some((s) => s && fold(s) === t)) ?? null;
}
