// A fresh game, and a defensive reader for stored ones (okwu.game.v1).
// Every field is checked; anything missing or malformed falls back to a
// safe default, so an old or damaged save never crashes the app and never
// takes anything away that is still readable.
import { isDayKey } from "./calendar";
import { OBODO_PLACES, MARKET_DAYS } from "./rules";
import type {
  CohortQuest,
  CollectionEntry,
  GameCounts,
  GameState,
  GrowthStage,
  LocalDate,
  MarketDay,
  Mission,
  ObodoPlace,
  ObodoStage,
  Plant,
  PlantKind,
  QuestMetric,
} from "./types";
import type { ItemId, StoryId, UnitId } from "@/lib/content/types";

export const GAME_KEY = "okwu.game.v1";

const ZERO_COUNTS: GameCounts = { newItems: 0, spoken: 0, lessons: 0, reviews: 0, chapters: 0, harvests: 0, repairs: 0, returns: 0, questsDone: 0, missions: 0 };

export function emptyGameState(today: LocalDate): GameState {
  return {
    version: 1,
    startedOn: today,
    lastPractice: null,
    day: { date: today, lessons: 0, touches: 0, counted: false },
    xp: { total: 0, byDay: {}, reviewToday: { date: today, perItem: {} } },
    izu: { length: 0, longest: 0, current: { start: today, practised: [] }, repair: null, revivalYear: null, rested: null },
    ubi: { plants: [], lastTendedAt: null, barn: {}, sown: 0 },
    collections: [],
    obodo: { places: { home: 0, market: 0, farm: 0, stream: 0, "village-square": 0, wedding: 0, homecoming: 0 } },
    lessonsDone: [],
    missions: [],
    cohort: null,
    achievements: {},
    counts: { ...ZERO_COUNTS },
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
const int = (v: unknown, d = 0) => Math.floor(num(v, d));
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const iso = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
const day = (v: unknown, d: LocalDate): LocalDate => (isDayKey(v) ? v : d);

const PLANT_KINDS: readonly PlantKind[] = ["yam", "cocoyam", "maize", "okra", "pepper", "pumpkin-leaf", "bitterleaf", "oil-palm"];
const METRICS: readonly QuestMetric[] = ["lessons", "speaking", "new-words", "stories", "practice-days"];

function parsePlant(v: unknown, i: number): Plant | null {
  if (!isObj(v)) return null;
  const kind = str(v.kind) as PlantKind | null;
  if (!kind || !PLANT_KINDS.includes(kind)) return null;
  const stage = Math.min(4, int(v.stage)) as GrowthStage;
  return {
    id: str(v.id) ?? `${kind}-r${i}`,
    kind,
    stage,
    points: stage >= 4 ? 0 : num(v.points),
    plantedAt: iso(v.plantedAt) ?? new Date(0).toISOString(),
    from: (str(v.from) ?? "") as UnitId,
    plot: int(v.plot, i),
  };
}

function parseEntry(v: unknown): CollectionEntry | null {
  if (!isObj(v) || !isObj(v.ref)) return null;
  const kind = v.kind;
  const at = iso(v.unlockedAt);
  if (!at) return null;
  if ((kind === "ilu" || kind === "aha") && str(v.ref.item)) return { kind, ref: { item: v.ref.item as ItemId }, unlockedAt: at };
  if (kind === "akuko" && str(v.ref.story) && int(v.ref.chapter, -1) >= 0) {
    return { kind, ref: { story: v.ref.story as StoryId, chapter: int(v.ref.chapter) }, unlockedAt: at };
  }
  return null;
}

function parseCohort(v: unknown): CohortQuest | null {
  if (!isObj(v)) return null;
  const week = str(v.week);
  const questId = str(v.questId);
  const metric = str(v.metric) as QuestMetric | null;
  if (!week || !questId || !metric || !METRICS.includes(metric)) return null;
  const mine = int(v.mine);
  return {
    week,
    questId,
    metric,
    target: Math.max(1, int(v.target, 1)),
    members: Math.max(1, int(v.members, 1)),
    mine,
    mineSynced: Math.min(mine, int(v.mineSynced)),
    syncedTotal: int(v.syncedTotal),
    syncedAt: iso(v.syncedAt),
    milestones: Array.isArray(v.milestones) ? v.milestones.filter((m): m is number => typeof m === "number") : [],
    completedAt: iso(v.completedAt),
  };
}

/** Read a stored game. Returns a fresh game for anything unreadable. */
export function parseGameState(raw: unknown, today: LocalDate): GameState {
  const base = emptyGameState(today);
  const v = typeof raw === "string" ? safeJson(raw) : raw;
  if (!isObj(v) || v.version !== 1) return base;
  const startedOn = day(v.startedOn, isObj(v.izu) && isObj(v.izu.current) ? day(v.izu.current.start, today) : today);

  const xpIn = isObj(v.xp) ? v.xp : {};
  const byDay: Record<string, number> = {};
  if (isObj(xpIn.byDay)) for (const [k, n] of Object.entries(xpIn.byDay)) if (isDayKey(k)) byDay[k] = num(n);
  const rt = isObj(xpIn.reviewToday) ? xpIn.reviewToday : {};
  const perItem: Record<string, number> = {};
  if (isObj(rt.perItem)) for (const [k, n] of Object.entries(rt.perItem)) perItem[k] = int(n);

  const izuIn = isObj(v.izu) ? v.izu : {};
  const cur = isObj(izuIn.current) ? izuIn.current : {};
  const practised = Array.isArray(cur.practised) ? MARKET_DAYS.filter((d) => (cur.practised as unknown[]).includes(d)) : [];
  const repairIn = isObj(izuIn.repair) ? izuIn.repair : null;
  const deadline = repairIn ? iso(repairIn.deadline) : null;
  const restedIn = isObj(izuIn.rested) ? izuIn.rested : null;
  const length = int(izuIn.length);

  const ubiIn = isObj(v.ubi) ? v.ubi : {};
  const plants = (Array.isArray(ubiIn.plants) ? ubiIn.plants : []).map(parsePlant).filter((p): p is Plant => p !== null);
  const barn: Partial<Record<PlantKind, number>> = {};
  if (isObj(ubiIn.barn)) for (const k of PLANT_KINDS) if (num(ubiIn.barn[k]) > 0) barn[k] = int(ubiIn.barn[k]);

  const placesIn = isObj(v.obodo) && isObj(v.obodo.places) ? v.obodo.places : {};
  const places = { ...base.obodo.places };
  for (const p of OBODO_PLACES) places[p as ObodoPlace] = Math.min(3, int(placesIn[p])) as ObodoStage;

  const countsIn = isObj(v.counts) ? v.counts : {};
  const counts = { ...ZERO_COUNTS };
  for (const k of Object.keys(ZERO_COUNTS) as (keyof GameCounts)[]) counts[k] = int(countsIn[k]);

  const achievements: Record<string, string> = {};
  if (isObj(v.achievements)) for (const [k, at] of Object.entries(v.achievements)) if (iso(at)) achievements[k] = at as string;

  const dayIn = isObj(v.day) ? v.day : {};
  const missions: Mission[] = (Array.isArray(v.missions) ? v.missions : [])
    .filter(isObj)
    .filter((m) => str(m.id) && str(m.prompt))
    .map((m) => ({ id: m.id as string, prompt: m.prompt as string, ...(str(m.item) ? { item: m.item as ItemId } : {}), ...(iso(m.doneAt) ? { doneAt: m.doneAt as string } : {}) }));

  return {
    version: 1,
    startedOn,
    lastPractice: isDayKey(v.lastPractice) ? v.lastPractice : null,
    day: { date: day(dayIn.date, today), lessons: int(dayIn.lessons), touches: int(dayIn.touches), counted: dayIn.counted === true },
    xp: { total: int(xpIn.total), byDay, reviewToday: { date: day(rt.date, today), perItem } },
    izu: {
      length,
      longest: Math.max(length, int(izuIn.longest)),
      current: { start: day(cur.start, startedOn), practised: practised as MarketDay[] },
      repair: deadline ? { deadline, lessonsDone: int(repairIn?.lessonsDone) } : null,
      revivalYear: typeof izuIn.revivalYear === "number" ? int(izuIn.revivalYear) : null,
      rested: restedIn && int(restedIn.length) > 0 ? { length: int(restedIn.length), on: day(restedIn.on, today) } : null,
    },
    ubi: { plants, lastTendedAt: iso(ubiIn.lastTendedAt), barn, sown: Math.max(int(ubiIn.sown), plants.length) },
    collections: (Array.isArray(v.collections) ? v.collections : []).map(parseEntry).filter((e): e is CollectionEntry => e !== null),
    obodo: { places },
    lessonsDone: Array.isArray(v.lessonsDone) ? [...new Set(v.lessonsDone.filter((l): l is string => typeof l === "string"))] : [],
    missions,
    cohort: parseCohort(v.cohort),
    achievements,
    counts,
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
