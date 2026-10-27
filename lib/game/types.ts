// Game-layer contract (owner B). docs/CONTRACTS.md §3.
//
// Warm and culturally grounded, never punishing: no hearts, no energy, no
// paid boosts, nothing dies. Every motif name is to be confirmed by our
// cultural advisors before it ships. Masquerades, deities, shrines, sacred
// nsibidi, title regalia and political symbols are never game objects.
//
// Every string in this layer is English. Igbo display names (market days,
// crops, places, motif names) come from approved content and are passed to
// the UI as props; the engine only ever uses the English ids below.
import type { IsoTime, ItemId, StoryId, UnitId } from "@/lib/content/types";
import type { LearningEvent } from "@/lib/learning/types";

/** The four market days of the izu, in order. Display names come from approved content. */
export type MarketDay = "eke" | "orie" | "afo" | "nkwo";

/** Local calendar date, YYYY-MM-DD (the learner's own clock, never UTC). */
export type LocalDate = string;

/**
 * The izu chain: practise on at least 3 of the 4 market days of each izu
 * to keep it (the fourth is a built-in rest day). A broken chain can be
 * repaired with 3 lessons within 48 hours, and revived once a year at
 * Homecoming.
 */
export interface IzuChain {
  /** Consecutive izu kept. Grows the moment the third day is practised. */
  length: number;
  longest: number;
  current: { start: LocalDate; practised: MarketDay[] };
  /** Open repair window after a miss. The chain is held (not reset) while it is open. */
  repair: null | { deadline: IsoTime; lessonsDone: number };
  /** Year the Homecoming revival was last used. */
  revivalYear: number | null;
  /** The last chain that rested (the repair window passed), for the yearly Homecoming revival. */
  rested: null | { length: number; on: LocalDate };
}

/** Crops of an Igbo farm (English ids; display names from approved content). */
export type PlantKind = "yam" | "cocoyam" | "maize" | "okra" | "pepper" | "pumpkin-leaf" | "bitterleaf" | "oil-palm";

/** The mixed crops Ubi rotates through: ji (yam), ede (cocoyam), ugu (pumpkin leaf), ọka (maize). */
export type UbiCrop = "yam" | "cocoyam" | "pumpkin-leaf" | "maize";

/** 0 seed … 4 harvest. A plant never wilts or dies; it rests while you are away. */
export type GrowthStage = 0 | 1 | 2 | 3 | 4;

export interface Plant {
  id: string;
  kind: PlantKind;
  stage: GrowthStage;
  /** Growth points toward the next stage. */
  points: number;
  plantedAt: IsoTime;
  /** The unit whose words planted it ("" when unknown). */
  from: UnitId;
  /** The garden plot it grows in (0 … UBI.plots-1), so the art stays put. */
  plot: number;
}

/** Ubi: a garden that grows with practice and never dies. */
export interface UbiGarden {
  plants: Plant[];
  lastTendedAt: IsoTime | null;
  /** Harvested crops, per kind. Only ever grows. */
  barn: Partial<Record<PlantKind, number>>;
  /** Seeds sown so far: stable plant ids and the crop rotation. */
  sown: number;
}

export type CollectionKind = "ilu" | "aha" | "akuko";

export interface CollectionEntry {
  kind: CollectionKind;
  /** Ilu (proverbs) and Aha (names) are items; Akụkọ are story chapters. */
  ref: { item: ItemId } | { story: StoryId; chapter: number };
  unlockedAt: IsoTime;
}

/** Obodo: the hometown, restored place by place as units are learned. */
export type ObodoPlace = "home" | "market" | "farm" | "stream" | "village-square" | "wedding" | "homecoming";

export type ObodoStage = 0 | 1 | 2 | 3;

export interface ObodoState {
  /** 0 untouched … 3 fully restored. Stages only ever rise. */
  places: Record<ObodoPlace, ObodoStage>;
}

export type XpSource = "new-item" | "speaking" | "lesson" | "review" | "story" | "mission";

export interface XpLedger {
  total: number;
  /** XP per local date. */
  byDay: Record<LocalDate, number>;
  /**
   * Capped grants already made today, keyed by what was practised:
   * `r:<item>` review, `s:<item>` speaking, `n:<item>` new item,
   * `l:<lesson>` repeated lesson, `c:<story>:<chapter>` re-read chapter.
   */
  reviewToday: { date: LocalDate; perItem: Record<string, number> };
}

/** A real-world mission ("Greet your mum in Igbo today"); self-reported, never verified. */
export interface Mission {
  id: string;
  /** English instruction plus an approved item to use. */
  prompt: string;
  item?: ItemId;
  doneAt?: IsoTime;
}

/** What a cohort quest counts. */
export type QuestMetric = "lessons" | "speaking" | "new-words" | "stories" | "practice-days";

/**
 * An Ọgbọ co-op weekly quest: the whole cohort works toward one shared
 * target. No ranking of members, ever. The server (owner C) is the source
 * of truth for the cohort total; the device counts this learner's part and
 * adds what has not been synced yet.
 */
