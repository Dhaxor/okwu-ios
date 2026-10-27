// Flashcard decks, pure (decks.test.ts). The hook is ./useDecks.ts.
//
// A card is a word the learner can study with the app's one FSRS-6
// scheduler: a course item (its ItemId) or a dictionary word ("dict:<id>",
// with a snapshot of the headword so a deck opens without the dictionary).
// Studying a card reviews the same FSRS card a lesson would, through
// usePlay().answer with a flashcard exercise (`flashExercise`), so a word
// studied here is a word the daily review already knows about.
//
// Built-in decks come from the content bundle: one per unit, "Tricky
// words" (answered "not yet" lately) and "Tone pairs" (minimal sets). The
// learner's own decks live in okwu.decks.v1.
//
// Faces: Igbo → English, English → Igbo, or listen first. Tone marks follow
// the Settings preference (shown, tap to see, hidden). Nothing here writes
// Igbo: every string is an approved item or a dictionary headword.
import { allowsUnreviewedAudio, hasPlayableAudio, isUsable, minimalSets, needsDraftTag, pitchLineFor, toneMarked } from "@/lib/content";
import type { DictionaryEntry } from "@/lib/content";
import type { ContentBundle, ExerciseSpec, Item, ItemId, Tone, Unit } from "@/lib/content/types";
import { cardKey, facetsFor, itemMastery, type Exercise, type Facet, type FsrsCard, type MasteryLevel, type Progress, type Rating, type ReviewLog, type Scheduler } from "@/lib/learning";
import { graphemeCount, nfc } from "@/lib/igbo";
import { pitchOf } from "@/lib/state/dictionary";

export const DECKS_KEY = "okwu.decks.v1";

/** The prefix of a dictionary word's card id (course items use their ItemId). */
export const DICT_PREFIX = "dict:";

export type StudyFace = "ig-en" | "en-ig" | "audio";
export const STUDY_FACES: readonly StudyFace[] = ["ig-en", "en-ig", "audio"];
export const FACE_LABELS: Record<StudyFace, string> = { "ig-en": "Igbo first", "en-ig": "English first", audio: "Listen first" };

/** What the learner saved from the dictionary: enough to show and play the card. */
export interface WordSnapshot {
  id: string;
  /** Spelling layer (NFC). */
  spelling: string;
  /** Tone-marked headword, or null while tones are pending. */
  toned: string | null;
  gloss: string;
  /** Dataset AudioId, or null. */
  audio: string | null;
}

export interface DeckEntry {
  /** ItemId, or "dict:<entry id>". Also the FSRS card's item. */
  ref: string;
  addedAt: string;
}

export interface UserDeck {
  id: string;
  name: string;
  createdAt: string;
  cards: DeckEntry[];
}

export interface DecksFile {
  version: 1;
  decks: UserDeck[];
  /** Dictionary words saved to any deck, by entry id (kept so a card always renders). */
  words: Record<string, WordSnapshot>;
  /** The face last studied with. */
  face: StudyFace;
}

export const EMPTY_DECKS: DecksFile = { version: 1, decks: [], words: {}, face: "ig-en" };

export const MAX_DECKS = 50;
export const MAX_CARDS_PER_DECK = 500;
export const MAX_DECK_NAME = 40;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function parseWord(v: unknown): WordSnapshot | null {
  if (!isObj(v) || typeof v.id !== "string" || !v.id || typeof v.spelling !== "string" || !v.spelling.trim() || typeof v.gloss !== "string") return null;
  return { id: v.id, spelling: nfc(v.spelling), toned: str(v.toned) ? nfc(v.toned as string) : null, gloss: v.gloss, audio: str(v.audio) || null };
}

