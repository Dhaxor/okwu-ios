// The content linter (owner A). It FLAGS problems and never fixes them: a
// person decides every change. Build-time and review-time only; the app
// does not lint at runtime.
//
// Rules (docs/CONTRACTS.md §1, docs/STYLE_GUIDE.md):
//   nfc               every Igbo string is NFC
//   letters           only the 36 Ọnwụ letters (no c outside ch, no q or x, no look-alikes)
//   tone-in-spelling  the spelling layer carries no tone marks
//   dots              known dotted words written without their dots
//   harmony           subject pronouns i/ị, o/ọ agree with the next word ("ka ị mere" → "ka i mere")
//   affix-harmony     a-/e- prefixes with -la/-ghị, and i-/ị- infinitives, agree with the root (warning)
//   glossary          one meaning per word and tone pattern, matching the glossary
//   tone-layer        the tone layer rejoins to the spelling, one tone per syllable, legal downsteps
//   tone-pending      tones not authored yet (warning on drafts, error once in review)
//   review            two blind reviews by people other than the author, an adjudication, before approval
//   provenance        licence fields present; AI drafts and invented proverbs can never be approved
//   gloss, audio, dialects, confusables, reviewer-notes
//
// Pure TypeScript; tested by bun (lint.test.ts).
import { bareWord, firstVowelClass, HARMONY_OF, HARMONY_PARTNER, hasDots, letterIssues, stripDots, tokenizeLetters, words } from "@/lib/igbo/letters";
import { parseToneText, syllablesMatchSpelling, toneSequenceIssues, withoutBreaks } from "@/lib/igbo/syllables";
import { nfc, stripTones } from "@/lib/igbo/text";
import type { AudioRef, ContentStatus, Gloss, Item, ItemKind, LintResult, PartOfSpeech, Provenance, ReviewVerdict, ToneLayer } from "./types";

export const LINT_RULE_VERSION = "okwu-lint-1";

export type LintRule =
  | "nfc"
  | "letters"
  | "tone-in-spelling"
  | "dots"
  | "harmony"
  | "affix-harmony"
  | "glossary"
  | "tone-layer"
  | "tone-pending"
  | "review"
  | "provenance"
  | "gloss"
  | "audio"
  | "dialects"
  | "confusables"
  | "reviewer-notes";

/** Rules a lead linguist may waive for one item, with a written reason (e.g. a family's customary name spelling). */
export const WAIVABLE_RULES: readonly LintRule[] = ["letters", "dots", "harmony", "affix-harmony", "glossary", "tone-layer"];

export type LintIssue = LintResult["issues"][number];

/** One canonical meaning in the glossary (content/glossary.yaml). */
export interface GlossaryEntry {
  /** Spelling layer, NFC, no tone marks. */
  igbo: string;
  /** Citation tones as tone-marked text, when authored. */
  tone?: string | null;
  en: string;
  pos?: PartOfSpeech;
}

/** What the linter looks at: a compiled Item or an authored source item. */
export interface LintSubject {
  id: string;
  kind: ItemKind;
  pos?: PartOfSpeech;
  status: ContentStatus;
  provenance: Provenance;
  spelling: string;
  /** Authored tone-marked text (source format). When absent, `tone` is checked instead. */
  toneText?: string | null;
  tone: ToneLayer;
  gloss: Gloss;
  dialects: readonly { dialect: string; spelling: string; toneText?: string | null; tone?: ToneLayer }[];
  review: {
    authoredBy: string;
    reviews: readonly ReviewVerdict[];
    adjudication?: { by: string; at: string; ruling: string; styleGuideRef?: string } | null;
    approvedAt?: string | null;
  };
  audio: readonly AudioRef[];
  confusables: readonly string[];
  /** What a native linguist must confirm (source format; required on AI drafts). */
  reviewerNotes?: readonly string[];
  /** Waivers recorded by the lead linguist. */
  waive?: readonly { rule: string; reason: string }[];
}

export interface LintContext {
  glossary?: readonly GlossaryEntry[];
  /** Every item in the corpus, for cross-item checks (glossary consistency, confusables). */
  corpus?: readonly LintSubject[];
  /** Dialect ids from the registry (content/dialects.yaml). */
  dialects?: ReadonlySet<string>;
  /** Voice ids from the registry (content/voices.yaml). */
  voices?: ReadonlySet<string>;
  /** Extra known dotted words (the glossary's dotted words are added automatically). */
  knownDotted?: readonly string[];
}