export interface CohortQuest {
  /** ISO week of the learner's local dates, e.g. "2026-W43". */
  week: string;
  questId: string;
  metric: QuestMetric;
  /** The cohort's shared target for the week. */
  target: number;
  members: number;
  /** This learner's contribution this week (local count). */
  mine: number;
  /** The part of `mine` the server had counted at the last sync. */
  mineSynced: number;
  /** Cohort total at the last sync (includes `mineSynced`). */
  syncedTotal: number;
  syncedAt: IsoTime | null;
  /** Milestones already celebrated: 25, 50, 75, 100 (percent). */
  milestones: number[];
  completedAt: IsoTime | null;
}

/** What the server sends for the cohort's current quest (owner C). */
export interface CohortSnapshot {
  week: string;
  questId: string;
  metric: QuestMetric;
  target: number;
  members: number;
  /** Cohort total, including this learner's counted part. */
  total: number;
  /** This learner's part the server has counted. */
  mine: number;
}

/** Running counts that achievements read. Only ever grow. */
export interface GameCounts {
  newItems: number;
  spoken: number;
  lessons: number;
  reviews: number;
  chapters: number;
  harvests: number;
  repairs: number;
  returns: number;
  questsDone: number;
  missions: number;
}

export interface GameState {
  version: 1;
  /** The learner's first local day (the izu aligns to it until a verified market-day anchor exists). */
  startedOn: LocalDate;
  /** The last local day that counted as practice. */
  lastPractice: LocalDate | null;
  /** Today's practice so far (resets each local day). */
  day: { date: LocalDate; lessons: number; touches: number; counted: boolean };
  xp: XpLedger;
  izu: IzuChain;
  ubi: UbiGarden;
  collections: CollectionEntry[];
  obodo: ObodoState;
  /** Distinct lessons completed (restores Obodo, separates first runs from repeats). */
  lessonsDone: string[];
  missions: Mission[];
  /** The current Ọgbọ quest, or null when the learner is not in a cohort. */
  cohort: CohortQuest | null;
  /** Unlocked achievements and when. Never revoked. */
  achievements: Record<string, IsoTime>;
  counts: GameCounts;
}

/** Seasonal windows (dates confirmed by cultural advisors; communities choose their own days). */
export type Festival = "iri-ji" | "homecoming";

/** What the UI should celebrate after an event (one peak per flow, calm otherwise). */
export type GameEffect =
  | { kind: "xp"; amount: number; source: XpSource }
  | { kind: "izu-day"; day: MarketDay }
  | { kind: "izu-kept"; length: number }
  | { kind: "izu-repair-open"; deadline: IsoTime }
  | { kind: "izu-repair-progress"; lessonsDone: number; needed: number }
  | { kind: "izu-repaired"; length: number }
  /** The repair window passed. Informational and calm: never shown as a loss. */
  | { kind: "izu-rested"; length: number }
  | { kind: "izu-revived"; length: number }
  | { kind: "plant-sown"; plant: string; crop: PlantKind }
  | { kind: "plant-grew"; plant: string; stage: GrowthStage }
  | { kind: "harvest"; crops: Partial<Record<PlantKind, number>>; festival: Festival | null }
  | { kind: "collection"; entry: CollectionEntry }
  | { kind: "obodo"; place: ObodoPlace; stage: 1 | 2 | 3 }
  | { kind: "quest-progress"; percent: 25 | 50 | 75 }
  | { kind: "quest-complete"; questId: string }
  | { kind: "achievement"; id: string }
  /** The learner came back after a week or more away. Always a welcome. */
  | { kind: "welcome-back"; days: number };

export interface GameResult {
  state: GameState;
  effects: GameEffect[];
}

// ---------------------------------------------------------------------------
// Derived views for the UI (pure functions of state and time)
// ---------------------------------------------------------------------------

export type IzuCellState = "practised" | "today" | "rest" | "open" | "missed";

export interface IzuCell {
  day: MarketDay;
  date: LocalDate;
  state: IzuCellState;
  /** This cell is today (it may also be practised). */
  isToday: boolean;
}

export interface IzuView {
  cells: IzuCell[];
  length: number;
  longest: number;
  practised: number;
  /** Days needed this izu (3, fewer in a learner's first, partial izu). */
  needed: number;
  /** This izu is already kept; the rest are rest days. */
  kept: boolean;
  repair: null | { deadline: IsoTime; lessonsDone: number; needed: number; hoursLeft: number };
  /** The yearly Homecoming revival is available, and what it would bring back. */
  revival: null | { length: number };
  /** No verified market-day anchor yet: day names follow the learner's own 4-day cycle. */
  provisional: boolean;
}

export interface PlantView {
  id: string;
  kind: PlantKind;
  stage: GrowthStage;
  plot: number;
  /** Progress to the next stage, 0..1 (1 when ripe). */
  progress: number;
  ripe: boolean;
}

export interface GardenView {
  plots: (PlantView | null)[];
  growing: number;
  ripe: number;
  barn: Partial<Record<PlantKind, number>>;
  /** Away for a while: the garden is waiting, never wilting. */
  resting: boolean;
  festival: Festival | null;
}

