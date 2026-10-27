// "Report a problem" on Igbo content (a word, a lesson item, a dictionary
// entry, a phrase, a conversation line, a name, a proverb, a tale line or a
// custom): the learner picks what looks wrong (spelling, tone, translation,
// audio, dialect, culture) and may add a note. Pure (reports.test.ts); the
// hook is ./useReports.ts, and ./reportTargets.ts builds the targets for the
// phrasebook, the conversations and the library.
//
// Reports are kept on the device (okwu.contentreports.v1) and queued. The
// social server's report route is for people and their messages
// (REPORT_REASONS, CONTRACTS §4), not for content, so there is no content
// endpoint yet: CONTENT_REPORT_ROUTE is null and the queue stays local. The
// learner (or support) can export it as text. When a content route exists,
// set it here and send `queued(...)` reports, then `markSent`.
import { graphemeCount, graphemes, nfc } from "@/lib/igbo/text";

export const REPORTS_KEY = "okwu.contentreports.v1";

/** The server route for content reports, once there is one. */
export const CONTENT_REPORT_ROUTE: string | null = null;

export const REPORT_CATEGORIES = ["spelling", "tone", "translation", "audio", "dialect", "culture"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ReportCategory, { title: string; hint: string }> = {
  spelling: { title: "Spelling", hint: "A letter, a dot or a word looks wrong" },
  tone: { title: "Tone", hint: "The tone marks or the pitch line don't match" },
  translation: { title: "Translation", hint: "The English meaning is off" },
  audio: { title: "Audio", hint: "The recording is wrong, unclear or missing" },
  dialect: { title: "Dialect", hint: "A regional form or its place is wrong" },
  culture: { title: "Culture", hint: "It is used or explained in a way that isn't right" },
};

/** Longest note, in graphemes. */
export const MAX_NOTE = 280;
/** Reports kept on the device; the oldest sent ones go first. */
export const MAX_REPORTS = 200;

/** Where the learner was when they reported it. */
export const REPORT_SOURCES = ["dictionary", "lesson", "review", "tone-trainer", "speaking", "word-of-the-day", "phrasebook", "conversation", "library"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

/**
 * What was reported, and how its id reads:
 *   item               a bundle ItemId (lessons, practice)
 *   dictionary         a dictionary headword id
 *   phrase             a phrasebook phrase id (the dataset sentence id)
 *   conversation-line  "<conversation id>/<line number from 1>"
 *   name               a names-book id
 *   proverb            a proverb id
 *   tale-line          "<tale id>/<Igbo line number from 1>"
 *   custom             a festivals-and-customs page id, or "<page id>/word-<n>" /
 *                      "<page id>/line-<n>" for one of its words or sentences
 */
export const REPORT_TARGET_KINDS = ["item", "dictionary", "phrase", "conversation-line", "name", "proverb", "tale-line", "custom"] as const;
export type ReportTargetKind = (typeof REPORT_TARGET_KINDS)[number];

export const TARGET_KIND_LABELS: Record<ReportTargetKind, string> = {
  item: "item",
  dictionary: "dictionary word",
  phrase: "phrase",
  "conversation-line": "conversation line",
  name: "name",
  proverb: "proverb",
  "tale-line": "tale line",
  custom: "custom",
};

export interface ReportTarget {
  kind: ReportTargetKind;
  id: string;
  /** The dataset record behind it, for the reviewer: a sentence id ("ia.x.…") or a recording's AudioId. */
  ref?: string;
}

export interface ContentReport {
  id: string;
  createdAt: string;
  /** The content reported. */
  target: ReportTarget;
  /** What the learner saw (spelling, with tones when shown), for the reviewer. */
  shown: string;
  categories: ReportCategory[];
  note: string;
  source: ReportSource;
  /** Content bundle or dictionary version the learner saw. */
  version: string;
  status: "queued" | "sent";
}

export interface ReportInput {
  target: ReportTarget;
  shown: string;
  categories: readonly ReportCategory[];
  note?: string;
  source: ReportSource;
  version: string;
}

/** One thing on screen that can be reported, as the report sheet lists it. */
export interface ReportSubject {
  target: ReportTarget;
  /** What the learner sees (Igbo, with tones when shown). */
  shown: string;
  /** English meaning, to make sure the right thing is reported. */
  gloss?: string;
  source: ReportSource;
  /** Content bundle, dictionary or file version the learner saw. */
  version: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isKind = (v: unknown): v is ReportTargetKind => (REPORT_TARGET_KINDS as readonly unknown[]).includes(v);
const isSource = (v: unknown): v is ReportSource => (REPORT_SOURCES as readonly unknown[]).includes(v);

function targetOf(t: ReportTarget): ReportTarget {
  return t.ref ? { kind: t.kind, id: t.id, ref: t.ref } : { kind: t.kind, id: t.id };
}

/** Cut a note to MAX_NOTE graphemes (never splitting a letter from its marks). */
export function clampNote(note: string): string {
  const t = nfc(note).trim();
  if (graphemeCount(t) <= MAX_NOTE) return t;
  return graphemes(t).slice(0, MAX_NOTE).join("");
}

export function canSubmit(categories: readonly ReportCategory[]): boolean {
  return categories.some((c) => REPORT_CATEGORIES.includes(c));
}

let seq = 0;
export function reportId(now: Date): string {
  seq = (seq + 1) % 1296;
  return `r${now.getTime().toString(36)}${seq.toString(36).padStart(2, "0")}`;
}

export function makeReport(input: ReportInput, now: Date): ContentReport {
  const categories = REPORT_CATEGORIES.filter((c) => input.categories.includes(c));
  return {
    id: reportId(now),
    createdAt: now.toISOString(),
    target: targetOf(input.target),
    shown: nfc(input.shown),
    categories,
    note: clampNote(input.note ?? ""),
    source: input.source,
    version: input.version,
    status: "queued",
  };
}

/** Add a report (newest first); beyond MAX_REPORTS the oldest sent ones, then the oldest, are dropped. */
export function addReport(list: readonly ContentReport[], report: ContentReport): ContentReport[] {
  const next = [report, ...list.filter((r) => r.id !== report.id)];
  while (next.length > MAX_REPORTS) {
    const sent = next.map((r) => r.status).lastIndexOf("sent");
    next.splice(sent >= 0 ? sent : next.length - 1, 1);
  }
  return next;
}

export function queued(list: readonly ContentReport[]): ContentReport[] {
  return list.filter((r) => r.status === "queued");
}

export function markSent(list: readonly ContentReport[], ids: readonly string[]): ContentReport[] {
  const set = new Set(ids);
  return list.map((r) => (set.has(r.id) ? { ...r, status: "sent" as const } : r));
}

/** Parse the stored queue defensively: bad entries are dropped, never thrown. */
export function parseReports(raw: string | null): ContentReport[] {
  if (!raw) return [];
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const out: ContentReport[] = [];
  for (const r of v) {
    if (!isObj(r) || typeof r.id !== "string" || typeof r.createdAt !== "string" || Number.isNaN(Date.parse(r.createdAt))) continue;
    const t = r.target;
    if (!isObj(t) || !isKind(t.kind) || typeof t.id !== "string") continue;
    const categories = Array.isArray(r.categories) ? REPORT_CATEGORIES.filter((c) => (r.categories as unknown[]).includes(c)) : [];
    if (categories.length === 0) continue;
    out.push({
      id: r.id,
      createdAt: r.createdAt,
      target: targetOf({ kind: t.kind, id: t.id, ...(typeof t.ref === "string" && t.ref ? { ref: t.ref } : {}) }),
      shown: typeof r.shown === "string" ? nfc(r.shown) : "",
      categories,
      note: typeof r.note === "string" ? clampNote(r.note) : "",
      source: isSource(r.source) ? r.source : "dictionary",
      version: typeof r.version === "string" ? r.version : "",
      status: r.status === "sent" ? "sent" : "queued",
    });
  }
  return out.slice(0, MAX_REPORTS);
}

export function serializeReports(list: readonly ContentReport[]): string {
  return JSON.stringify(list);
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** The queue as CSV, one report per row (for the reviewers' sheet). */
export function reportsCsv(list: readonly ContentReport[]): string {
  const head = ["id", "created_at", "target_kind", "target_id", "shown", "categories", "note", "source", "version", "status", "target_ref"];
  const rows = list.map((r) => [r.id, r.createdAt, r.target.kind, r.target.id, r.shown, r.categories.join(" "), r.note, r.source, r.version, r.status, r.target.ref ?? ""].map(csvCell).join(","));
  return [head.join(","), ...rows].join("\n") + "\n";
}

/** A plain-text summary to share (one paragraph per report). */
export function reportsText(list: readonly ContentReport[]): string {
  if (list.length === 0) return "No reports.";
  return list
    .map((r) => {
      const what = r.categories.map((c) => CATEGORY_LABELS[c].title.toLowerCase()).join(", ");
      const note = r.note ? `\n  "${r.note}"` : "";
      return `${r.createdAt.slice(0, 10)}  ${r.shown} (${TARGET_KIND_LABELS[r.target.kind]} ${r.target.id}): ${what}${note}`;
    })
    .join("\n");
}