/**
 * Dotted words whose undotted spelling is not a standard word, so writing
 * them without dots is a slip. Conservative and sourced (docs/research):
 * homographs that differ only by a dot (di/dị, i/ị, o/ọ, ogu/ọgụ, nnu/nnụ)
 * are deliberately absent. The glossary extends this list.
 */
export const KNOWN_DOTTED: readonly string[] = [
  "kedụ", // Nkọwa okwu entry
  "daalụ",
  "nnọọ",
  "ụtụtụ",
  "ọma",
  "ụlọ", // Ọnwụ 1961: n'ụlọ
  "akwụkwọ", // Ọnwụ 1961
  "ahịa",
  "nkwọ",
  "abụọ",
  "asatọ",
  "anyị",
  "nwaanyị",
  "mmanụ",
  "ọjị",
  "gị",
];

const PRONOUNS: ReadonlySet<string> = new Set(["i", "ị", "o", "ọ"]);
const TONE_MARK_RE = /[̀́̄]/u;
const ALLOWED_PUNCT = /^[\s?!.,;:'’ʼ"“”()\-‐…·|]$/u;

class Collector {
  readonly issues: LintIssue[] = [];
  constructor(private readonly waivers: ReadonlyMap<string, string>) {}
  add(rule: LintRule, severity: "error" | "warning", message: string) {
    const reason = this.waivers.get(rule);
    if (reason !== undefined && WAIVABLE_RULES.includes(rule)) {
      this.issues.push({ rule, severity: "warning", message: `${message} (waived: ${reason})` });
    } else {
      this.issues.push({ rule, severity, message });
    }
  }
  error(rule: LintRule, message: string) {
    this.add(rule, "error", message);
  }
  warn(rule: LintRule, message: string) {
    this.add(rule, "warning", message);
  }
}

const lowerPlain = (w: string) => nfc(stripTones(w).toLowerCase());
const tonePatternOf = (layer: ToneLayer | undefined, toneText?: string | null): string | null => {
  if (toneText) {
    const p = parseToneText(toneText);
    return p.complete ? p.syllables.map((s) => s.tone).join("") : null;
  }
  if (!layer || layer.pending || layer.syllables.length === 0) return null;
  return layer.syllables.map((s) => s.tone).join("");
};

function checkNfc(c: Collector, label: string, value: string | null | undefined) {
  if (value && value !== nfc(value)) c.error("nfc", `${label} is not NFC: normalise "${value}" (a dotted vowel with a tone mark must be the composed letter + one combining mark)`);
}

function checkSpellingLayer(c: Collector, label: string, spelling: string) {
  checkNfc(c, label, spelling);
  for (const issue of letterIssues(spelling)) {
    if (issue.kind === "lone-c") c.error("letters", `${label}: "c" is only written in "ch" in the Ọnwụ orthography`);
    else if (issue.kind === "lookalike") c.error("letters", `${label}: "${issue.text}" looks like "${issue.suggestion}"; use the Ọnwụ letter`);
    else c.error("letters", `${label}: "${issue.text}" is not one of the 36 Ọnwụ letters`);
  }
  for (const t of tokenizeLetters(spelling)) {
    if (!t.isLetter && !ALLOWED_PUNCT.test(t.text) && !/\p{M}/u.test(t.text)) c.warn("letters", `${label}: unexpected character "${t.text}"`);
  }
  if (TONE_MARK_RE.test(spelling.normalize("NFD"))) {
    c.error("tone-in-spelling", `${label}: the spelling layer has tone marks; write them in the tone layer only`);
  }
}

function checkDots(c: Collector, label: string, spelling: string, known: ReadonlySet<string>, undotted: ReadonlySet<string>, byFold: ReadonlyMap<string, string>) {
  for (const raw of words(spelling)) {
    const w = lowerPlain(bareWord(raw));
    if (!w || known.has(w) || undotted.has(w)) continue;
    const target = byFold.get(stripDots(w));
    if (target && target !== w) c.error("dots", `${label}: "${bareWord(raw)}" is missing a dot; the known word is "${target}"`);
  }
}

function checkHarmony(c: Collector, label: string, spelling: string) {
  const ws = words(spelling);
  for (let i = 0; i < ws.length - 1; i++) {
    const raw = ws[i] as string;
    if (bareWord(raw) !== raw) continue; // "O," is not a subject before a verb
    const w = lowerPlain(raw);
    if (!PRONOUNS.has(w)) continue;
    const next = ws[i + 1] as string;
    const nextClass = firstVowelClass(lowerPlain(bareWord(next)));
    const own = HARMONY_OF[w];
    if (!nextClass || !own || nextClass === own) continue;
    const fix = HARMONY_PARTNER[w] ?? w;
    const set = nextClass === "a" ? "{a ị ọ ụ}" : "{e i o u}";
    c.error("harmony", `${label}: "${raw} ${bareWord(next)}": the pronoun must agree with "${bareWord(next)}" (${set} vowels); expected "${fix}"`);
  }
}

const NEG_OR_IMPERATIVE = /^([ae])(.+?)(la|ghị|ghi)$/u;

function checkAffixes(c: Collector, label: string, spelling: string, subject: Pick<LintSubject, "kind" | "pos">) {
  for (const raw of words(spelling)) {
    const w = lowerPlain(bareWord(raw));
    const m = NEG_OR_IMPERATIVE.exec(w);
    if (m) {
      const prefix = m[1] as string;
      const rootClass = firstVowelClass(m[2] as string);
      if (rootClass && HARMONY_OF[prefix] !== rootClass) {
        c.warn("affix-harmony", `${label}: "${bareWord(raw)}": the prefix "${prefix}-" may not agree with the root "${m[2]}"; check harmony`);
      }
    }
    if (subject.kind === "word" && subject.pos === "verb" && /^[iị][^aeiouịọụ]/u.test(w)) {
      const rootClass = firstVowelClass(w.slice(1));
      const own = HARMONY_OF[w[0] as string];
      if (rootClass && own && rootClass !== own) {
        c.warn("affix-harmony", `${label}: infinitive "${bareWord(raw)}": "${w[0]}-" may not agree with the root; check harmony`);
      }
    }
  }
}

function checkToneLayer(c: Collector, label: string, spelling: string, status: ContentStatus, toneText: string | null | undefined, layer: ToneLayer | undefined, kind: ItemKind | null) {
  const pendingSeverity = status === "draft" ? "warning" : "error";
  if (toneText !== undefined) {
    if (toneText === null || toneText.trim() === "") {
      c.add("tone-pending", pendingSeverity, `${label}: tones not authored yet`);
      return;
    }
    checkNfc(c, `${label} tone text`, toneText);
    const parsed = parseToneText(toneText);
    if (parsed.spelling !== spelling) {
      c.error("tone-layer", `${label}: the tone text "${withoutBreaks(toneText)}" does not spell "${spelling}" once tone marks are removed`);
    }
    for (const issue of parsed.issues) c.warn("tone-layer", `${label}: ${issue}`);
    if (!parsed.complete) {
      const missing = parsed.syllables.filter((s) => s.tone === null).map((s) => s.text);
      c.add("tone-pending", pendingSeverity, `${label}: no tone on ${missing.map((m) => `"${m}"`).join(", ")}`);
    }
    for (const issue of toneSequenceIssues(parsed.syllables.map((s) => s.tone))) c.warn("tone-layer", `${label}: ${issue}`);
  } else if (layer) {
    if (layer.pending || layer.syllables.length === 0) {
      c.add("tone-pending", pendingSeverity, `${label}: tones not authored yet`);
    } else {
      for (const s of layer.syllables) {
        checkNfc(c, `${label} syllable`, s.text);
        if (TONE_MARK_RE.test(s.text.normalize("NFD"))) c.error("tone-layer", `${label}: syllable "${s.text}" has a tone mark; the syllable text is the spelling layer`);
      }
      if (!syllablesMatchSpelling(spelling, layer.syllables)) {
        c.error("tone-layer", `${label}: the tone layer's syllables (${layer.syllables.map((s) => s.text).join("·")}) do not rejoin to "${spelling}"`);
      }
      for (const issue of toneSequenceIssues(layer.syllables.map((s) => s.tone))) c.warn("tone-layer", `${label}: ${issue}`);
    }
  }
  if (layer && kind) {
    const sentenceLike = kind === "sentence" || kind === "dialogue-line" || kind === "proverb";
    if ((kind === "word" || kind === "name") && layer.kind === "surface") c.warn("tone-layer", `${label}: word cards use citation tone`);
    if (sentenceLike && layer.kind === "citation") c.warn("tone-layer", `${label}: sentences use surface tone verified against a clip`);
    if (status === "approved" && layer.kind === "surface" && (!layer.verifiedAgainst || !layer.verifiedBy)) {
      c.error("tone-layer", `${label}: surface tone must name the clip it was verified against and the linguist who verified it`);
    }
  }
}

function checkReview(c: Collector, s: LintSubject) {
  const { review, status } = s;
  if (review.reviews.length > 2) c.error("review", "more than two reviews: the pipeline uses exactly two blind reviewers and the lead adjudicates");
  const reviewers: string[] = review.reviews.map((r) => String(r.reviewer));
  if (new Set(reviewers).size !== reviewers.length) c.error("review", "the two reviews must come from two different people");
  if (reviewers.includes(review.authoredBy)) c.error("review", "an author cannot review their own item");
  if (review.adjudication && reviewers.includes(review.adjudication.by) && review.reviews.length === 2) {
    c.warn("review", "the adjudicator is also one of the reviewers");
  }
  if (status !== "approved") return;
  if (review.reviews.length !== 2) c.error("review", `approved with ${review.reviews.length} review(s); exactly two blind reviews are required`);
  if (!review.adjudication) c.error("review", "approved without the lead's adjudication");
  if (!review.approvedAt) c.error("review", "approved without an approval time");
  const objections = review.reviews.filter((r) => r.verdict !== "approve");
  if (objections.some((r) => r.verdict === "reject") && !review.adjudication?.styleGuideRef) {
    c.error("review", "a reviewer rejected this item; approval needs an adjudication that cites the style guide");
  }
}

function checkProvenance(c: Collector, s: LintSubject) {
  const p = s.provenance;
  switch (p.kind) {
    case "igbo-api":
      if (!p.licenceRef.trim()) c.error("provenance", "Igbo API content needs the written licence reference");
      if (!p.sourceId.trim()) c.error("provenance", "Igbo API content needs the source entry id");
      break;
    case "cc-by-sa":
      if (!p.attribution.trim() || !p.work.trim()) c.error("provenance", "CC BY-SA content needs the work and the attribution");
      break;
    case "public-domain":
      if (!p.work.trim()) c.error("provenance", "public-domain content needs the work it came from");
      break;
    case "commissioned":
      if (!String(p.author).trim()) c.error("provenance", "commissioned content needs its author");
      break;
    case "draft-ai":
      if (s.status === "approved") c.error("provenance", "an AI draft can never be approved; a linguist re-authors it as commissioned first");
      if (s.kind === "proverb") c.error("provenance", "proverbs are never drafted by AI; they come from native sources only");
      if (s.reviewerNotes !== undefined && s.reviewerNotes.filter((n) => n.trim()).length === 0) {
        c.error("reviewer-notes", "an AI draft must list what a native linguist has to confirm");
      }
      break;
  }
}

interface Prepared {
  known: Set<string>;
  undotted: Set<string>;
  dotFold: Map<string, string>;
  glossaryByKey: Map<string, GlossaryEntry[]>;
  glossaryWords: Set<string>;
  corpusByKey: Map<string, LintSubject[]>;
  corpusById: Map<string, LintSubject>;
  tones: WeakMap<LintSubject, string | null>;
}

/** Indexes over the context, built once per context object (the import lints tens of thousands of items). */
const preparedCache = new WeakMap<LintContext, Prepared>();
const EMPTY_CTX: LintContext = {};

function prepare(ctx: LintContext): Prepared {
  const hit = preparedCache.get(ctx);
  if (hit) return hit;
  const glossary = ctx.glossary ?? [];
  const glossaryDotted = glossary.map((g) => lowerPlain(g.igbo)).filter((w) => hasDots(w));
  const known = new Set([...KNOWN_DOTTED, ...(ctx.knownDotted ?? []), ...glossaryDotted].map((w) => lowerPlain(w)));
  const undotted = new Set(glossary.map((g) => lowerPlain(g.igbo)).filter((w) => !hasDots(w)));
  const dotFold = new Map<string, string>();
  for (const k of known) dotFold.set(stripDots(k), k);
  const glossaryByKey = new Map<string, GlossaryEntry[]>();
  for (const g of glossary) {
    const k = lowerPlain(g.igbo);
    glossaryByKey.set(k, [...(glossaryByKey.get(k) ?? []), g]);
  }
  const corpusByKey = new Map<string, LintSubject[]>();
  const corpusById = new Map<string, LintSubject>();
  for (const x of ctx.corpus ?? []) {
    const k = `${x.kind}|${lowerPlain(x.spelling)}`;
    const list = corpusByKey.get(k);
    if (list) list.push(x);
    else corpusByKey.set(k, [x]);
    corpusById.set(x.id, x);
  }
  const p: Prepared = { known, undotted, dotFold, glossaryByKey, glossaryWords: new Set(glossaryByKey.keys()), corpusByKey, corpusById, tones: new WeakMap() };
  preparedCache.set(ctx, p);
  return p;
}

function patternOf(p: Prepared, x: LintSubject): string | null {
  if (p.tones.has(x)) return p.tones.get(x) ?? null;
  const t = tonePatternOf(x.tone, x.toneText);
  p.tones.set(x, t);
  return t;
}

function checkGlossary(c: Collector, s: LintSubject, ctx: LintContext, p: Prepared) {
  const glossary = ctx.glossary ?? [];
  const key = lowerPlain(s.spelling);
  const myTones = patternOf(p, s);
  if (s.kind === "word" || s.kind === "name") {
    const entries = p.glossaryByKey.get(key) ?? [];
    if (entries.length > 0) {
      const sameTone = entries.filter((g) => {
        const t = g.tone ? tonePatternOf(undefined, g.tone) : null;
        return t === null || myTones === null || t === myTones;
      });
      const pool = sameTone.length > 0 ? sameTone : entries;
      const ok = pool.some((g) => g.en.trim().toLowerCase() === s.gloss.en.trim().toLowerCase());
      if (!ok) {
        c.error("glossary", `"${s.spelling}" means ${pool.map((g) => `"${g.en}"`).join(" or ")} in the glossary, but this item says "${s.gloss.en}"`);
      }
    } else if (s.status !== "draft" && glossary.length > 0) {
      c.warn("glossary", `"${s.spelling}" is not in the glossary yet`);
    }
  } else if (s.status !== "draft" && glossary.length > 0) {
    for (const raw of words(s.spelling)) {
      const w = lowerPlain(bareWord(raw));
      if (w && !p.glossaryWords.has(w)) c.warn("glossary", `"${bareWord(raw)}" is not in the glossary`);
    }
  }
  for (const other of p.corpusByKey.get(`${s.kind}|${key}`) ?? []) {
    if (other.id === s.id) continue;
    const theirTones = patternOf(p, other);
    const sameGloss = other.gloss.en.trim().toLowerCase() === s.gloss.en.trim().toLowerCase();
    if (myTones !== null && theirTones !== null && myTones === theirTones && !sameGloss) {
      c.error("glossary", `"${s.spelling}" with the same tones means "${other.gloss.en}" in ${other.id} but "${s.gloss.en}" here`);
    }
    if (myTones !== null && theirTones !== null && myTones !== theirTones && sameGloss) {
      c.warn("glossary", `"${s.spelling}" means "${s.gloss.en}" here and in ${other.id} but with different tones`);
    }
  }
}

/** Lint one item. Cross-item rules use `ctx.corpus` and `ctx.glossary` when given. */
export function lintSubject(s: LintSubject, ctx: LintContext = EMPTY_CTX): LintResult {
  const waivers = new Map<string, string>();
  for (const w of s.waive ?? []) if (w.reason.trim()) waivers.set(w.rule, w.reason.trim());
  const c = new Collector(waivers);
  const p = prepare(ctx);

  checkSpellingLayer(c, "spelling", s.spelling);
  checkDots(c, "spelling", s.spelling, p.known, p.undotted, p.dotFold);
  checkHarmony(c, "spelling", s.spelling);
  checkAffixes(c, "spelling", s.spelling, s);
  checkToneLayer(c, "tone", s.spelling, s.status, s.toneText, s.tone, s.kind);

  for (const v of s.dialects) {
    const label = `variant (${v.dialect})`;
    checkSpellingLayer(c, label, v.spelling);
    checkHarmony(c, label, v.spelling);
    if (v.toneText !== undefined && v.toneText !== null) checkToneLayer(c, `${label} tone`, v.spelling, s.status, v.toneText, undefined, null);
    else if (v.tone) checkToneLayer(c, `${label} tone`, v.spelling, s.status, undefined, v.tone, null);
    if (v.dialect === "standard") c.warn("dialects", `${label}: the standard form is the item itself, not a variant`);
    else if (ctx.dialects && !ctx.dialects.has(v.dialect)) c.error("dialects", `${label}: "${v.dialect}" is not in the dialect registry`);
  }

  if (!s.gloss.en.trim()) c.error("gloss", "the English gloss is empty");
  checkNfc(c, "gloss", s.gloss.en);
  checkNfc(c, "gloss literal", s.gloss.literal);
  checkNfc(c, "gloss note", s.gloss.note);
  if (s.kind === "proverb" && !s.gloss.literal) c.warn("gloss", "proverbs carry a literal rendering as well as the meaning");

  const ids = new Set<string>();
  for (const a of s.audio) {
    if (ids.has(a.id)) c.error("audio", `audio id "${a.id}" appears twice`);
    ids.add(a.id);
    if (a.synthetic !== false) c.error("audio", `audio "${a.id}" is synthetic; course audio is always a human recording`);
    if (ctx.voices && !ctx.voices.has(a.voice)) c.error("audio", `audio "${a.id}": voice "${a.voice}" is not in the voice registry`);
  }

  checkReview(c, s);
  checkProvenance(c, s);
  checkGlossary(c, s, ctx, p);

  if (s.confusables.includes(s.id)) c.error("confusables", "an item cannot be confusable with itself");
  if (ctx.corpus) {
    for (const id of s.confusables) {
      const other = p.corpusById.get(id);
      if (!other) c.error("confusables", `confusable "${id}" does not exist`);
      else if (!other.confusables.includes(s.id)) c.warn("confusables", `"${id}" does not list this item back as confusable`);
    }
  }

  const errors = c.issues.filter((i) => i.severity === "error").length;
  return { passed: errors === 0, ruleVersion: LINT_RULE_VERSION, issues: c.issues };
}

/** A compiled Item as a lint subject (no authored tone text or reviewer notes). */
export function subjectFromItem(item: Item): LintSubject {
  return {
    id: item.id,
    kind: item.kind,
    pos: item.pos,
    status: item.status,
    provenance: item.provenance,
    spelling: item.spelling,
    tone: item.tone,
    gloss: item.gloss,
    dialects: item.dialects.map((d) => ({ dialect: d.dialect, spelling: d.spelling, tone: d.tone })),
    review: {
      authoredBy: item.review.authoredBy,
      reviews: item.review.reviews,
      adjudication: item.review.adjudication,
      approvedAt: item.review.approvedAt,
    },
    audio: item.audio,
    confusables: item.confusables,
  };
}

/** Lint a compiled Item (the contract entry point is `lintItem` in ./index). */
export function lintCompiledItem(item: Item, ctx: LintContext = {}): LintResult {
  return lintSubject(subjectFromItem(item), ctx);
}

/** Group issues by severity for reports. */
export function summarize(results: readonly { id: string; result: LintResult }[]): { errors: number; warnings: number; failed: string[] } {
  let errors = 0;
  let warnings = 0;
  const failed: string[] = [];
  for (const { id, result } of results) {
    errors += result.issues.filter((i) => i.severity === "error").length;
    warnings += result.issues.filter((i) => i.severity === "warning").length;
    if (!result.passed) failed.push(id);
  }
  return { errors, warnings, failed };
}

/** Shared NFC check for any other Igbo strings (glossary, dialogue speakers). */
export function nfcIssue(label: string, value: string): LintIssue | null {
  return value === nfc(value) ? null : { rule: "nfc", severity: "error", message: `${label} is not NFC: "${value}"` };
}

/** Lint glossary entries themselves. */
export function lintGlossary(entries: readonly GlossaryEntry[]): LintIssue[] {
  const out: LintIssue[] = [];
  const seen = new Map<string, string>();
  for (const g of entries) {
    const label = `glossary "${g.igbo}"`;
    for (const v of [g.igbo, g.tone ?? "", g.en]) {
      const issue = nfcIssue(label, v);
      if (issue) out.push(issue);
    }
    if (TONE_MARK_RE.test(g.igbo.normalize("NFD"))) out.push({ rule: "tone-in-spelling", severity: "error", message: `${label}: write tones in "tone", not in the headword` });
    for (const li of letterIssues(g.igbo)) out.push({ rule: "letters", severity: "error", message: `${label}: "${li.text}" is not an Ọnwụ letter` });
    if (g.tone && stripTones(withoutBreaks(g.tone)) !== g.igbo) out.push({ rule: "tone-layer", severity: "error", message: `${label}: tone "${g.tone}" does not spell the headword` });
    const key = `${lowerPlain(g.igbo)}|${g.tone ? tonePatternOf(undefined, g.tone) ?? "?" : "?"}`;
    const prior = seen.get(key);
    if (prior !== undefined && prior.toLowerCase() !== g.en.toLowerCase()) {
      out.push({ rule: "glossary", severity: "warning", message: `${label}: listed twice with different meanings ("${prior}", "${g.en}"); split by tone or merge` });
    }
    seen.set(key, g.en);
  }
  return out;
}
