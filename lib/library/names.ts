// The names book's pure logic (names.test.ts): search, theme sections and
// the names that belong to a market day. Data comes from ./index.
import type { MarketDay } from "@/lib/game/types";
import type { LibraryName, NameTheme, NameThemeInfo } from "./types";

/** Fold for matching: NFC, no tone marks, no dots, lower case, letters and digits only. */
export function fold(text: string): string {
  return text
    .normalize("NFC")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Long vowels and doubled consonants written once: "okeeke" meets "okeke". */
const single = (s: string) => s.replace(/(.)\1+/g, "$1");

export type NameMatch = "name" | "variant" | "meaning";

export interface NameHit {
  name: LibraryName;
  via: NameMatch;
  /** The regional form that matched (via "variant"). */
  variant?: string;
  score: number;
}

/** Every written form of a name: its everyday spelling, the dataset's spelling and the tone-marked form. */
function formsOf(n: LibraryName): string[] {
  return [n.spelling, n.datasetSpelling, n.toned].filter((s): s is string => !!s).map(fold);
}

/**
 * Search the names book. Tone marks and dots are optional ("ifeoma" finds
 * Ifeọma, "okeke" finds Okeeke), regional forms match ("oyè" finds the Orie
 * names' variants), and English searches the meanings ("journey").
 */
export function searchNames(names: readonly LibraryName[], query: string, limit = 40): NameHit[] {
  const q = fold(query);
  if (!q) return [];
  const qs = single(q.replace(/ /g, ""));
  const words = q.split(" ").filter((w) => w.length >= 3);
  const hits: NameHit[] = [];
  for (const n of names) {
    let best: NameHit | null = null;
    for (const f of formsOf(n)) {
      const fs = single(f.replace(/ /g, ""));
      const score = fs === qs ? 100 : fs.startsWith(qs) ? 80 - Math.min(20, fs.length - qs.length) : fs.includes(qs) ? 50 : 0;
      if (score && (!best || score > best.score)) best = { name: n, via: "name", score };
    }
    if (!best) {
      for (const v of n.variants) {
        const fs = single(fold(v.spelling).replace(/ /g, ""));
        if (fs === qs || (qs.length >= 3 && fs.startsWith(qs))) {
          best = { name: n, via: "variant", variant: v.spelling, score: fs === qs ? 40 : 30 };
          break;
        }
      }
    }
    if (!best && words.length && n.meaning) {
      const m = ` ${fold(n.meaning)} `;
      // Whole English words (or their plural), so "chi" doesn't find "child".
      if (words.every((w) => m.includes(` ${w} `) || m.includes(` ${w}s `))) best = { name: n, via: "meaning", score: 10 };
    }
    if (best) hits.push(best);
  }
  return hits.sort((a, b) => b.score - a.score || compareNames(a.name, b.name)).slice(0, limit);
}

/** Alphabetical, the way a names book is ordered (tones and dots ignored). */
export function compareNames(a: LibraryName, b: LibraryName): number {
  const fa = fold(a.spelling);
  const fb = fold(b.spelling);
  return fa < fb ? -1 : fa > fb ? 1 : 0;
}

export interface NameSection {
  theme: NameThemeInfo;
  names: LibraryName[];
}

/** The book's sections in theme order, each alphabetical; `only` keeps one theme. */
export function nameSections(themes: readonly NameThemeInfo[], names: readonly LibraryName[], only?: NameTheme | null): NameSection[] {
  return themes
    .filter((t) => !only || t.id === only)
    .map((theme) => ({ theme, names: names.filter((n) => n.theme === theme.id).sort(compareNames) }))
    .filter((s) => s.names.length > 0);
}

/** Names given to children born on a market day, in the order the calendar lists them. */
export function namesForDay(names: readonly LibraryName[], ids: readonly string[], day: MarketDay): LibraryName[] {
  const byId = new Map(names.map((n) => [n.id, n]));
  return ids.map((id) => byId.get(id)).filter((n): n is LibraryName => !!n && n.day === day);
}

/** The label under a name in a list: its meaning, or the honest pending line. */
export function meaningLine(n: Pick<LibraryName, "short" | "meaning">): string {
  return n.short ?? n.meaning ?? MEANING_PENDING;
}

export const MEANING_PENDING = "Meaning pending review";
