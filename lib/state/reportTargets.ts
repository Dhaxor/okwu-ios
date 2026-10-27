// What "Report a problem" offers on the phrasebook, conversation and library
// screens: one ReportSubject per thing on screen, with the id scheme
// ./reports.ts documents and the dataset record behind it (`ref`) for the
// reviewer. Pure (reportTargets.test.ts); the screens pass the result to
// ReportSheet (components/feature/practice).
import type { LibraryCustom, LibraryName, LibraryProverb, LibraryTale } from "@/lib/library/types";
import type { ConversationFile, Phrase } from "@/lib/phrasebook/types";
import type { ReportSubject, ReportTarget } from "./reports";

const target = (kind: ReportTarget["kind"], id: string, ref: string | null | undefined): ReportTarget => (ref ? { kind, id, ref } : { kind, id });

/** A phrasebook phrase (its id is the dataset sentence id; the ref is its recording). */
export function phraseSubject(phrase: Pick<Phrase, "id" | "igbo" | "en" | "audio">, version: string): ReportSubject {
  return { target: target("phrase", phrase.id, phrase.audio), shown: phrase.igbo, gloss: phrase.en, source: "phrasebook", version };
}

/** "<conversation id>/<line number from 1>" */
export const conversationLineId = (conversationId: string, index: number) => `${conversationId}/${index + 1}`;

/**
 * Conversation lines, newest first, by index into `conversation.lines`.
 * The ref is the dataset sentence id (or the "draft-ai:…" id of a line a
 * native speaker still has to rewrite). Unknown indexes are skipped.
 */
export function conversationLineSubjects(conversation: Pick<ConversationFile, "id" | "lines">, indexes: readonly number[], version: string): ReportSubject[] {
  const out: ReportSubject[] = [];
  for (const i of [...new Set(indexes)].sort((a, b) => b - a)) {
    const line = conversation.lines[i];
    if (!line) continue;
    out.push({ target: target("conversation-line", conversationLineId(conversation.id, i), line.source), shown: line.igbo, gloss: line.en, source: "conversation", version });
  }
  return out;
}

/**
 * The lines a learner can report in a practice run: the ones whose Igbo has
 * been shown so far (a recall line counts once it is revealed), the current
 * line first, at most `max`. At the end of the run, every line.
 */
export function reportableLines(shown: number, total: number, visible: (index: number) => boolean, done: boolean, max = 4): number[] {
  if (done) return Array.from({ length: total }, (_, i) => total - 1 - i);
  const out: number[] = [];
  for (let i = Math.min(shown, total) - 1; i >= 0 && out.length < max; i--) if (visible(i)) out.push(i);
  return out;
}

/** A name from the names book (shown as it is usually written; the ref is its recording). */
export function nameSubject(name: Pick<LibraryName, "id" | "spelling" | "short" | "meaning" | "audio">, version: string): ReportSubject {
  const gloss = name.short ?? name.meaning ?? undefined;
  return { target: target("name", name.id, name.audio), shown: name.spelling, ...(gloss ? { gloss } : {}), source: "library", version };
}

export function proverbSubject(proverb: Pick<LibraryProverb, "id" | "igbo" | "en" | "audio">, version: string): ReportSubject {
  return { target: target("proverb", proverb.id, proverb.audio), shown: proverb.igbo, gloss: proverb.en, source: "library", version };
}

/** "<tale id>/<Igbo line number from 1>", counting only the tale's Igbo lines. */
export function taleLineSubjects(tale: Pick<LibraryTale, "id" | "parts">, version: string): ReportSubject[] {
  const lines = tale.parts.flatMap((p) => (p.kind === "line" ? [p] : []));
  return lines.map((l, i) => ({ target: target("tale-line", `${tale.id}/${i + 1}`, l.audio), shown: l.igbo, gloss: l.en, source: "library" as const, version }));
}

/**
 * A festivals-and-customs page: the page itself (its Igbo name), then each
 * word you'll hear ("<id>/word-<n>") and each sentence ("<id>/line-<n>").
 */
export function customSubjects(custom: Pick<LibraryCustom, "id" | "kicker" | "title" | "words" | "lines">, version: string): ReportSubject[] {
  return [
    { target: target("custom", custom.id, null), shown: custom.kicker, gloss: custom.title, source: "library", version },
    ...custom.words.map((w, i) => ({ target: target("custom", `${custom.id}/word-${i + 1}`, w.audio), shown: w.text, gloss: w.gloss, source: "library" as const, version })),
    ...custom.lines.map((l, i) => ({ target: target("custom", `${custom.id}/line-${i + 1}`, l.audio), shown: l.igbo, gloss: l.en, source: "library" as const, version })),
  ];
}
