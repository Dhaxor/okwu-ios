// Reading a compiled ContentBundle: what is usable, how to show tones, and
// whether a recording exists yet. Pure TypeScript (bundle.test.ts).
import { describeTones, markTones, markedSyllables } from "@/lib/igbo/syllables";
import { nfc } from "@/lib/igbo/text";
import { bundleChecksumOf } from "./checksum";
import type { AudioRef, AudioSpeed, ContentBundle, DialectId, DialectVariant, Item, ItemId, Lesson, LessonId, LessonNote, StoryText, Tone, VoiceId } from "./types";

/** Version suffix of a development bundle that includes drafts (`compile --dev`). */
export const DRAFT_BUNDLE_SUFFIX = "+drafts";

/** Shown wherever audio would play but the native recording does not exist yet. */
export const RECORDING_PENDING_NOTICE = "Recording coming soon";

/** Shown on any item that has not passed native review (same words as the shell's DraftTag). */
export const DRAFT_ITEM_NOTICE = "Draft · pending native review";

export function isDraftBundle(bundle: Pick<ContentBundle, "version">): boolean {
  return bundle.version.endsWith(DRAFT_BUNDLE_SUFFIX);
}

/** Recompute and compare the checksum (for bundles fetched from R2 later). */
export function verifyBundle(bundle: ContentBundle): boolean {
  return bundleChecksumOf(bundle) === bundle.checksum;
}

/**
 * The release view of a bundle: approved items and lessons only, units
 * and tracks pointing only at what is left. `loadBundle` applies it in
 * production builds even if a draft bundle was shipped by mistake.
 */
export function releaseView(bundle: ContentBundle): ContentBundle {
  if (!isDraftBundle(bundle) && Object.values(bundle.items).every((i) => i.status === "approved")) return bundle;
  const items = Object.fromEntries(Object.entries(bundle.items).filter(([, i]) => i.status === "approved"));
  // Stories and notes ship once approved, and only with every item they show.
  const stories = bundle.stories
    ? Object.fromEntries(Object.entries(bundle.stories).filter(([, s]) => s.status === "approved" && s.lines.every((id) => items[id] !== undefined)))
    : undefined;
  const storyMissing = (l: Lesson) => !!bundle.stories && l.exercises.some((e) => e.type === "story" && !stories?.[e.story]);
  const lessons = Object.fromEntries(
    Object.entries(bundle.lessons)
      .filter(([, l]) => l.status === "approved" && l.introduces.every((id) => items[id] !== undefined) && !storyMissing(l))
      .map(([id, l]): [string, Lesson] => {
        if (!l.note) return [id, l];
        const { note, ...rest } = l;
        return note.status === "approved" ? [id, { ...rest, note: { ...note, examples: note.examples.filter((x) => items[x] !== undefined) } }] : [id, rest];
      })
  );
  const units = Object.fromEntries(Object.entries(bundle.units).map(([id, u]) => [id, { ...u, lessons: u.lessons.filter((l) => lessons[l] !== undefined) }]));
  const version = bundle.version.endsWith(DRAFT_BUNDLE_SUFFIX) ? bundle.version.slice(0, -DRAFT_BUNDLE_SUFFIX.length) : bundle.version;
  const out: ContentBundle = { ...bundle, version, items, lessons, units, ...(stories ? { stories } : {}), checksum: "" };
  return { ...out, checksum: bundleChecksumOf(out) };
}

/** The story a story exercise names; null in bundles built before stories were compiled in (and for the showcase). */
export function storyOf(bundle: Pick<ContentBundle, "stories">, id: string): StoryText | null {
  return bundle.stories?.[id] ?? null;
}

/** A note or story that has not passed review shows the pending-review tag. */
export function textNeedsDraftTag(text: Pick<LessonNote | StoryText, "status">): boolean {
  return text.status !== "approved";
}

/**
 * The story's reading order as the screen shows it: for a retelling, each
 * English paragraph followed by the Igbo lines it carries; for a dataset
 * sequence, the lines. Lines always keep their order: a line no paragraph
 * names comes just before the next named line, or at the end. Line numbers
 * are 0-based indexes into `story.lines`.
 */
