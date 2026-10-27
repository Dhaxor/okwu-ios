// Test fixtures for the learning engine and content helpers (bun tests only;
// nothing in the app imports this). Strings are the research-doc examples
// already used by the pilot; statuses here are fixture values, not reviews.
import { bundleChecksumOf } from "@/lib/content/checksum";
import type { AudioRef, ContentBundle, DialectVariant, Item, ItemId, Lesson, Track, Tone, Unit } from "@/lib/content/types";
import type { LearnerSettings } from "./types";


const ref = (id: string, voice: string, ready: boolean): AudioRef => ({
  id: id as AudioRef["id"],
  voice: voice as AudioRef["voice"],
  speed: "natural",
  key: `audio/v1/${id}.m4a`,
  durationMs: ready ? 900 : 0,
  sha256: ready ? `sha-${id}` : "",
  qa: { status: ready ? "passed" : "pending" },
  synthetic: false,
});

export interface ItemOptions extends Partial<Omit<Item, "audio">> {
  tones?: [string, Tone][];
  audio?: "ready" | "pending" | "none";
  voices?: string[];
}

export function item(id: string, spelling: string, en: string, opts: ItemOptions = {}): Item {
  const tones = opts.tones;
  const audio = opts.audio ?? "ready";
  const voices = opts.voices ?? ["f1", "m1"];
  const base: Item = {
    id: id as ItemId,
    kind: opts.kind ?? "word",
    spelling,
    tone: tones ? { kind: "citation", syllables: tones.map(([text, tone]) => ({ text, tone })) } : { kind: "citation", syllables: [], pending: true },
    gloss: { en },
    tags: opts.tags ?? [],
    confusables: opts.confusables ?? [],
    dialects: opts.dialects ?? [],
    audio: audio === "none" ? [] : voices.map((v) => ref(`${id}-${v}`, v, audio === "ready")),
    provenance: opts.provenance ?? { kind: "commissioned", author: "lead" as never },
    review: {
      authoredBy: "lead" as never,
      lint: { passed: true, ruleVersion: "test", issues: [] },
      reviews: [
        { reviewer: "ra" as never, verdict: "approve", at: "2026-10-01T00:00:00.000Z" },
        { reviewer: "rb" as never, verdict: "approve", at: "2026-10-01T00:00:00.000Z" },
      ],
    },
    status: opts.status ?? "approved",
    version: 1,
  };
  if (opts.pos) base.pos = opts.pos;
  return base;
}

const AKWA = ["u00.akwa-bed", "u00.akwa-cloth", "u00.akwa-egg", "u00.akwa-cry"];
const others = (id: string) => AKWA.filter((x) => x !== id) as ItemId[];

export function fixtureItems(): Item[] {
  const imeela: DialectVariant = { dialect: "ibo-ngw" as DialectVariant["dialect"], spelling: "imeela", audio: [], acceptAsAnswer: true };
  const refused: DialectVariant = { dialect: "ibo-eza" as DialectVariant["dialect"], spelling: "ndo", audio: [], acceptAsAnswer: false };
  return [
    item("u00.akwa-bed", "akwa", "bed", { tones: [["a", "L"], ["kwa", "L"]], confusables: others("u00.akwa-bed"), tags: ["tone-set:akwa"] }),
    item("u00.akwa-cloth", "akwa", "cloth", { tones: [["a", "H"], ["kwa", "L"]], confusables: others("u00.akwa-cloth"), tags: ["tone-set:akwa"] }),
    item("u00.akwa-egg", "akwa", "egg", { tones: [["a", "L"], ["kwa", "H"]], confusables: others("u00.akwa-egg"), tags: ["tone-set:akwa"] }),
    item("u00.akwa-cry", "akwa", "cry", { tones: [["a", "H"], ["kwa", "H"]], confusables: others("u00.akwa-cry"), tags: ["tone-set:akwa"] }),
    item("u01.ndeewo", "Ndeewo", "Hello", { tones: [["N", "L"], ["de", "H"], ["e", "L"], ["wo", "H"]], tags: ["greeting"] }),
    item("u01.kedu-ka-i-mere", "Kedụ ka i mere?", "How are you?", {
      kind: "phrase",
      tones: [["Ke", "L"], ["dụ", "H"], ["ka", "L"], ["i", "H"], ["me", "L"], ["re", "L"]],
      tags: ["greeting"],
    }),
    item("u01.o-di-mma", "Ọ dị mma", "I'm fine", { kind: "phrase", tags: ["greeting"], audio: "pending" }),
    item("u01.daalu", "Daalụ", "Thank you", { tones: [["Da", "L"], ["a", "H"], ["lụ", "H"]], tags: ["thanks"], dialects: [imeela, refused] }),
    item("u01.nnoo", "Nnọọ", "Welcome", { tones: [["N", "L"], ["nọ", "L"], ["ọ", "L"]], tags: ["greeting"] }),
    item("u01.draft", "Ka ọ dị", "Goodbye", { kind: "phrase", status: "draft", provenance: { kind: "draft-ai", note: "test" }, tags: ["greeting"] }),
  ];
}

