// Content access (owner A). Screens import from here, never from content
// source files or ./generated directly.
//
// The bundle is compiled by `bun scripts/content/cli.ts build [--dev]` into
// ./generated/bundle.json. A development bundle (version "…+drafts")
// carries draft items; production builds never show them (releaseView).
import generated from "./generated/bundle.json";
import { lintCompiledItem, type LintContext } from "./lint";
import { releaseView } from "./bundle";
import { buildDictionaryIndex, type DictionaryFile, type DictionaryIndex } from "./dictionary";
import type { WordDetailsFile } from "./wordDetails";
import type { ContentBundle, Item, ItemId, LintResult } from "./types";

export type * from "./types";
export {
  DRAFT_BUNDLE_SUFFIX,
  DRAFT_ITEM_NOTICE,
  RECORDING_PENDING_NOTICE,
  acceptedVariants,
  allowsUnreviewedAudio,
  audioFor,
  hasPlayableAudio,
  hasTones,
  isDraftBundle,
  isPlayable,
  isUsable,
  lessonOf,
  lessonsOfUnit,
  minimalSetOf,
  minimalSets,
  needsDraftTag,
  pitchLineFor,
  playableAudio,
  releaseView,
  reviewStateLabel,
  speakerName,
  storyOf,
  storyParts,
  textNeedsDraftTag,
  toneMarked,
  usableItems,
  verifyBundle,
  voicesOf,
  type AudioState,
  type PitchLineData,
} from "./bundle";
export { LINT_RULE_VERSION, KNOWN_DOTTED, type GlossaryEntry, type LintContext, type LintRule } from "./lint";
export {
  DICT_AFFIX,
  DICT_NAME,
  DICT_REVIEWED,
  buildDictionaryIndex,
  igboKey,
  searchDictionary,
  type DictionaryEntry,
  type DictionaryFile,
  type DictionaryHit,
  type DictionaryIndex,
  type MatchKind,
} from "./dictionary";
export { NO_DETAILS, packAudioId, unpackAudioId, wordDetailsOf, type WordDetails, type WordDetailsFile, type WordDetailsRow, type WordExample } from "./wordDetails";

function isProductionBuild(): boolean {
  if (typeof __DEV__ !== "undefined") return !__DEV__;
  return typeof process !== "undefined" && process.env.NODE_ENV === "production";
}

/**
 * Prepare a raw bundle for the app: in production only approved content
 * survives, whatever bundle was shipped.
 */
export function prepareBundle(raw: ContentBundle, opts: { production: boolean }): ContentBundle {
  return opts.production ? releaseView(raw) : raw;
}

/** Load the compiled bundle shipped with the app (and later, a newer one from R2). */
export async function loadBundle(): Promise<ContentBundle> {
  return prepareBundle(generated as unknown as ContentBundle, { production: isProductionBuild() });
}

/**
 * A bundled development clip for an AudioId (dataset clips fetched into
 * content/audio/dev/), as a module for expo-audio; null when there is none
 * or in production (play `ref.key` from R2 instead).
 */
export function devAudioAsset(id: string): number | null {
  if (isProductionBuild()) return null;
  try {
    const mod = require("./generated/devAudio") as { DEV_AUDIO: Record<string, number> };
    return mod.DEV_AUDIO[id] ?? null;
  } catch {
    return null;
  }
}

/**
 * The dictionary index (5,095 Igbo API headwords, ~1.1 MB JSON, ~340 KB
 * gzip). Loaded on first use so the cost lands only when the dictionary
 * opens; can move to R2 later without changing callers.
 */
let dictionaryIndex: DictionaryIndex | null = null;
export async function loadDictionary(): Promise<DictionaryIndex> {
  if (!dictionaryIndex) {
    const file = require("./generated/dictionary.json") as DictionaryFile;
    dictionaryIndex = buildDictionaryIndex(file);
  }
  return dictionaryIndex;
}

/**
 * The word pages' details (regional recordings, word class, example
 * sentences with recordings) for the dictionary's headwords: ~1.4 MB of
 * JSON, loaded only when a word page first opens.
 */
let wordDetailsFile: WordDetailsFile | null = null;
export async function loadWordDetails(): Promise<WordDetailsFile> {
  if (!wordDetailsFile) wordDetailsFile = require("./generated/wordDetails.json") as WordDetailsFile;
  return wordDetailsFile;
}

export function getItem(bundle: ContentBundle, id: ItemId): Item | undefined {
  return bundle.items[id];
}

/**
 * The content linter: NFC, the Ọnwụ letter set, dots, no tone marks in the
 * spelling layer, harmony flags, glossary consistency, the tone layer and
 * the review pipeline. Build-time only; it flags and never fixes.
 * Cross-item rules run when `ctx` carries the glossary and corpus.
 */
export function lintItem(item: Item, ctx?: LintContext): LintResult {
  return lintCompiledItem(item, ctx);
}