/** Read okwu.decks.v1. Never throws; anything unreadable drops out, field by field. */
export function parseDecks(raw: string | null | undefined): DecksFile {
  if (!raw) return { ...EMPTY_DECKS, decks: [], words: {} };
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ...EMPTY_DECKS, decks: [], words: {} };
  }
  if (!isObj(v)) return { ...EMPTY_DECKS, decks: [], words: {} };
  const words: Record<string, WordSnapshot> = {};
  if (isObj(v.words))
    for (const [k, w] of Object.entries(v.words)) {
      const p = parseWord(w);
      if (p && p.id === k) words[k] = p;
    }
  const decks: UserDeck[] = [];
  const ids = new Set<string>();
  if (Array.isArray(v.decks)) {
    for (const d of v.decks) {
      if (!isObj(d) || typeof d.id !== "string" || !d.id || ids.has(d.id) || typeof d.name !== "string") continue;
      const name = cleanDeckName(d.name);
      if (!name) continue;
      const seen = new Set<string>();
      const cards: DeckEntry[] = [];
      if (Array.isArray(d.cards)) {
        for (const c of d.cards) {
          if (!isObj(c) || typeof c.ref !== "string" || !c.ref || seen.has(c.ref)) continue;
          if (c.ref.startsWith(DICT_PREFIX) && !words[c.ref.slice(DICT_PREFIX.length)]) continue;
          seen.add(c.ref);
          cards.push({ ref: c.ref, addedAt: isIso(c.addedAt) ? c.addedAt : new Date(0).toISOString() });
          if (cards.length >= MAX_CARDS_PER_DECK) break;
        }
      }
      ids.add(d.id);
      decks.push({ id: d.id, name, createdAt: isIso(d.createdAt) ? d.createdAt : new Date(0).toISOString(), cards });
      if (decks.length >= MAX_DECKS) break;
    }
  }
  const face = STUDY_FACES.includes(v.face as StudyFace) ? (v.face as StudyFace) : "ig-en";
  return { version: 1, decks, words, face };
}

export function serializeDecks(file: DecksFile): string {
  return JSON.stringify(file);
}

/** A deck name as stored: NFC, single spaces, at most MAX_DECK_NAME graphemes. "" when empty. */
export function cleanDeckName(name: string): string {
  const t = nfc(name).replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (graphemeCount(t) <= MAX_DECK_NAME) return t;
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)].map((s) => s.segment) : [...t];
  return seg.slice(0, MAX_DECK_NAME).join("").trim();
}

// ---------------------------------------------------------------------------
// Editing the learner's decks
// ---------------------------------------------------------------------------

export function newDeckId(now: Date, salt = Math.random()): string {
  return `d_${now.getTime().toString(36)}${Math.floor(salt * 1296)
    .toString(36)
    .padStart(2, "0")}`;
}

export function createDeck(file: DecksFile, name: string, now: Date, id = newDeckId(now)): { file: DecksFile; deck: UserDeck | null } {
  const clean = cleanDeckName(name);
  if (!clean || file.decks.length >= MAX_DECKS || file.decks.some((d) => d.id === id)) return { file, deck: null };
  const deck: UserDeck = { id, name: clean, createdAt: now.toISOString(), cards: [] };
  return { file: { ...file, decks: [...file.decks, deck] }, deck };
}

export function renameDeck(file: DecksFile, id: string, name: string): DecksFile {
  const clean = cleanDeckName(name);
  if (!clean) return file;
  return { ...file, decks: file.decks.map((d) => (d.id === id ? { ...d, name: clean } : d)) };
}

export function deleteDeck(file: DecksFile, id: string): DecksFile {
  return pruneWords({ ...file, decks: file.decks.filter((d) => d.id !== id) });
}

/** Drop dictionary snapshots no deck uses any more (FSRS cards keep their history regardless). */
function pruneWords(file: DecksFile): DecksFile {
  const used = new Set(
    file.decks
      .flatMap((d) => d.cards.map((c) => c.ref))
      .filter((r) => r.startsWith(DICT_PREFIX))
      .map((r) => r.slice(DICT_PREFIX.length))
  );
  const words = Object.fromEntries(Object.entries(file.words).filter(([k]) => used.has(k)));
  return Object.keys(words).length === Object.keys(file.words).length ? file : { ...file, words };
}

