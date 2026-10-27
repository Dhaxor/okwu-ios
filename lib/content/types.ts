// Content data model (owner A: learning engine + content pipeline).
// docs/CONTRACTS.md §1 is the prose version; change both together.
//
// Ground rules the types encode:
// - Spelling and tone are separate layers. `spelling` is NFC Ọnwụ
//   orthography with dots and NO tone marks (how Igbo is written day to
//   day). Tone lives per syllable in a ToneLayer and is rendered on top.
// - Nothing ships without two independent native reviews and an
//   adjudication (ReviewSignoff). AI never authors shipped Igbo, tones or
//   audio; `Provenance` records where every string came from.
// - Every Igbo string is NFC at rest; lengths count graphemes
//   (lib/igbo/text.ts).

/** Nominal string ids, so an ItemId cannot be passed where a LessonId is expected. */
type Brand<T, B extends string> = T & { readonly __brand: B };

export type ItemId = Brand<string, "ItemId">;
export type LessonId = Brand<string, "LessonId">;
export type UnitId = Brand<string, "UnitId">;
export type TrackId = Brand<string, "TrackId">;
export type StoryId = Brand<string, "StoryId">;
export type AudioId = Brand<string, "AudioId">;
export type VoiceId = Brand<string, "VoiceId">;
export type ContributorId = Brand<string, "ContributorId">;
/** A home-dialect profile id from the linguist's registry (content/registry/dialects.yaml); "standard" is Igbo Izugbe. */
export type DialectId = Brand<string, "DialectId"> | "standard";
/** ISO-8601 timestamp (UTC). */
export type IsoTime = string;

export type Cefr = "A0" | "A1" | "A2" | "B1";

/**
 * Tone of one syllable: H high, L low, D downstepped high (written with a
 * macron). Syllabic nasals (m, n, ṅ) are syllables and carry tone too.
 */
export type Tone = "H" | "L" | "D";

export interface Syllable {
  /** NFC, spelling layer (dots, no tone marks), e.g. "kwa". */
  text: string;
  tone: Tone;
}

/**
 * The pronunciation layer. Word cards use citation tone; sentence cards use
 * surface tone verified against the recording by a linguist.
 */
export interface ToneLayer {
  syllables: Syllable[];
  kind: "citation" | "surface";
  /** For surface tone: the clip it was verified against, and who verified it. */
  verifiedAgainst?: AudioId;
  verifiedBy?: ContributorId;
  /**
   * Drafts only: a linguist has not authored the tones yet. `syllables` is
   * then empty; render the spelling with no tone marks and no pitch line.
   * Never set on approved content (the linter and compiler refuse it).
   */
  pending?: true;
}

export type ItemKind = "word" | "phrase" | "sentence" | "dialogue-line" | "proverb" | "name";

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "numeral" | "particle" | "interjection" | "phrase";

/** Vowel-harmony set of a stem: {a ị ọ ụ} or {e i o u}. */
export type HarmonySet = "a" | "e";

export interface Gloss {
  /** Plain English meaning shown to learners. */
  en: string;
  /** Word-by-word rendering where it helps (proverbs, idioms). */
  literal?: string;
  /** Usage note (register, who you say it to). English only. */
  note?: string;
}

/** "Also said as …": a regional form, with audio from a speaker of that area. */
export interface DialectVariant {
  dialect: DialectId;
  /** NFC spelling layer. */
  spelling: string;
  tone?: ToneLayer;
  audio: AudioRef[];
  /** Accept this form as a correct answer for learners whose profile includes `dialect`. */
  acceptAsAnswer: boolean;
  note?: string;
}

export type AudioSpeed = "natural" | "slow";

export interface AudioRef {
  id: AudioId;
  voice: VoiceId;
  speed: AudioSpeed;
  /** Object key on Cloudflare R2 (64 kbps mono AAC); cached on device. */
  key: string;
  durationMs: number;
  sha256: string;
  /** Integrated loudness; the spec is −16 LUFS, true peak ≤ −1 dBTP. */
  lufs?: number;
  qa: { status: "pending" | "passed" | "failed"; checkedBy?: ContributorId; at?: IsoTime; notes?: string };
  /**
   * Human recording (false) or labelled synthetic speech, allowed only for
   * long-tail/user text after a blind tone audit. Course audio is always human.
   */
  synthetic: false | { model: string; label: "AI voice — tones may be wrong"; auditId: string };
}

export interface Voice {
  id: VoiceId;
  displayName: string;
  dialect: DialectId;
  /** Perpetual buyout signed; AI cloning/training forbidden unless separately consented. */
  contractRef: string;
}

