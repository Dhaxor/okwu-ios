// Real-life conversations: what ships, and the role-play player's pure
// state (conversation.test.ts). Three ways to practise:
//
//   listen   hear the whole conversation, line by line
//   role     take one part: the others' lines play, and on yours you hear the
//            native line, shadow it (record and replay on iPhone), then say
//            how it went, "Matched" or "Not yet"
//   recall   "say it before you hear it": on your lines you see only the
//            English, say the Igbo from memory, then reveal and hear it, and
//            say how it went
//
// Self-assessment only: there is no score, no percentage and no verdict.
// "Not yet" only gathers the line into "try these again".
import type { ConversationFile, ConversationId, ConversationLine, ConversationsFile } from "./types";

export type PracticeMode = "listen" | "role" | "recall";
export const PRACTICE_MODES: readonly PracticeMode[] = ["listen", "role", "recall"];

export function isPracticeMode(v: unknown): v is PracticeMode {
  return typeof v === "string" && (PRACTICE_MODES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// What ships
// ---------------------------------------------------------------------------

export function hasDraftLines(c: Pick<ConversationFile, "lines">): boolean {
  return c.lines.some((l) => l.provenance === "draft-ai");
}

/**
 * The conversations a build may show. AI-drafted Igbo never reaches a
 * release build (CONTRACTS §0 rule 1): a conversation with a draft line is
 * left out until a native speaker rewrites that line. Development builds
 * show everything, with the draft lines flagged.
 */
export function releaseConversations(file: Pick<ConversationsFile, "conversations">, opts: { production: boolean }): ConversationFile[] {
  return opts.production ? file.conversations.filter((c) => !hasDraftLines(c)) : [...file.conversations];
}

export function roleName(c: ConversationFile, roleId: string): string {
  return c.roles.find((r) => r.id === roleId)?.name ?? roleId;
}

export function linesOf(c: ConversationFile, roleId: string): number {
  return c.lines.filter((l) => l.role === roleId).length;
}

/** A tip's text in runs: Igbo words are written _like this_ and set in the Igbo face. */
export function tipParts(text: string): { text: string; igbo: boolean }[] {
  const out: { text: string; igbo: boolean }[] = [];
  text.split(/_([^_]+)_/u).forEach((part, i) => {
    if (part) out.push({ text: part, igbo: i % 2 === 1 });
  });
  return out;
}

/** A tip's text with the markers removed (for accessibility labels and search). */
export function tipPlain(text: string): string {
  return text.replace(/_([^_]+)_/gu, "$1");
}

// ---------------------------------------------------------------------------
// The player
// ---------------------------------------------------------------------------

export type SelfMark = "matched" | "not-yet";

export interface PlayerState {
  mode: PracticeMode;
  /** The learner's part (unused when listening). */
  role: string;
  /** Lines on screen so far; the current line is `shown - 1`. */
  shown: number;
  /** Recall: the current line's Igbo has been revealed. */
  revealed: boolean;
  /** The learner's own verdicts, by line index. */
  marks: Record<number, SelfMark>;
  done: boolean;
}

export function startPlayer(c: ConversationFile, mode: PracticeMode, role?: string): PlayerState {
  const part = role && c.roles.some((r) => r.id === role) ? role : c.learnerRole;
  return { mode, role: part, shown: c.lines.length > 0 ? 1 : 0, revealed: false, marks: {}, done: c.lines.length === 0 };
}

export function currentIndex(s: PlayerState): number {
  return Math.max(0, s.shown - 1);
}

export function isMine(c: ConversationFile, s: PlayerState, i: number): boolean {
  return s.mode !== "listen" && c.lines[i]?.role === s.role;
}

/**
 * What the screen asks for at the current line:
 *   listen        another speaker's line (or listening mode): it plays, then the next one comes
 *   recall-prompt your line, Igbo hidden: say it from memory, then reveal
 *   self          your line, shown: shadow it, then "Matched" or "Not yet"
 *   end           the conversation is over
 */
export type Step = "listen" | "recall-prompt" | "self" | "end";

export function stepOf(c: ConversationFile, s: PlayerState): Step {
  if (s.done) return "end";
  const i = currentIndex(s);
  if (!isMine(c, s, i)) return "listen";
  if (s.mode === "recall" && !s.revealed) return "recall-prompt";
  return "self";
}

/** Is a line's Igbo visible? Everything is, except your current line in recall mode before you reveal it. */
export function igboVisible(c: ConversationFile, s: PlayerState, i: number): boolean {
  if (s.done || i !== currentIndex(s)) return true;
  return !(s.mode === "recall" && isMine(c, s, i) && !s.revealed);
}

/** On to the next line, or to the end. */
export function advance(c: ConversationFile, s: PlayerState): PlayerState {
  if (s.done) return s;
  if (s.shown >= c.lines.length) return { ...s, done: true, revealed: false };
  return { ...s, shown: s.shown + 1, revealed: false };
}

export function reveal(s: PlayerState): PlayerState {
  return s.revealed ? s : { ...s, revealed: true };
}

/** The learner's own verdict on their current line, then the next line. Ignored on someone else's line. */
export function markLine(c: ConversationFile, s: PlayerState, mark: SelfMark): PlayerState {
  const i = currentIndex(s);
  if (s.done || !isMine(c, s, i)) return s;
  return advance(c, { ...s, marks: { ...s.marks, [i]: mark } });
}

export interface PracticeSummary {
  mode: PracticeMode;
  /** Your lines in this conversation. */
  yourLines: number;
  /** Lines you said aloud (each one you marked, either way). */
  said: number;
  /** Lines you marked "Not yet", to try again. Never a score. */
  again: ConversationLine[];
}

export function summaryOf(c: ConversationFile, s: PlayerState): PracticeSummary {
  const marked = Object.entries(s.marks);
  return {
    mode: s.mode,
    yourLines: s.mode === "listen" ? 0 : linesOf(c, s.role),
    said: marked.length,
    again: marked
      .filter(([, m]) => m === "not-yet")
      .map(([i]) => c.lines[Number(i)])
      .filter((l): l is ConversationLine => !!l),
  };
}

/** Rough time to read a line that has no recording, so listening mode can move on by itself. */
export function readingMs(line: Pick<ConversationLine, "igbo" | "en">): number {
  const words = `${line.igbo} ${line.en}`.split(/\s+/).filter(Boolean).length;
  return Math.min(6000, Math.max(2200, words * 260));
}

// ---------------------------------------------------------------------------
// Practice log (okwu.convpractice.v1): which conversations you have practised
// ---------------------------------------------------------------------------

export const PRACTICE_LOG_KEY = "okwu.convpractice.v1";

export interface PracticeEntry {
  sessions: number;
  lastAt: string;
  lastMode: PracticeMode;
}

export type PracticeLog = Partial<Record<ConversationId, PracticeEntry>>;

const CONVERSATION_IDS: readonly ConversationId[] = [
  "partners-family",
  "calling-grandma",
  "market-bargain",
  "christmas-home",
  "wedding",
  "church",
  "naming",
  "directions",
  "welcoming-guests",
];

export function parsePracticeLog(raw: string | null): PracticeLog {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const out: PracticeLog = {};
    for (const id of CONVERSATION_IDS) {
      const e = (v as Record<string, unknown>)[id];
      if (typeof e !== "object" || e === null) continue;
      const { sessions, lastAt, lastMode } = e as Record<string, unknown>;
      if (typeof sessions !== "number" || !Number.isFinite(sessions) || sessions < 1) continue;
      if (typeof lastAt !== "string" || Number.isNaN(Date.parse(lastAt)) || !isPracticeMode(lastMode)) continue;
      out[id] = { sessions: Math.min(Math.floor(sessions), 100_000), lastAt, lastMode };
    }
    return out;
  } catch {
    return {};
  }
}

export function recordPractice(log: PracticeLog, id: ConversationId, mode: PracticeMode, now: Date): PracticeLog {
  const prev = log[id];
  return { ...log, [id]: { sessions: (prev?.sessions ?? 0) + 1, lastAt: now.toISOString(), lastMode: mode } };
}
