// The exercise generator (CONTRACTS §2). It selects and arranges approved
// strings; it never produces Igbo text. A session is built in two steps.
//
// 1. Selection (what is in the session). Seed-independent.
//    - Every new item of the lesson is introduced: its first hearing (hear
//      and mean, or the tone pair when nothing else can be heard) plus one
//      practice (build or type it). This core always fits: the cap
//      (`maxExercises`) grows to hold it.
//    - A story and everything that practises its lines (the comprehension
//      questions) are the point of a story lesson, so they come in whole.
//    - Then the rest fills up to the cap, one turn each, in this order: the
//      new items' other steps (tone pair, say it), the lesson's other
//      authored exercises, and due reviews.
// 2. Ordering (in what order). Seeded interleaving under these rules:
//    - New items are introduced before they are reviewed: each new item
//      runs through hear-and-mean → (tone pair) → say → type/build, in that
//      order, and new items start in lesson order, at most three at a time.
//    - An item is heard before it is said (say-it and dialogues wait for
//      it; an authored say-it brings its own hearing).
//    - A story is read before anything that uses its lines: questions,
//      tiles and reviews of story lines wait until it is read. A story
//      lesson opens on its story, before any due review.
//    - Confusables are interleaved, not blocked: distractors prefer an
//      item's confusables and tone-set partners, and no item comes twice in
//      a row when anything else is available.
// - Distractors come only from usable items (approved; drafts only in a
//   development bundle).
// - The same seed gives the same session.
import { allowsUnreviewedAudio, hasPlayableAudio, hasTones, minimalSetOf, usableItems, voicesOf } from "@/lib/content/bundle";
import type { ContentBundle, ExerciseSpec, Item, ItemId, VoiceId } from "@/lib/content/types";
import { syllabify } from "@/lib/igbo/syllables";
import { permutation, rng, sample, shuffle, subSeed } from "./rng";
import type { Exercise, ExerciseGenerator, Facet, FsrsCard, GeneratorInput } from "./types";

/** At most this many new items are "open" (started, not finished) at once. */
export const MAX_OPEN_NEW = 3;
export const LISTEN_OPTIONS = 4;
export const DISTRACTOR_TILES = 2;

interface Ctx {
  bundle: ContentBundle;
  usable: Item[];
  byId: Map<string, Item>;
  allowAudio: boolean;
  seed: number;
}

