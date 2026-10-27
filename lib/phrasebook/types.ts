// The phrasebook and conversation files the app ships (./generated/*.json),
// compiled by `bun scripts/phrasebook/build.ts` from the licensed Igbo API
// dataset (Nkọwa okwu, CC BY 4.0, used with permission). Pure types.
//
// Everything here is "pending native review": the sentences are imported
// dataset text with the dataset's own recordings, chosen by a script, never
// written by Okwu. Conversation lines that the data could not supply are
// `draft-ai` and are hidden from release builds until a native speaker
// rewrites them (CONTRACTS §0 rule 1).

/** One phrase as shipped: [id, Igbo (spelling layer, NFC), English, AudioId or ""]. */
export type PhraseRow = [id: string, igbo: string, en: string, audio: string];

export type SituationId =
  | "greetings"
  | "family"
  | "market"
  | "food"
  | "travel"
  | "church"
  | "feelings"
  | "health"
  | "time"
  | "phone"
  | "celebrations"
  | "emergencies";

export interface SituationFile {
  id: SituationId;
  title: string;
  /** One line about when these phrases help. */
  blurb: string;
  phrases: PhraseRow[];
}

export interface PhrasebookFile {
  version: 1;
  /** The attribution every phrasebook screen carries. */
  credit: string;
  /** Review state of every phrase: imported, never yet reviewed by Okwu. */
  review: "pending-native-review";
  /** How the selection was made (reproducible: same dataset + rules → same file). */
  selection: { command: string; rules: string; lint: string; dataset: string };
  situations: SituationFile[];
}

export interface Phrase {
  id: string;
  igbo: string;
  en: string;
  /** Dataset AudioId ("ia_…" / "iax_…"), or null. */
  audio: string | null;
  situation: SituationId;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export type ConversationId =
  | "partners-family"
  | "calling-grandma"
  | "market-bargain"
  | "christmas-home"
  | "wedding"
  | "church"
  | "naming"
  | "directions"
  | "welcoming-guests";

export interface ConversationRole {
  id: string;
  /** English label ("You", "Grandma", "The trader"). */
  name: string;
  /** Who they are in the scene. */
  note: string;
}

export type LineProvenance = "igbo-api" | "draft-ai";

export interface ConversationLine {
  role: string;
  /** NFC Igbo, spelling layer. */
  igbo: string;
  en: string;
  /** Dataset AudioId, or null (draft-ai lines have no recording). */
  audio: string | null;
  provenance: LineProvenance;
  /** Dataset sentence id ("ia.x.…"), or "draft-ai:<conversation>:<n>". */
  source: string;
  /** For draft-ai lines: what the native rewrite must check. */
  reviewNote?: string;
  /** The dataset's own English, when `en` was tidied or corrected (for the reviewer). */
  glossEdited?: string;
}

export interface CulturalTip {
  title: string;
  body: string;
}

export interface ConversationFile {
  id: ConversationId;
  title: string;
  /** The scene in a sentence or two. */
  setting: string;
  roles: ConversationRole[];
  /** The role offered to the learner first. */
  learnerRole: string;
  lines: ConversationLine[];
  /** Pending cultural review. */
  tips: CulturalTip[];
}

export interface ConversationsFile {
  version: 1;
  credit: string;
  review: "pending-native-review";
  tipsReview: "pending-cultural-review";
  selection: { command: string; dataset: string };
  conversations: ConversationFile[];
}