export function storyParts(story: Pick<StoryText, "kind" | "narrative" | "lines">): ({ kind: "text"; text: string } | { kind: "line"; index: number })[] {
  const out: ({ kind: "text"; text: string } | { kind: "line"; index: number })[] = [];
  const placed = new Set<number>();
  const place = (index: number) => {
    for (let i = 0; i <= index; i++) {
      if (placed.has(i)) continue;
      placed.add(i);
      out.push({ kind: "line", index: i });
    }
  };
  if (story.kind === "bilingual-retelling") {
    for (const p of story.narrative) {
      out.push({ kind: "text", text: p.text });
      for (const n of p.lines) if (n >= 1 && n <= story.lines.length) place(n - 1);
    }
  }
  story.lines.forEach((_, index) => {
    if (!placed.has(index)) out.push({ kind: "line", index });
  });
  return out;
}

/**
 * Items a session may use: approved items, plus drafts and items in
 * review in a development bundle. Retired items never.
 */
export function isUsable(bundle: Pick<ContentBundle, "version">, item: Item): boolean {
  if (item.status === "approved") return true;
  return isDraftBundle(bundle) && item.status !== "retired";
}

/** Usable items, sorted by id (stable for seeded sessions). */
export function usableItems(bundle: ContentBundle): Item[] {
  return Object.values(bundle.items)
    .filter((i) => isUsable(bundle, i))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Screens render a DraftTag on anything for which this is true. */
export function needsDraftTag(item: Item): boolean {
  return item.status !== "approved" || item.provenance.kind === "draft-ai";
}

/**
 * A recording a learner can play now: the file exists (hashed), it is a
 * human voice, and it passed our audio QA. With `allowUnreviewed` (draft
 * bundles only) a clip still awaiting QA plays too, unless it failed.
 */
export function isPlayable(ref: AudioRef, allowUnreviewed = false): boolean {
  if (ref.sha256.length === 0 || ref.synthetic !== false) return false;
  return ref.qa.status === "passed" || (allowUnreviewed && ref.qa.status !== "failed");
}

/** Whether a bundle may play clips that have not passed QA yet (development bundles). */
export function allowsUnreviewedAudio(bundle: Pick<ContentBundle, "version">): boolean {
  return isDraftBundle(bundle);
}

export function playableAudio(item: Pick<Item, "audio">, allowUnreviewed = false): AudioRef[] {
  return item.audio.filter((a) => isPlayable(a, allowUnreviewed));
}

export type AudioState =
  /** Play `ref`. */
  | { state: "ready"; ref: AudioRef; alternatives: AudioRef[] }
  /** Planned but not recorded or not through QA: show RECORDING_PENDING_NOTICE, never a synthetic voice. */
  | { state: "pending" }
  /** No recording is planned for this item. */
  | { state: "none" };

/**
 * The recording to play for an item (or one of its dialect variants),
 * preferring the requested speed and voice. Falls back to any playable
 * clip; reports "pending" when clips are planned but not ready.
 */
export function audioFor(
  item: Pick<Item, "audio" | "dialects">,
  opts: { speed?: AudioSpeed; voice?: VoiceId; dialect?: DialectId; allowUnreviewed?: boolean } = {}
): AudioState {
  const source: AudioRef[] =
    opts.dialect && opts.dialect !== "standard" ? (item.dialects.find((d) => d.dialect === opts.dialect)?.audio ?? []) : item.audio;
  const playable = source.filter((a) => isPlayable(a, opts.allowUnreviewed));
  if (playable.length === 0) return source.length > 0 ? { state: "pending" } : { state: "none" };
  const score = (r: AudioRef) => (opts.speed && r.speed === opts.speed ? 2 : 0) + (opts.voice && r.voice === opts.voice ? 1 : 0);
  const ranked = [...playable].sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1));
  return { state: "ready", ref: ranked[0] as AudioRef, alternatives: ranked.slice(1) };
}

export function hasPlayableAudio(item: Pick<Item, "audio">, allowUnreviewed = false): boolean {
  return item.audio.some((a) => isPlayable(a, allowUnreviewed));
}

/** Distinct voices with playable audio for an item (for high-variability tone practice). */
export function voicesOf(item: Pick<Item, "audio">, allowUnreviewed = false): VoiceId[] {
  return [...new Set(playableAudio(item, allowUnreviewed).map((a) => a.voice))].sort();
}