const lower = (s: string) => s.normalize("NFC").trim().toLowerCase();
const tokens = (spelling: string) => spelling.split(/\s+/u).filter(Boolean);
const bareToken = (t: string) => lower(t).replace(/[^\p{L}\p{M}'’-]/gu, "");

function syllableCount(item: Item): number {
  return hasTones(item) ? item.tone.syllables.length : syllabify(item.spelling).length;
}

/** Distractors for a listen-choose: confusables and tone-set partners first, then same-tag items, then the rest. */
function distractors(ctx: Ctx, prompt: Item, answer: "item" | "gloss", n: number, seed: number): Item[] {
  const r = rng(seed);
  const taken = new Set<string>([answer === "gloss" ? lower(prompt.gloss.en) : lower(prompt.spelling)]);
  const keyOf = (i: Item) => (answer === "gloss" ? lower(i.gloss.en) : lower(i.spelling));
  const ok = (i: Item) => i.id !== prompt.id && !taken.has(keyOf(i)) && (answer === "gloss" || lower(i.spelling) !== lower(prompt.spelling));
  const close = new Set<string>([...prompt.confusables, ...minimalSetOf(ctx.bundle, prompt.id)]);
  const tags = new Set(prompt.tags);
  const tiers = [
    ctx.usable.filter((i) => close.has(i.id)),
    ctx.usable.filter((i) => !close.has(i.id) && i.kind === prompt.kind && i.tags.some((t) => tags.has(t))),
    ctx.usable.filter((i) => !close.has(i.id) && i.kind === prompt.kind),
    ctx.usable,
  ];
  const out: Item[] = [];
  for (const tier of tiers) {
    for (const cand of shuffle(tier, r)) {
      if (out.length >= n) return out;
      if (!ok(cand)) continue;
      taken.add(keyOf(cand));
      out.push(cand);
    }
  }
  return out;
}

function listenChoose(ctx: Ctx, item: Item, answer: "item" | "gloss"): Exercise | null {
  const playable = hasPlayableAudio(item, ctx.allowAudio);
  // Without a recording the screen shows the Igbo text, so it can only ask for the meaning.
  const mode = playable ? answer : "gloss";
  const seed = subSeed(ctx.seed, `lc:${item.id}:${mode}`);
  const ds = distractors(ctx, item, mode, LISTEN_OPTIONS - 1, seed);
  if (ds.length === 0) return null;
  const options = [item.id, ...ds.map((d) => d.id)] as ItemId[];
  const spec: ExerciseSpec = { type: "listen-choose", items: [item.id], prompt: item.id, answer: mode, options };
  return { id: "", spec, order: permutation(options.length, rng(seed)), seed };
}

function tonePair(ctx: Ctx, item: Item): Exercise | null {
  const set = minimalSetOf(ctx.bundle, item.id);
  if (set.length < 2) return null;
  const seed = subSeed(ctx.seed, `tp:${item.id}`);
  const voices = [...new Set(set.flatMap((id) => voicesOf(ctx.byId.get(id) as Item, ctx.allowAudio)))].sort() as VoiceId[];
  const spec: ExerciseSpec = { type: "tone-pair", items: [item.id], set, target: item.id, voices };
  return { id: "", spec, order: permutation(set.length, rng(seed)), seed };
}

function sayIt(ctx: Ctx, item: Item): Exercise {
  const short = item.kind === "word" || item.kind === "name" || (item.kind === "phrase" && syllableCount(item) <= 6);
  return { id: "", spec: { type: "say-it", items: [item.id], target: item.id, overlay: short }, order: [], seed: subSeed(ctx.seed, `si:${item.id}`) };
}

function typeIt(ctx: Ctx, item: Item, prompt: "gloss" | "audio"): Exercise {
  const p = prompt === "audio" && hasPlayableAudio(item, ctx.allowAudio) ? "audio" : "gloss";
  return { id: "", spec: { type: "type-it", items: [item.id], target: item.id, prompt: p }, order: [], seed: subSeed(ctx.seed, `ti:${item.id}`) };
}

function buildSentence(ctx: Ctx, item: Item): Exercise | null {
  const tiles = tokens(item.spelling);
  if (tiles.length < 2) return null;
  const seed = subSeed(ctx.seed, `bs:${item.id}`);
  const own = new Set(tiles.map(bareToken));
  const pool = [...new Set(ctx.usable.filter((i) => i.id !== item.id).flatMap((i) => tokens(i.spelling)))].filter((t) => !own.has(bareToken(t)));
  const extra = sample(pool.sort(), DISTRACTOR_TILES, rng(seed));
  const spec: ExerciseSpec = { type: "build-sentence", items: [item.id], target: item.id, tiles, distractorTiles: extra };
  return { id: "", spec, order: permutation(tiles.length + extra.length, rng(seed ^ 0x5bd1e995)), seed };
}

/** The exercise that recalls an item (multi-word: build it; otherwise type it). */
function recallExercise(ctx: Ctx, item: Item): Exercise {
  return buildSentence(ctx, item) ?? typeIt(ctx, item, "gloss");
}

/**
 * First exposure of a new item, in order: hear-and-mean, tone pair, say it,
 * build or type it. `core` is the part every session keeps: the first
 * hearing plus the recall practice.
 */
function introSequence(ctx: Ctx, item: Item): { seq: Exercise[]; core: Set<Exercise> } {
  const seq: Exercise[] = [];
  const hear = listenChoose(ctx, item, "gloss");
  if (hear) seq.push(hear);
  const tp = tonePair(ctx, item);
  if (tp) seq.push(tp);
  if (seq.length > 0) seq.push(sayIt(ctx, item));
  const recall = recallExercise(ctx, item);
  seq.push(recall);
  const first = hear ?? tp;
  return { seq, core: new Set(first ? [first, recall] : [recall]) };
}

/** One review for a due card, by the skill it trains. */
function reviewSequence(ctx: Ctx, item: Item, facet: Facet): Exercise[] {
  switch (facet) {
    case "listen": {
      const lc = listenChoose(ctx, item, "item") ?? listenChoose(ctx, item, "gloss");
      return lc ? [lc] : [typeIt(ctx, item, "audio")];
    }
    case "recognize": {
      const lc = listenChoose(ctx, item, "gloss");
      return lc ? [lc] : [recallExercise(ctx, item)];
    }
    case "recall":
      return [recallExercise(ctx, item)];
    case "speak": {
      const hear = listenChoose(ctx, item, "gloss") ?? tonePair(ctx, item);
      return hear ? [hear, sayIt(ctx, item)] : [];
    }
    case "tone": {
      const tp = tonePair(ctx, item) ?? listenChoose(ctx, item, "item");
      return tp ? [tp] : [];
    }
  }
}

interface Queue {
  kind: "new" | "review" | "authored";
  item?: string;
  specs: Exercise[];
  started: boolean;
}

/** Items the learner hears in an exercise (its prompt or target is played). */
export function heardIn(spec: ExerciseSpec): ItemId[] {
  switch (spec.type) {
    case "listen-choose":
      return [spec.prompt];
    case "tone-pair":
      return [spec.target];
    case "dialogue":
      return spec.lines.map((l) => l.item);
    case "type-it":
      return spec.prompt === "audio" ? [spec.target] : [];
    case "say-it":
      return [spec.target]; // shadowing plays the model first
    default:
      return [];
  }
}

/** Items the learner must have heard before this exercise. */
function needsHeard(spec: ExerciseSpec, learnerOnly = true): ItemId[] {
  if (spec.type === "say-it") return [spec.target];
  if (spec.type === "dialogue") return spec.lines.filter((l) => !learnerOnly || l.speaker === spec.learnerSpeaker).map((l) => l.item);
  return [];
}

function targetOf(spec: ExerciseSpec): string {
  switch (spec.type) {
    case "listen-choose":
      return spec.prompt;
    case "story":
      return `story:${spec.story}`;
    case "dialogue":
      return `dialogue:${spec.lines.map((l) => l.item).join(",")}`;
    default:
      return spec.target;
  }
}

/** Every item an exercise shows or plays: its own items, prompt, options, target, set or lines. */
export function itemsUsedBy(spec: ExerciseSpec): ItemId[] {
  switch (spec.type) {
    case "listen-choose":
      return [...spec.items, spec.prompt, ...spec.options];
    case "tone-pair":
      return [...spec.items, spec.target, ...spec.set];
    case "dialogue":
      return [...spec.items, ...spec.lines.map((l) => l.item)];
    case "story":
      return [...spec.items];
    default:
      return [...spec.items, spec.target];
  }
}

function authoredExercise(spec: ExerciseSpec, seed: number): Exercise {
  const n = spec.type === "listen-choose" ? spec.options.length : spec.type === "tone-pair" ? spec.set.length : spec.type === "build-sentence" ? spec.tiles.length + spec.distractorTiles.length : 0;
  return { id: "", spec, order: permutation(n, rng(seed)), seed };
}

/** What goes into a session (step 1): queues of exercises that play in order, and each story line's story. */
interface Selection {
  queues: Queue[];
  /** Item id → the target ("story:<id>") of the story exercise it is a line of. */
  storyLines: Map<string, string>;
}

function select(ctx: Ctx, input: GeneratorInput, max: number): Selection {
  const lesson = input.lesson ? input.bundle.lessons[input.lesson] : undefined;

  // New items: the core (first hearing + one practice) is guaranteed.
  const newIds = [...new Set(lesson?.introduces ?? [])].filter((id) => ctx.byId.has(id));
  const news = newIds.map((id) => ({ id, ...introSequence(ctx, ctx.byId.get(id) as Item) }));

  // One review per due item (its most urgent facet); items being introduced now are not reviewed.
  const reviews: { item: string; group: Exercise[] }[] = [];
  const seenReview = new Set<string>(newIds);
  for (const card of input.due as FsrsCard[]) {
    const item = ctx.byId.get(card.item);
    if (!item || seenReview.has(item.id)) continue;
    seenReview.add(item.id);
    const group = reviewSequence(ctx, item, card.facet);
    if (group.length > 0) reviews.push({ item: item.id, group });
  }

  // Authored lesson exercises whose items are all usable. A story, and
  // everything that uses its lines, is the point of the lesson: always in.
  const usableSpec = (spec: ExerciseSpec) => (spec.type === "dialogue" ? spec.lines.map((l) => l.item) : spec.items).every((id) => ctx.byId.has(id));
  const storyLines = new Map<string, string>();
  for (const spec of lesson?.exercises ?? []) {
    if (spec.type !== "story" || !usableSpec(spec)) continue;
    for (const id of spec.items) if (!storyLines.has(id)) storyLines.set(id, targetOf(spec));
  }
  const heardInCore = new Set(news.filter((n) => [...n.core].some((e) => heardIn(e.spec).includes(n.id as ItemId))).map((n) => n.id));
  const authored: { group: Exercise[]; anchor: boolean }[] = [];
  for (const [i, spec] of (lesson?.exercises ?? []).entries()) {
    if (!usableSpec(spec)) continue;
    const ex = authoredExercise(spec, subSeed(ctx.seed, `authored:${i}`));
    const anchor = spec.type === "story" || itemsUsedBy(spec).some((id) => storyLines.has(id));
    if (spec.type === "say-it" && !heardInCore.has(spec.target)) {
      // Heard before said: a say-it of an item this session does not otherwise teach brings its own hearing.
      const item = ctx.byId.get(spec.target) as Item;
      const hear = listenChoose(ctx, item, "gloss") ?? tonePair(ctx, item);
      if (hear) authored.push({ group: [hear, ex], anchor });
      continue;
    }
    authored.push({ group: [ex], anchor });
  }

  const chosen = new Set<Exercise>();
  let used = 0;
  const take = (group: readonly Exercise[]) => {
    for (const e of group) chosen.add(e);
    used += group.length;
  };
  for (const n of news) take([...n.core]);
  for (const a of authored) if (a.anchor) take(a.group);
  // The cap never cuts the core; the fill stops at it.
  const budget = Math.max(max, used);

  // Fill, one turn each: the new items' other steps (round by round, in lesson order), other authored exercises, due reviews.
  const rest = news.map((n) => n.seq.filter((e) => !n.core.has(e)));
  const extras: Exercise[][] = [];
  for (let round = 0; rest.some((x) => x.length > round); round++) for (const x of rest) if (x[round]) extras.push([x[round] as Exercise]);
  const pools: Exercise[][][] = [extras, authored.filter((a) => !a.anchor).map((a) => a.group), reviews.map((x) => x.group)];
  while (used < budget && pools.some((p) => p.length > 0)) {
    for (const pool of pools) {
      if (used >= budget) break;
      const group = pool.shift();
      if (group && used + group.length <= budget) take(group);
    }
  }

  const queues: Queue[] = [];
  for (const n of news) {
    const picked = n.seq.filter((e) => chosen.has(e));
    if (picked.length > 0) queues.push({ kind: "new", item: n.id, specs: picked, started: false });
  }
  for (const x of reviews) if (x.group.every((e) => chosen.has(e))) queues.push({ kind: "review", item: x.item, specs: x.group, started: false });
  for (const a of authored) if (a.group.every((e) => chosen.has(e))) queues.push({ kind: "authored", specs: a.group, started: false });
  return { queues, storyLines };
}

export function generate(input: GeneratorInput): Exercise[] {
  const { bundle, seed } = input;
  const usable = usableItems(bundle);
  const ctx: Ctx = { bundle, usable, byId: new Map(usable.map((i) => [i.id, i])), allowAudio: allowsUnreviewedAudio(bundle), seed: seed >>> 0 };
  const max = Math.max(0, input.maxExercises);
  if (max === 0) return [];
  const { queues, storyLines } = select(ctx, input, max);

  // Stories in this session, until they are read: nothing that uses their lines comes first.
  const unread = new Set<string>(queues.flatMap((q) => q.specs.filter((e) => e.spec.type === "story").map((e) => targetOf(e.spec))));
  const waitsForStory = (spec: ExerciseSpec) => spec.type !== "story" && itemsUsedBy(spec).some((id) => unread.has(storyLines.get(id) ?? ""));

  const r = rng(ctx.seed);
  const heard = new Set<string>();
  const out: Exercise[] = [];
  let last = "";
  for (;;) {
    const live = queues.filter((q) => q.specs.length > 0);
    if (live.length === 0) break;
    const openNew = live.filter((q) => q.kind === "new" && q.started).length;
    const hearingLeft = live.some((q) => q.specs.some((e) => heardIn(e.spec).length > 0 && e.spec.type !== "say-it"));
    let eligible = live.filter((q) => {
      const head = q.specs[0] as Exercise;
      if (waitsForStory(head.spec)) return false;
      if (q.kind === "new" && !q.started && openNew >= MAX_OPEN_NEW) return false;
      const needs = needsHeard(head.spec);
      if (needs.every((id) => heard.has(id))) return true;
      // a dialogue whose lines are never heard elsewhere may run once nothing else can teach them
      return head.spec.type === "dialogue" && !hearingLeft;
    });
    // Nothing selected is ever dropped: should the rules leave nothing to play, relax them in turn (stories stay first).
    if (eligible.length === 0) eligible = live.filter((q) => !waitsForStory((q.specs[0] as Exercise).spec));
    if (eligible.length === 0) eligible = live;
    // A story lesson opens on its story: the intro says "Start reading", so due reviews wait until it is read.
    const stories = eligible.filter((q) => (q.specs[0] as Exercise).spec.type === "story");
    if (stories.length > 0) eligible = stories;
    const fresh = eligible.filter((q) => targetOf((q.specs[0] as Exercise).spec) !== last);
    const pool = fresh.length > 0 ? fresh : eligible;
    // New items first in their own order: the earliest unstarted new item is the only unstarted one offered.
    const firstUnstarted = pool.find((q) => q.kind === "new" && !q.started);
    const offered = pool.filter((q) => !(q.kind === "new" && !q.started) || q === firstUnstarted);
    // weight by what is left, so long sequences spread out instead of bunching at the end
    const total = offered.reduce((n, x) => n + x.specs.length, 0);
    let pick = r() * total;
    let q = offered[offered.length - 1] as Queue;
    for (const x of offered) {
      pick -= x.specs.length;
      if (pick < 0) {
        q = x;
        break;
      }
    }
    const ex = q.specs.shift() as Exercise;
    q.started = true;
    for (const id of heardIn(ex.spec)) heard.add(id);
    if (ex.spec.type === "story") unread.delete(targetOf(ex.spec));
    last = targetOf(ex.spec);
    out.push({ ...ex, id: `${ctx.seed.toString(36)}-${out.length}-${ex.spec.type}` });
  }
  return out;
}

export function createGenerator(): ExerciseGenerator {
  return { generate };
}