/** Add cards to a deck (deduped, in order, up to the cap). Dictionary words bring their snapshot. */
export function addCards(file: DecksFile, deckId: string, refs: readonly string[], now: Date, words: readonly WordSnapshot[] = []): DecksFile {
  const deck = file.decks.find((d) => d.id === deckId);
  if (!deck) return file;
  const snaps = { ...file.words };
  for (const w of words) snaps[w.id] = w;
  const have = new Set(deck.cards.map((c) => c.ref));
  const added: DeckEntry[] = [];
  for (const ref of refs) {
    if (have.has(ref) || deck.cards.length + added.length >= MAX_CARDS_PER_DECK) continue;
    if (ref.startsWith(DICT_PREFIX) && !snaps[ref.slice(DICT_PREFIX.length)]) continue;
    have.add(ref);
    added.push({ ref, addedAt: now.toISOString() });
  }
  if (added.length === 0 && words.length === 0) return file;
  return { ...file, words: snaps, decks: file.decks.map((d) => (d.id === deckId ? { ...d, cards: [...d.cards, ...added] } : d)) };
}

export function removeCards(file: DecksFile, deckId: string, refs: readonly string[]): DecksFile {
  const drop = new Set(refs);
  return pruneWords({ ...file, decks: file.decks.map((d) => (d.id === deckId ? { ...d, cards: d.cards.filter((c) => !drop.has(c.ref)) } : d)) });
}

/** Every one of `refs` already in the deck? */
export function deckHasAll(deck: UserDeck, refs: readonly string[]): boolean {
  const have = new Set(deck.cards.map((c) => c.ref));
  return refs.length > 0 && refs.every((r) => have.has(r));
}

export function decksWith(file: DecksFile, ref: string): UserDeck[] {
  return file.decks.filter((d) => d.cards.some((c) => c.ref === ref));
}

export function setFace(file: DecksFile, face: StudyFace): DecksFile {
  return file.face === face ? file : { ...file, face };
}

// ---------------------------------------------------------------------------
// From the dictionary and from lessons
// ---------------------------------------------------------------------------

export function snapshotOf(entry: Pick<DictionaryEntry, "id" | "spelling" | "toned" | "gloss" | "audio">): WordSnapshot {
  return { id: entry.id, spelling: nfc(entry.spelling), toned: entry.toned ? nfc(entry.toned) : null, gloss: entry.gloss, audio: entry.audio || null };
}

/**
 * The card for a dictionary word: the course item imported from the same
 * Igbo API headword when the course teaches it (so both share one FSRS
 * card), else the dictionary word itself.
 */
export function refForEntry(bundle: ContentBundle | null, entry: Pick<DictionaryEntry, "id">): { ref: string; course: boolean } {
  if (bundle) {
    for (const item of Object.values(bundle.items)) {
      if (item.provenance.kind === "igbo-api" && item.provenance.sourceId === entry.id && isUsable(bundle, item)) return { ref: item.id, course: true };
    }
  }
  return { ref: `${DICT_PREFIX}${entry.id}`, course: false };
}

export interface FinishedLesson {
  lesson: string;
  title: string;
  unitTitle: string;
  completedAt: string;
  refs: string[];
}

/** Lessons the learner has finished, newest first, with the words each one taught. */
export function finishedLessons(bundle: ContentBundle, progress: Progress): FinishedLesson[] {
  return Object.values(progress.lessons)
    .map((r) => {
      const lesson = bundle.lessons[r.lesson];
      if (!lesson) return null;
      const refs = lessonRefs(bundle, lesson.id);
      if (refs.length === 0) return null;
      return { lesson: lesson.id as string, title: lesson.title, unitTitle: bundle.units[lesson.unit]?.title ?? "", completedAt: r.completedAt, refs };
    })
    .filter((x): x is FinishedLesson => x !== null)
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0));
}

/** The usable items a lesson teaches, in order. */
export function lessonRefs(bundle: ContentBundle, lessonId: string): string[] {
  const lesson = bundle.lessons[lessonId];
  if (!lesson) return [];
  return [...new Set(lesson.introduces as string[])].filter((id) => {
    const item = bundle.items[id];
    return !!item && isUsable(bundle, item);
  });
}