export function fixtureBundle(opts: { dev?: boolean; items?: Item[] } = {}): ContentBundle {
  const items = opts.items ?? fixtureItems();
  const lesson = (id: string, unit: string, index: number, introduces: string[], exercises: Lesson["exercises"] = []): Lesson => ({
    id: id as Lesson["id"],
    unit: unit as Lesson["unit"],
    index,
    title: id,
    objectives: [],
    introduces: introduces as ItemId[],
    exercises,
    cefr: "A1",
    estMinutes: 5,
    status: "approved",
    version: 1,
  });
  const lessons: Lesson[] = [
    lesson("u00.l01", "u00", 1, AKWA),
    lesson("u01.l01", "u01", 1, ["u01.ndeewo", "u01.kedu-ka-i-mere", "u01.o-di-mma"], [
      {
        type: "dialogue",
        items: ["u01.ndeewo", "u01.o-di-mma"] as ItemId[],
        learnerSpeaker: "B",
        lines: [
          { speaker: "A", item: "u01.ndeewo" as ItemId },
          { speaker: "B", item: "u01.ndeewo" as ItemId },
          { speaker: "A", item: "u01.kedu-ka-i-mere" as ItemId },
          { speaker: "B", item: "u01.o-di-mma" as ItemId },
        ],
      },
    ]),
    lesson("u01.l02", "u01", 2, ["u01.daalu", "u01.nnoo"]),
    lesson("u01.placement", "u01", 99, [], [
      { type: "listen-choose", items: ["u01.ndeewo"] as ItemId[], prompt: "u01.ndeewo" as ItemId, answer: "gloss", options: ["u01.ndeewo", "u01.daalu", "u01.nnoo"] as ItemId[] },
      { type: "listen-choose", items: ["u01.daalu"] as ItemId[], prompt: "u01.daalu" as ItemId, answer: "gloss", options: ["u01.daalu", "u01.nnoo", "u01.ndeewo"] as ItemId[] },
      { type: "listen-choose", items: ["u01.nnoo"] as ItemId[], prompt: "u01.nnoo" as ItemId, answer: "gloss", options: ["u01.nnoo", "u01.ndeewo", "u01.daalu"] as ItemId[] },
      { type: "listen-choose", items: ["u01.kedu-ka-i-mere"] as ItemId[], prompt: "u01.kedu-ka-i-mere" as ItemId, answer: "gloss", options: ["u01.kedu-ka-i-mere", "u01.nnoo", "u01.daalu"] as ItemId[] },
    ]),
  ];
  const unit = (id: string, index: number, ls: string[]): Unit => ({
    id: id as Unit["id"],
    track: "new-learner" as Unit["track"],
    index,
    title: id,
    theme: id,
    lessons: ls as Lesson["id"][],
    cefr: "A1",
    free: true,
  });
  const units: Unit[] = [unit("u00", 0, ["u00.l01"]), unit("u01", 1, ["u01.l01", "u01.l02"]), unit("u02", 2, [])];
  const tracks: Track[] = [
    { id: "new-learner" as Track["id"], kind: "new-learner", title: "New", units: ["u00", "u01", "u02"] as Unit["id"][] },
    {
      id: "heritage" as Track["id"],
      kind: "heritage",
      title: "Heritage",
      units: ["u00", "u01", "u02"] as Unit["id"][],
      placement: { lesson: "u01.placement" as Lesson["id"], skipsTo: { "0": "u00" as Unit["id"], "3": "u01" as Unit["id"], "4": "u02" as Unit["id"] } },
    },
  ];
  const body = {
    version: opts.dev ? "0.0.1+drafts" : "0.0.1",
    builtAt: "2026-10-23T00:00:00.000Z",
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    lessons: Object.fromEntries(lessons.map((l) => [l.id, l])),
    units: Object.fromEntries(units.map((u) => [u.id, u])),
    tracks: Object.fromEntries(tracks.map((t) => [t.id, t])),
    voices: {},
    credits: [],
  };
  return { ...body, checksum: bundleChecksumOf(body) };
}

export const SETTINGS: LearnerSettings = { track: "new-learner", dialects: ["standard"], showTones: true, dailyGoalMinutes: 10 };

export const T0 = new Date("2026-10-23T09:00:00.000Z");
export const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
export const days = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