/**
 * Where an item stands in review, in words for a DraftTag:
 * "Draft · pending native review" (AI drafts), "Imported · pending Okwu
 * review" (Igbo API data), "In review", or null once approved.
 */
export function reviewStateLabel(item: Pick<Item, "status" | "provenance">): string | null {
  if (item.status === "approved") return null;
  if (item.status === "retired") return "Retired";
  if (item.status === "in-review") return "In review · pending native sign-off";
  return item.provenance.kind === "igbo-api" ? "Imported · pending Okwu review" : DRAFT_ITEM_NOTICE;
}

/** True when the tone layer is authored (not a pending draft). */
export function hasTones(item: Pick<Item, "tone">): boolean {
  return !item.tone.pending && item.tone.syllables.length > 0;
}

/**
 * The pronunciation layer as text: the spelling with full tone marks
 * (acute high, grave low, macron downstep). Null while tones are pending.
 */
export function toneMarked(item: Pick<Item, "spelling" | "tone">): string | null {
  if (!hasTones(item)) return null;
  return markTones(item.spelling, item.tone.syllables);
}

export interface PitchLineData {
  tones: Tone[];
  /** Tone-marked syllables to set under the line. */
  syllables: string[];
  /** Spoken summary for VoiceOver and the "Not yet" panel: "low, then high". */
  label: string;
}

/** Props for `<PitchLine>`; null while tones are pending (draw nothing, say "Tones pending review"). */
export function pitchLineFor(item: Pick<Item, "tone">): PitchLineData | null {
  if (!hasTones(item)) return null;
  const tones = item.tone.syllables.map((s) => s.tone);
  return { tones, syllables: markedSyllables(item.tone.syllables), label: describeTones(tones) };
}

const sameSpelling = (a: string, b: string) => nfc(a).toLowerCase() === nfc(b).toLowerCase();

/**
 * The tone minimal set an item belongs to: usable items spelled the same
 * with authored, different tone patterns (àkwà, ákwà, àkwá, ákwá). Sorted
 * by id; empty when the item has no partner.
 */
export function minimalSetOf(bundle: ContentBundle, id: ItemId): ItemId[] {
  const item = bundle.items[id];
  if (!item || !hasTones(item)) return [];
  const members = usableItems(bundle).filter((other) => hasTones(other) && sameSpelling(other.spelling, item.spelling));
  const patterns = new Set(members.map((m) => m.tone.syllables.map((s) => s.tone).join("")));
  return members.length >= 2 && patterns.size === members.length ? members.map((m) => m.id) : [];
}

/** Every minimal set in the bundle (for the tone trainer). */
export function minimalSets(bundle: ContentBundle): ItemId[][] {
  const seen = new Set<string>();
  const out: ItemId[][] = [];
  for (const item of usableItems(bundle)) {
    const set = minimalSetOf(bundle, item.id);
    const key = set.join("|");
    if (set.length >= 2 && !seen.has(key)) {
      seen.add(key);
      out.push(set);
    }
  }
  return out;
}

/**
 * Dialect variants accepted as answers. `inProfile` are the ones the
 * learner's home-dialect profile includes; `others` are recognised forms
 * from other areas (accepted too, never ranked, with an offer to add the
 * dialect).
 */
export function acceptedVariants(item: Pick<Item, "dialects">, dialects: readonly DialectId[]): { inProfile: DialectVariant[]; others: DialectVariant[] } {
  const accepted = item.dialects.filter((d) => d.acceptAsAnswer);
  return {
    inProfile: accepted.filter((d) => dialects.includes(d.dialect)),
    others: accepted.filter((d) => !dialects.includes(d.dialect)),
  };
}

export function lessonOf(bundle: ContentBundle, id: LessonId): Lesson | undefined {
  return bundle.lessons[id];
}

/** Lessons of a unit in order. */
export function lessonsOfUnit(bundle: ContentBundle, unitId: string): Lesson[] {
  const unit = bundle.units[unitId];
  if (!unit) return [];
  return unit.lessons.map((l) => bundle.lessons[l]).filter((l): l is Lesson => l !== undefined);
}

/**
 * A dialogue speaker label: dialogue specs name speakers by the id of a
 * `name` item, so the label is approved text too. Falls back to the raw
 * label (e.g. "A").
 */
export function speakerName(bundle: ContentBundle, speaker: string): string {
  return bundle.items[speaker]?.spelling ?? speaker;
}
