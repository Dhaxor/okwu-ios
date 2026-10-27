// Fixtures for the state-layer tests (bun only; the app never imports this).
// The Igbo here is copied from docs/RESEARCH.md §3 (the àkwà minimal set,
// Daalụ, Kedụ ka i mere); statuses are fixture values, not reviews.
import type { AudioRef, ContentBundle, DialectVariant, Item, ItemId, Lesson, Tone, Track, Unit } from "@/lib/content/types";

const ref = (id: string, voice: string, ready: boolean, speed: "natural" | "slow" = "natural"): AudioRef => ({
  id: id as AudioRef["id"],
  voice: voice as AudioRef["voice"],
  speed,
  key: `audio/v1/${id}.m4a`,
  durationMs: ready ? 900 : 0,
  sha256: ready ? `sha-${id}` : "",
  qa: { status: ready ? "passed" : "pending" },
  synthetic: false,
});

interface Opts {
  kind?: Item["kind"];
  tones?: [string, Tone][];
  audio?: "ready" | "pending" | "none";
  dialects?: DialectVariant[];
  status?: Item["status"];
  confusables?: string[];
  tags?: string[];
}

export function fxItem(id: string, spelling: string, en: string, o: Opts = {}): Item {
  const audio = o.audio ?? "ready";
  return {
    id: id as ItemId,
    kind: o.kind ?? "word",
    spelling,
    tone: o.tones ? { kind: "citation", syllables: o.tones.map(([text, tone]) => ({ text, tone })) } : { kind: "citation", syllables: [], pending: true },
    gloss: { en },
    tags: o.tags ?? [],
    confusables: (o.confusables ?? []) as ItemId[],
    dialects: o.dialects ?? [],
    audio: audio === "none" ? [] : [ref(`${id}-f1`, "f1", audio === "ready"), ref(`${id}-m1`, "m1", audio === "ready"), ref(`${id}-f1s`, "f1", audio === "ready", "slow")],
    provenance: { kind: "commissioned", author: "lead" as never },
    review: { authoredBy: "lead" as never, lint: { passed: true, ruleVersion: "t", issues: [] }, reviews: [] },
    status: o.status ?? "approved",
    version: 1,
  };
}

const AKWA = ["u00.akwa-bed", "u00.akwa-cloth", "u00.akwa-egg", "u00.akwa-cry"];
const partners = (id: string) => AKWA.filter((x) => x !== id);

export function fxItems(): Item[] {
  const ngwa: DialectVariant = { dialect: "ibo-ngw" as DialectVariant["dialect"], spelling: "imeela", audio: [], acceptAsAnswer: true, note: "Igbo API: Ngwa" };
  return [
    fxItem("u00.akwa-bed", "akwa", "bed", { tones: [["a", "L"], ["kwa", "L"]], confusables: partners("u00.akwa-bed") }),
    fxItem("u00.akwa-cloth", "akwa", "cloth", { tones: [["a", "H"], ["kwa", "L"]], confusables: partners("u00.akwa-cloth") }),
    fxItem("u00.akwa-egg", "akwa", "egg", { tones: [["a", "L"], ["kwa", "H"]], confusables: partners("u00.akwa-egg") }),
    fxItem("u00.akwa-cry", "akwa", "cry", { tones: [["a", "H"], ["kwa", "H"]], confusables: partners("u00.akwa-cry") }),
    fxItem("u01.daalu", "Daalụ", "Thank you", { tones: [["Da", "L"], ["a", "H"], ["lụ", "H"]], dialects: [ngwa] }),
    fxItem("u01.kedu", "Kedụ ka i mere?", "How are you?", { kind: "phrase", tones: [["Ke", "L"], ["dụ", "H"], ["ka", "L"], ["i", "H"], ["me", "L"], ["re", "L"]] }),
    fxItem("u01.pending", "Ka ọ dị", "Goodbye", { kind: "phrase", audio: "pending" }),
    fxItem("u01.name", "Ngozi", "Blessing", { kind: "name", audio: "none" }),
  ];
}

export function fxBundle(opts: { dev?: boolean; items?: Item[] } = {}): ContentBundle {
  const items = opts.items ?? fxItems();
  const lesson = (id: string, unit: string, index: number, introduces: string[], status: Lesson["status"] = "approved"): Lesson => ({
    id: id as Lesson["id"],
    unit: unit as Lesson["unit"],
    index,
    title: `Lesson ${id}`,
    objectives: [],
    introduces: introduces as ItemId[],
    exercises: [],
    cefr: "A1",
    estMinutes: 5,
    status,
    version: 1,
  });
  const lessons = [lesson("u00.l01", "u00", 1, AKWA), lesson("u01.l01", "u01", 1, ["u01.daalu", "u01.kedu"]), lesson("u01.l02", "u01", 2, ["u01.pending", "u01.name"])];
  const unit = (id: string, index: number, ls: string[], place?: string): Unit => ({
    id: id as Unit["id"],
    track: "new-learner" as Unit["track"],
    index,
    title: `Unit ${id}`,
    theme: id,
    lessons: ls as Lesson["id"][],
    cefr: "A1",
    free: true,
    ...(place ? { obodoPlace: place } : {}),
  });
  const units = [unit("u00", 0, ["u00.l01"], "home"), unit("u01", 1, ["u01.l01", "u01.l02"], "market"), unit("u02", 2, [])];
  const tracks: Track[] = [
    { id: "new-learner" as Track["id"], kind: "new-learner", title: "New", units: ["u00", "u01", "u02"] as Unit["id"][] },
    { id: "heritage" as Track["id"], kind: "heritage", title: "Heritage", units: ["u00", "u01", "u02"] as Unit["id"][] },
  ];
  return {
    version: opts.dev ? "0.0.1+drafts" : "0.0.1",
    builtAt: "2026-10-23T00:00:00.000Z",
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    lessons: Object.fromEntries(lessons.map((l) => [l.id, l])),
    units: Object.fromEntries(units.map((u) => [u.id, u])),
    tracks: Object.fromEntries(tracks.map((t) => [t.id, t])),
    voices: {},
    credits: [],
    checksum: "test",
  };
}

export const T0 = new Date("2026-10-23T09:00:00.000Z");
