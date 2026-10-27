// The phrasebook and real-life conversations (E3). Screens import from here
// (and the hooks from ./hooks). The data is compiled by
// `bun scripts/phrasebook/build.ts` from the licensed Igbo API dataset into
// ./generated/*.json: dataset sentences with their own recordings, chosen by
// rules and an editor, all pending native review.
//
// Recordings play through the dictionary's dataset-clip layer
// (useDictionaryAudio in lib/state/useDictionary): a bundled development
// clip, else `${EXPO_PUBLIC_AUDIO_BASE}/audio/igboapi/<AudioId>.m4a`, else
// "Recording coming soon". content/phrasebook/audio-needs.txt lists every
// clip to upload; in development scripts/content/audio-dev-server.mjs
// fetches them on demand.
import type { ConversationFile, ConversationsFile, PhrasebookFile } from "./types";
import { buildPhrasebookIndex, type PhrasebookIndex } from "./phrasebook";
import { releaseConversations } from "./conversation";

export type * from "./types";
export * from "./phrasebook";
export * from "./favourites";
export * from "./conversation";

/** Shown on every phrasebook and conversation screen. */
export const PENDING_REVIEW_NOTICE = "Every phrase here comes from a recorded dataset and is pending native review. Report anything that looks wrong.";
export const TIPS_PENDING_NOTICE = "Pending cultural review";
export const DRAFT_LINE_NOTICE = "AI draft · needs a native rewrite";
export const CONVERSATIONS_SOURCE_DETAIL =
  "Lines chosen from the dataset and arranged by Okwu, with their own recordings. Where no dataset line fitted, a line is marked as an AI draft for a native speaker to rewrite. Everything is pending native review; the tips are pending cultural review.";

function isProductionBuild(): boolean {
  if (typeof __DEV__ !== "undefined") return !__DEV__;
  return typeof process !== "undefined" && process.env.NODE_ENV === "production";
}

let phrasebookIndex: PhrasebookIndex | null = null;
/** The phrasebook (~450 phrases, ~90 KB JSON), loaded on first use. */
export async function loadPhrasebook(): Promise<PhrasebookIndex> {
  if (!phrasebookIndex) phrasebookIndex = buildPhrasebookIndex(require("./generated/phrasebook.json") as PhrasebookFile);
  return phrasebookIndex;
}

/** The phrasebook's source line, for About › Credits (read without building the index). */
export function phrasebookCredit(): string {
  return (require("./generated/phrasebook.json") as PhrasebookFile).credit;
}

let conversationsFile: ConversationsFile | null = null;
function conversationsData(): ConversationsFile {
  if (!conversationsFile) conversationsFile = require("./generated/conversations.json") as ConversationsFile;
  return conversationsFile;
}

/** Which phrasebook a learner saw (selection rules and dataset), for content reports. */
export function phrasebookVersion(): string {
  const f = require("./generated/phrasebook.json") as PhrasebookFile;
  return `phrasebook ${f.selection.rules} ${f.selection.dataset}`;
}

/** Which conversations file a learner saw, for content reports. */
export function conversationsVersion(): string {
  return `conversations ${conversationsData().selection.dataset}`;
}

/** The conversations this build may show (release builds leave out any with an AI-drafted line). */
export function loadConversations(opts: { production?: boolean } = {}): { credit: string; conversations: ConversationFile[] } {
  const file = conversationsData();
  return { credit: file.credit, conversations: releaseConversations(file, { production: opts.production ?? isProductionBuild() }) };
}

export function conversationById(id: string, opts: { production?: boolean } = {}): ConversationFile | null {
  return loadConversations(opts).conversations.find((c) => c.id === id) ?? null;
}