// ---------------------------------------------------------------------------
// Built-in decks
// ---------------------------------------------------------------------------

export type DeckKind = "user" | "unit" | "tricky" | "tones";

export interface DeckView {
  id: string;
  kind: DeckKind;
  name: string;
  /** A quiet line under the name. */
  detail: string;
  refs: string[];
  /** Unit decks: the unit (its `free` flag decides the Plus gate, as on the path). */
  unit?: Pick<Unit, "id" | "index" | "title" | "free">;
  /** The face that suits the deck when the learner has not chosen one. */
  suggestedFace?: StudyFace;
}

export const TRICKY_ID = "tricky";
export const TONES_ID = "tones";
export const unitDeckId = (unit: string) => `unit:${unit}`;

/** How far back "Tricky words" looks. */
export const TRICKY_DAYS = 30;
export const TRICKY_MAX = 60;

const DAY_MS = 86_400_000;

/**
 * Words answered "not yet" (Again) in the last 30 days, or with a lapse
 * on their card, most recent first. Speaking is self-assessed and never
 * counted here: "not yet" on a spoken word is not a miss.
 */
export function trickyRefs(progress: Progress, log: readonly ReviewLog[], now: Date, known: (ref: string) => boolean): string[] {
  const since = now.getTime() - TRICKY_DAYS * DAY_MS;
  const last = new Map<string, number>();
  for (const l of log) {
    if (l.rating !== 1 || l.facet === "speak") continue;
    const t = Date.parse(l.reviewedAt);
    if (!Number.isFinite(t) || t < since) continue;
    last.set(l.item, Math.max(last.get(l.item) ?? 0, t));
  }
  for (const c of Object.values(progress.cards)) {
    if (c.facet === "speak" || c.lapses <= 0 || last.has(c.item)) continue;
    const t = c.lastReview ? Date.parse(c.lastReview) : 0;
    last.set(c.item, Number.isFinite(t) ? Math.min(t, since) : 0);
  }
  return [...last.entries()]
    .filter(([ref]) => known(ref))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, TRICKY_MAX)
    .map(([ref]) => ref);
}

/** Can this card be shown? A usable course item, or a dictionary word with a snapshot. */
export function knownRef(bundle: ContentBundle, file: DecksFile, ref: string): boolean {
  if (ref.startsWith(DICT_PREFIX)) return !!file.words[ref.slice(DICT_PREFIX.length)];
  const item = bundle.items[ref];
  return !!item && isUsable(bundle, item);
}

/** Units in course order: each track's units in turn, deduped. */
export function courseUnits(bundle: ContentBundle, track?: string): Unit[] {
  const order = new Map<string, number>();
  const tracks = Object.values(bundle.tracks).sort((a, b) => (a.id === track ? -1 : b.id === track ? 1 : 0));
  for (const t of tracks) for (const u of t.units) if (!order.has(u)) order.set(u, order.size);
  return Object.values(bundle.units).sort((a, b) => (order.get(a.id) ?? 1e6 + a.index) - (order.get(b.id) ?? 1e6 + b.index) || a.index - b.index);
}