export interface ObodoPlaceView {
  place: ObodoPlace;
  stage: ObodoStage;
  /** Lessons done toward full restoration, 0..1. */
  progress: number;
}

export interface ObodoView {
  places: ObodoPlaceView[];
  /** Places fully restored. */
  restored: number;
  /** The place being restored now (null when all are whole). */
  next: ObodoPlace | null;
}

export interface CollectionSlot {
  kind: CollectionKind;
  /** Item id (ilu, aha) or `story:chapter` (akuko). */
  id: string;
  unlockedAt: IsoTime | null;
}

export interface CollectionsView {
  ilu: CollectionSlot[];
  aha: CollectionSlot[];
  akuko: CollectionSlot[];
}

export interface QuestView {
  questId: string;
  metric: QuestMetric;
  title: string;
  detail: string;
  target: number;
  total: number;
  mine: number;
  members: number;
  /** 0..1 */
  progress: number;
  daysLeft: number;
  complete: boolean;
}

export interface AchievementView {
  id: string;
  title: string;
  detail: string;
  unlockedAt: IsoTime | null;
}

export interface GameView {
  today: LocalDate;
  marketDay: MarketDay;
  xp: { total: number; today: number };
  izu: IzuView;
  garden: GardenView;
  obodo: ObodoView;
  collections: CollectionsView;
  quest: QuestView | null;
  achievements: AchievementView[];
  festival: Festival | null;
}

// ---------------------------------------------------------------------------
// Notifications: copy and timing as data; screens (D) and the server (C) schedule them
// ---------------------------------------------------------------------------

export type NotificationKind = "repair" | "izu-one-more" | "harvest" | "quest" | "festival" | "welcome-back" | "word";

export interface NotificationPrefs {
  enabled: boolean;
  /** Preferred local time. */
  time: { hour: number; minute: number };
  /** Teens get no chain nudges (UK Children's Code: no reward-loop pressure). */
  audience: "adult" | "teen";
  /** Days to plan ahead (default 3, max 7). Re-plan on every app open and after practice. */
  days?: number;
}

export interface PlannedNotification {
  /** Stable per local day, so re-planning replaces rather than duplicates. */
  id: string;
  date: LocalDate;
  /** The instant to fire (the preferred local time on `date`). */
  at: IsoTime;
  kind: NotificationKind;
  title: string;
  body: string;
  /** The push kind it counts as (one a day across local and push, docs/CONTRACTS.md §4). */
  push: "daily-reminder";
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/** Which place each lesson restores. Built by screens from the content bundle (units carry `obodoPlace`). */
export interface CourseMap {
  lessons: Record<string, { unit: string }>;
  units: Record<string, { place: ObodoPlace | null; lessons: number }>;
}

/** Which approved items are proverbs and names, and which stories have chapters. */
export interface CollectionCatalog {
  ilu: readonly string[];
  aha: readonly string[];
  akuko: readonly { story: string; chapters: number }[];
}

/** Local day keys. The default reads the device clock; tests inject a time zone. */
export interface GameCalendar {
  /** The local calendar date of an instant. */
  dayKey(at: Date): LocalDate;
  /** The instant a local wall-clock time occurs on a local date (the next valid instant in a DST gap). */
  at(day: LocalDate, hour: number, minute: number): Date;
}

export interface GameEngineOptions {
  /** A verified market-day anchor (default: rules.MARKET_DAY_ANCHOR). */
  anchor?: { date: LocalDate; day: MarketDay } | null;
  calendar?: GameCalendar;
  course?: CourseMap | null;
  catalog?: CollectionCatalog;
}

export interface GameEngine {
  /** Pure: the same state, event and time always give the same result. */
  apply(state: GameState, event: LearningEvent, now: Date): GameResult;
  /** Roll the izu, repair window and cohort week forward to `now`. */
  tick(state: GameState, now: Date): GameResult;
  /** The market day of a date (on the learner's own 4-day cycle when there is no verified anchor and a state is given). */
  marketDay(date: Date, state?: GameState): MarketDay;
  /** The local day key the engine uses for `date`. */
  dayKey(date: Date): LocalDate;
  /** Gather every ripe plant into the barn (double in the Iri Ji window). */
  harvest(state: GameState, now: Date): GameResult;
  /** Use the yearly Homecoming revival to bring a rested chain back. No-op when unavailable. */
  revive(state: GameState, now: Date): GameResult;
  /** Mark a real-world mission done (self-reported). */
  completeMission(state: GameState, missionId: string, now: Date): GameResult;
  /** Merge the server's cohort totals (joins the quest if the learner had none). */
  syncCohort(state: GameState, snapshot: CohortSnapshot, now: Date): GameResult;
  /** Everything the UI draws, derived from state and time. */
  view(state: GameState, now: Date): GameView;
  /** At most one positive notification per local day, as data. */
  notifications(state: GameState, now: Date, prefs: NotificationPrefs): PlannedNotification[];
}