/** Where a string came from. Licences are tracked per item (RESEARCH §3). */
export type Provenance =
  | { kind: "commissioned"; author: ContributorId }
  /**
   * Nkọwa okwu / Igbo API data, used with the owner's permission (2026-10)
   * under CC BY 4.0. `sourceId` is the Igbo API word or example id. Still
   * goes through our two native reviews before it ships in lessons.
   */
  | { kind: "igbo-api"; licenceRef: string; sourceId: string; attribution?: string }
  | { kind: "public-domain"; work: string }
  | { kind: "cc-by-sa"; work: string; attribution: string }
  /**
   * A development-only draft written with AI help, pending native review
   * (the Phase 0 pilot). It can never be approved: a linguist re-authors it
   * as `commissioned` first. Release bundles refuse it.
   */
  | { kind: "draft-ai"; note: string };

export interface ReviewVerdict {
  reviewer: ContributorId;
  verdict: "approve" | "changes" | "reject";
  notes?: string;
  at: IsoTime;
}

/** Results of the automated content linter (NFC, letter set, dots, harmony flags, glossary). */
export interface LintResult {
  passed: boolean;
  ruleVersion: string;
  issues: { rule: string; message: string; severity: "error" | "warning" }[];
}

/**
 * The quality pipeline per item: author → lint → reviewers A and B (blind,
 * independent) → lead adjudicates → record → audio QA → ship.
 */
export interface ReviewSignoff {
  authoredBy: ContributorId;
  lint: LintResult;
  /**
   * Exactly two independent reviews before approval; drafts and items in
   * review carry the ones recorded so far (none or one).
   */
  reviews: [] | [ReviewVerdict] | [ReviewVerdict, ReviewVerdict];
  adjudication?: { by: ContributorId; at: IsoTime; ruling: string; styleGuideRef?: string };
  approvedAt?: IsoTime;
}

export type ContentStatus = "draft" | "in-review" | "approved" | "retired";

export interface Item {
  id: ItemId;
  kind: ItemKind;
  /** NFC, dotted, no tone marks. */
  spelling: string;
  tone: ToneLayer;
  gloss: Gloss;
  pos?: PartOfSpeech;
  harmony?: HarmonySet;
  /** Topic and grammar tags, e.g. "greeting", "copula:bu", "negative". */
  tags: string[];
  /** Items this one is easily confused with (tone pairs, near spellings): for interleaving. */
  confusables: ItemId[];
  dialects: DialectVariant[];
  audio: AudioRef[];
  provenance: Provenance;
  review: ReviewSignoff;
  status: ContentStatus;
  version: number;
}

// ---------------------------------------------------------------------------
// Exercises (specs authored in lessons or produced by the generator)
// ---------------------------------------------------------------------------

export type ExerciseType =
  | "listen-choose"
  | "build-sentence"
  | "type-it"
  | "say-it"
  | "tone-pair"
  | "dialogue"
  | "story";

interface ExerciseBase<T extends ExerciseType> {
  type: T;
  /** Items this exercise reviews (feeds the scheduler). */
  items: ItemId[];
}

/** Hear an item, pick it (or its meaning) from options. */
export interface ListenChoose extends ExerciseBase<"listen-choose"> {
  prompt: ItemId;
  answer: "item" | "gloss";
  /** Distractors from the verified glossary only. */
  options: ItemId[];
  /**
   * A comprehension question about a story read earlier in the same lesson
   * (English). The compile step attaches it from the story's questions; the
   * screen asks it, and the session places it after the story.
   */
  comprehension?: { story: StoryId; question: string; answer: string };
}

/** Arrange tiles into the target sentence. Tiles come from verified items. */
export interface BuildSentence extends ExerciseBase<"build-sentence"> {
  target: ItemId;
  tiles: string[];
  distractorTiles: string[];
}

/**
 * Type the item with the ị ọ ụ ṅ key strip. Tone marks are never required
 * or marked wrong here (only in tone exercises); dialect variants the
 * learner's profile accepts are correct.
 */
export interface TypeIt extends ExerciseBase<"type-it"> {
  target: ItemId;
  prompt: "gloss" | "audio";
}

/**
 * Shadowing. Shows the native pitch line from the tone layer. A learner
 * overlay is allowed for words and short phrases only; never a score.
 * Self-assessment ("matched" / "not yet") feeds the scheduler.
 */
export interface SayIt extends ExerciseBase<"say-it"> {
  target: ItemId;
  overlay: boolean;
}

/** High-variability tone perception: one minimal set, many voices, interleaved. */
export interface TonePair extends ExerciseBase<"tone-pair"> {
  set: ItemId[];
  target: ItemId;
  voices: VoiceId[];
}

export interface Dialogue extends ExerciseBase<"dialogue"> {
  lines: { speaker: string; item: ItemId }[];
  learnerSpeaker: string;
}

export interface Story extends ExerciseBase<"story"> {
  story: StoryId;
  chapter: number;
  /** Tone marks shown by default (A0–A1) or tap-to-reveal (A2+). */
  tones: "shown" | "reveal";
}