/** The words a unit teaches, in lesson order. */
export function unitRefs(bundle: ContentBundle, unitId: string): string[] {
  const unit = bundle.units[unitId];
  if (!unit) return [];
  const out: string[] = [];
  for (const l of unit.lessons) for (const ref of lessonRefs(bundle, l)) if (!out.includes(ref)) out.push(ref);
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The bundle's tone minimal sets, worked out once per bundle (minimalSets is quadratic). */
const setCache = new WeakMap<ContentBundle, { sets: ItemId[][]; of: Map<string, ItemId[]> }>();
export function toneSetsOf(bundle: ContentBundle): { sets: ItemId[][]; of: Map<string, ItemId[]> } {
  let hit = setCache.get(bundle);
  if (!hit) {
    const sets = minimalSets(bundle);
    const of = new Map<string, ItemId[]>();
    for (const s of sets) for (const id of s) of.set(id, s);
    hit = { sets, of };
    setCache.set(bundle, hit);
  }
  return hit;
}

export function builtInDecks(bundle: ContentBundle, file: DecksFile, progress: Progress, log: readonly ReviewLog[], now: Date, track?: string): DeckView[] {
  const known = (ref: string) => knownRef(bundle, file, ref);
  const tricky = trickyRefs(progress, log, now, known);
  const sets = toneSetsOf(bundle).sets.filter((s) => s.every((id) => bundle.items[id] && isUsable(bundle, bundle.items[id] as Item)));
  const tones = sets.flat() as string[];
  const out: DeckView[] = [
    {
      id: TRICKY_ID,
      kind: "tricky",
      name: "Tricky words",
      detail: tricky.length ? `${plural(tricky.length, "word")} you'll want another go at` : "Words that come back “not yet” gather here",
      refs: tricky,
    },
    {
      id: TONES_ID,
      kind: "tones",
      name: "Tone pairs",
      detail: sets.length ? `${plural(sets.length, "set")} that differ only in tone` : "Words that differ only in tone arrive with the lessons",
      refs: tones,
      suggestedFace: "audio",
    },
  ];
  for (const unit of courseUnits(bundle, track)) {
    const refs = unitRefs(bundle, unit.id);
    if (refs.length === 0) continue;
    out.push({
      id: unitDeckId(unit.id),
      kind: "unit",
      name: unit.title,
      detail: `Unit ${unit.index + 1} · ${plural(refs.length, "word")}`, // as the Learn path numbers it (u00 is Unit 1)
      refs,
      unit: { id: unit.id, index: unit.index, title: unit.title, free: unit.free },
    });
  }
  return out;
}

export function userDeckView(deck: UserDeck): DeckView {
  return { id: deck.id, kind: "user", name: deck.name, detail: plural(deck.cards.length, "card"), refs: deck.cards.map((c) => c.ref) };
}

/** Every deck by id (the learner's and the built-ins). */
export function findDeck(bundle: ContentBundle, file: DecksFile, progress: Progress, log: readonly ReviewLog[], now: Date, id: string, track?: string): DeckView | null {
  const mine = file.decks.find((d) => d.id === id);
  if (mine) return userDeckView(mine);
  return builtInDecks(bundle, file, progress, log, now, track).find((d) => d.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export interface CardView {
  ref: string;
  kind: "item" | "word";
  /** Spelling layer (NFC). */
  spelling: string;
  /** Tone-marked form, or null while the tones are pending. */
  toned: string | null;
  pitch: { tones: Tone[]; syllables: string[]; label: string } | null;
  gloss: string;
  /** A course item (play with useItemAudio) or a dataset clip (useDictionaryAudio). */
  item: Item | null;
  clip: string | null;
  /** A course item still pending native review: show the DraftTag. */
  draft: boolean;
  /** A dictionary word: show "Not yet reviewed by Okwu". */
  unreviewed: boolean;
  /** For tone pairs: the words it is told apart from, tone-marked, with meanings. */
  partners: { marked: string; gloss: string }[];
}

export function cardView(bundle: ContentBundle, file: DecksFile, ref: string): CardView | null {
  if (ref.startsWith(DICT_PREFIX)) {
    const w = file.words[ref.slice(DICT_PREFIX.length)];
    if (!w) return null;
    const p = pitchOf(w.toned);
    return { ref, kind: "word", spelling: w.spelling, toned: w.toned, pitch: p, gloss: w.gloss, item: null, clip: w.audio, draft: false, unreviewed: true, partners: [] };
  }
  const item = bundle.items[ref];
  if (!item || !isUsable(bundle, item)) return null;
  const pl = pitchLineFor(item);
  const partners = (toneSetsOf(bundle).of.get(item.id) ?? [])
    .filter((id) => id !== item.id)
    .map((id) => bundle.items[id])
    .filter((i): i is Item => !!i && isUsable(bundle, i))
    .map((i) => ({ marked: toneMarked(i) ?? i.spelling, gloss: i.gloss.en }));
  return {
    ref,
    kind: "item",
    spelling: item.spelling,
    toned: toneMarked(item),
    pitch: pl ? { tones: pl.tones, syllables: pl.syllables, label: pl.label } : null,
    gloss: item.gloss.en,
    item,
    clip: null,
    draft: needsDraftTag(item),
    unreviewed: false,
    partners,
  };
}

/** Does this card have a recording to lead with? (`clipReady` answers for dictionary words.) */
export function audibleCard(bundle: ContentBundle, card: CardView, clipReady: (id: string) => boolean): boolean {
  if (card.item) return hasPlayableAudio(card.item, allowsUnreviewedAudio(bundle));
  return !!card.clip && clipReady(card.clip);
}

// ---------------------------------------------------------------------------
// Studying: the faces, the FSRS card each face trains, and the queue
// ---------------------------------------------------------------------------

/**
 * The exercise a flashcard answer is recorded as (usePlay().answer).
 * Igbo → English is a listen-choose for its meaning, English → Igbo a
 * recall (type-it from the gloss), and listen-first a type-it from audio.
 * The engine's facetsFor turns these into the card's facet, so a word
 * studied here moves the same FSRS card a lesson would.
 */
export function flashExercise(face: StudyFace, ref: string, audible: boolean, seed: number): Exercise {
  const id = ref as ItemId;
  const used: StudyFace = face === "audio" && !audible ? "ig-en" : face;
  const spec: ExerciseSpec =
    used === "en-ig"
      ? { type: "type-it", items: [id], target: id, prompt: "gloss" }
      : used === "audio"
        ? { type: "type-it", items: [id], target: id, prompt: "audio" }
        : { type: "listen-choose", items: [id], prompt: id, answer: "gloss", options: [id] };
  return { id: `flash-${used}-${ref}-${(seed >>> 0).toString(36)}`, spec, order: [0], seed };
}

/** The face a card is actually shown with (listen-first needs a recording). */
export function faceFor(face: StudyFace, audible: boolean): StudyFace {
  return face === "audio" && !audible ? "ig-en" : face;
}

/** The facet (FSRS card) a face trains for this card. */
export function facetFor(bundle: ContentBundle, face: StudyFace, ref: string, audible: boolean): Facet {
  return facetsFor(flashExercise(face, ref, audible, 0), bundle)[0]?.facet ?? "recognize";
}

export interface StudyCard {
  ref: string;
  facet: Facet;
  face: StudyFace;
  exercise: Exercise;
  /** The FSRS card as it stands (null: never studied this way). */
  card: FsrsCard | null;
  due: boolean;
}

export interface QueueInput {
  bundle: ContentBundle;
  progress: Progress;
  scheduler: Scheduler;
  refs: readonly string[];
  face: StudyFace;
  now: Date;
  audible: (ref: string) => boolean;
  seed: number;
  /** Cards per session (default 20). */
  max?: number;
  /** New cards per session (default 10). */
  newMax?: number;
  /** Nothing due or new: practise the soonest cards anyway. */
  ahead?: boolean;
}

export const STUDY_MAX = 20;
export const STUDY_NEW_MAX = 10;

/** Where each card of a deck stands for a face. */
export function deckCards(input: Omit<QueueInput, "seed" | "max" | "newMax" | "ahead">): StudyCard[] {
  const { bundle, progress, refs, face, now } = input;
  return [...new Set(refs)].map((ref, i) => {
    const audible = input.audible(ref);
    const facet = facetFor(bundle, face, ref, audible);
    const card = progress.cards[cardKey(ref, facet)] ?? null;
    return { ref, facet, face: faceFor(face, audible), exercise: flashExercise(face, ref, audible, i), card, due: !!card && Date.parse(card.due) <= now.getTime() };
  });
}

/**
 * A study session: cards that are due (most overdue first, as the
 * scheduler orders them), then new cards in deck order. With `ahead`, and
 * nothing due or new, the cards coming up soonest.
 */
export function studyQueue(input: QueueInput): StudyCard[] {
  const max = input.max ?? STUDY_MAX;
  const newMax = input.newMax ?? STUDY_NEW_MAX;
  const all = deckCards(input);
  const byKey = new Map(all.map((c) => [`${c.ref}#${c.facet}`, c]));
  const dueCards = input.scheduler.due(
    all.filter((c) => c.due).map((c) => c.card as FsrsCard),
    input.now
  );
  const due = dueCards.map((c) => byKey.get(cardKey(c.item, c.facet))).filter((c): c is StudyCard => !!c);
  const fresh = all.filter((c) => !c.card).slice(0, newMax);
  let out = [...due, ...fresh].slice(0, max);
  if (out.length === 0 && input.ahead) {
    out = all
      .filter((c) => c.card)
      .sort((a, b) => Date.parse(a.card!.due) - Date.parse(b.card!.due))
      .slice(0, max);
  }
  return out.map((c, i) => ({ ...c, exercise: flashExercise(input.face, c.ref, input.audible(c.ref), (input.seed + i) >>> 0) }));
}

export interface DeckSummary {
  total: number;
  due: number;
  fresh: number;
  /** Mastery across every skill practised, as the course measures it. */
  levels: Record<MasteryLevel, number>;
  /** Strong or mastered (stability of a week or more on every practised skill). */
  strong: number;
  /** When the next card falls due, if none is due now. */
  nextDue: Date | null;
}

export function summarize(cards: readonly StudyCard[], progress: Progress, scheduler: Scheduler, now: Date): DeckSummary {
  const levels: Record<MasteryLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let next = Infinity;
  for (const c of cards) {
    levels[itemMastery(progress, c.ref, now, scheduler).level]++;
    if (c.card && !c.due) next = Math.min(next, Date.parse(c.card.due));
  }
  const due = cards.filter((c) => c.due).length;
  return {
    total: cards.length,
    due,
    fresh: cards.filter((c) => !c.card).length,
    levels,
    strong: levels[3] + levels[4],
    nextDue: due === 0 && Number.isFinite(next) ? new Date(next) : null,
  };
}

/** The four self-ratings, kindly worded. */
export const RATINGS: readonly { rating: Rating; label: string; hint: string }[] = [
  { rating: 1, label: "Again", hint: "Not yet" },
  { rating: 2, label: "Hard", hint: "With effort" },
  { rating: 3, label: "Good", hint: "Knew it" },
  { rating: 4, label: "Easy", hint: "Instantly" },
];

/** "1 min", "10 min", "5 h", "3 d", "2 mo": how long until a rating brings the card back. */
export function intervalLabel(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} mo`;
  return `${Math.round((d / 365) * 10) / 10} y`;
}

/** What each rating would do to this card now (for the rating buttons). */
export function ratingPreview(scheduler: Scheduler, card: FsrsCard | null, ref: string, facet: Facet, now: Date): Record<Rating, string> {
  const base = card ?? scheduler.newCard(ref as ItemId, facet, now);
  const p = scheduler.preview(base, now);
  return {
    1: intervalLabel(Date.parse(p[1].due) - now.getTime()),
    2: intervalLabel(Date.parse(p[2].due) - now.getTime()),
    3: intervalLabel(Date.parse(p[3].due) - now.getTime()),
    4: intervalLabel(Date.parse(p[4].due) - now.getTime()),
  };
}

/** The outcome a self-rating is recorded with: Again is "not yet", the rest are recalled. */
export function flashOutcome(rating: Rating): { correct: boolean; rating: Rating; selfAssessed: true } {
  return { correct: rating > 1, rating, selfAssessed: true };
}

export interface StudyTally {
  studied: number;
  /** Rated Good or Easy. */
  knew: number;
  /** Rated Hard. */
  effort: number;
  /** Rated Again ("not yet": they come back soon). */
  again: number;
}

export function tally(ratings: readonly Rating[]): StudyTally {
  return {
    studied: ratings.length,
    knew: ratings.filter((r) => r >= 3).length,
    effort: ratings.filter((r) => r === 2).length,
    again: ratings.filter((r) => r === 1).length,
  };
}