export type ExerciseSpec = ListenChoose | BuildSentence | TypeIt | SayIt | TonePair | Dialogue | Story;

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

/**
 * A lesson's grammar or usage note: the "pattern" card at the lesson start,
 * re-openable during the lesson. English only; its Igbo examples are items,
 * shown with their tones, meaning and recording.
 */
export interface LessonNote {
  /** English title of the note. */
  title: string;
  /** The pattern in a few words, e.g. "Eke, Orie, Afọ, Nkwọ" (the card's headline). Absent on a culture-only note. */
  pattern?: string;
  /** The plain-English explanation. */
  body?: string;
  /** Igbo examples by item (only items in this bundle). */
  examples: ItemId[];
  /** A short culture note (English). */
  culture?: string;
  /** Anything but "approved" is shown with the pending-review tag. Release bundles keep approved notes only. */
  status: ContentStatus;
}

export interface Lesson {
  id: LessonId;
  unit: UnitId;
  index: number;
  /** English. */
  title: string;
  /** English. The first is the lesson's pattern line ("Pattern: …") when it has one. */
  objectives: string[];
  /** New items introduced here. */
  introduces: ItemId[];
  /** Authored exercises; the generator fills the rest from `introduces` and due reviews. */
  exercises: ExerciseSpec[];
  cefr: Cefr;
  /**
   * Minutes the planned session takes. The compile step replaces the
   * authored guess with the engine's estimate (`lessonMinutes`, from the
   * session the planner really builds).
   */
  estMinutes: number;
  /** The grammar or usage note shown at the lesson start (added 2026-10-23). */
  note?: LessonNote;
  status: ContentStatus;
  version: number;
}

export type StoryKind =
  /** Dataset sentences, each with its recording, read in order as one scene. */
  | "dataset-sequence"
  /** An English narrative carries the plot; recorded Igbo lines sit inside it. */
  | "bilingual-retelling";

/**
 * A graded story (Akụkọ). Its Igbo is its lines' items (with their tones and
 * recordings); the title, summary, narrative and questions are English.
 */
export interface StoryText {
  id: StoryId;
  /** English title, e.g. "Eke market day". */
  title: string;
  kind: StoryKind;
  cefr: Cefr;
  /** One-paragraph English summary. */
  summary: string;
  /** The Igbo lines in reading order. */
  lines: ItemId[];
  /**
   * bilingual-retelling only: the English narrative in paragraphs, each
   * followed by the lines it carries (1-based line numbers). Empty for a
   * dataset sequence.
   */
  narrative: { text: string; lines: number[] }[];
  /** English comprehension questions, asked after the story is read. `line` is 1-based. */
  questions: { question: string; answer: string; line: number; item: ItemId }[];
  /** Anything but "approved" is shown with the pending-review tag. Release bundles keep approved stories only. */
  status: ContentStatus;
}

export interface Unit {
  id: UnitId;
  track: TrackId;
  index: number;
  title: string;
  theme: string;
  lessons: LessonId[];
  cefr: Cefr;
  /** Part of the free core. */
  free: boolean;
  /** The Obodo place this unit restores (game layer). */
  obodoPlace?: string;
}

export interface Track {
  id: TrackId;
  kind: "new-learner" | "heritage";
  title: string;
  units: UnitId[];
  /** Heritage: listening-based placement that can skip units. */
  placement?: { lesson: LessonId; skipsTo: Record<string, UnitId> };
}

/**
 * An attribution the app must show (About → Credits) whenever the bundle
 * contains content it covers. The compiler refuses a bundle that uses a
 * licensed source without its credit.
 */
export interface Credit {
  /** Stable id, e.g. "igbo-api". */
  id: string;
  /** Shown as written, e.g. "Dictionary data and recordings: Nkọwa okwu (Igbo API), CC BY 4.0". */
  text: string;
  licence: string;
  url?: string;
  /** What it covers in this bundle: item text, recordings, or both. */
  covers: ("items" | "audio")[];
}

/** What the app loads: one versioned, compiled bundle (built by the content pipeline). */
export interface ContentBundle {
  version: string;
  builtAt: IsoTime;
  /** Only `approved` content; drafts never compile into a release bundle. */
  items: Record<string, Item>;
  lessons: Record<string, Lesson>;
  units: Record<string, Unit>;
  tracks: Record<string, Track>;
  voices: Record<string, Voice>;
  /** Attributions required by the sources used in this bundle (may be empty). */
  credits: Credit[];
  /**
   * The graded stories that story exercises name, by StoryId (added
   * 2026-10-23; absent in older bundles, so read it through `storyOf`).
   */
  stories?: Record<string, StoryText>;
  checksum: string;
}
