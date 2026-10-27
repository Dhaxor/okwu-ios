// Achievements: gentle markers of things the learner did. Never guilt,
// never loss, never time pressure: each one only ever unlocks, is never
// taken away, and says what you did rather than what you failed to do.
// Copy is English; Igbo names in the UI come from approved content.
import { UBI } from "./rules";
import type { AchievementView, GameEffect, GameState } from "./types";

export interface AchievementDef {
  id: string;
  title: string;
  detail: string;
  /** Unlocked when this is true of the state. */
  test: (s: GameState) => boolean;
}

const restored = (s: GameState) => Object.values(s.obodo.places).filter((v) => v >= 3).length;
const collected = (s: GameState, kind: "ilu" | "aha" | "akuko") => s.collections.filter((c) => c.kind === kind).length;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first-word", title: "First word", detail: "You learned your first word.", test: (s) => s.counts.newItems >= 1 },
  { id: "first-voice", title: "First voice", detail: "You said a word aloud.", test: (s) => s.counts.spoken >= 1 },
  { id: "first-lesson", title: "First lesson", detail: "You finished your first lesson.", test: (s) => s.counts.lessons >= 1 },
  { id: "ten-words", title: "Ten words", detail: "Ten words are yours now.", test: (s) => s.counts.newItems >= 10 },
  { id: "hundred-words", title: "A hundred words", detail: "A hundred words, learned one by one.", test: (s) => s.counts.newItems >= 100 },
  { id: "first-izu", title: "A full market week", detail: "You practised on three of the four market days.", test: (s) => s.izu.longest >= 1 },
  { id: "izu-season", title: "A season of market days", detail: "Seven market weeks kept, one after another.", test: (s) => s.izu.longest >= 7 },
  { id: "mended", title: "Mended", detail: "Three lessons mended your chain.", test: (s) => s.counts.repairs >= 1 },
  { id: "welcome-home", title: "Welcome home", detail: "You came back to practise.", test: (s) => s.counts.returns >= 1 },
  { id: "first-harvest", title: "First harvest", detail: "Your first crops came in.", test: (s) => s.counts.harvests >= 1 },
  {
    id: "mixed-farm",
    title: "A mixed farm",
    detail: "You harvested all four crops.",
    test: (s) => UBI.crops.every((c) => (s.ubi.barn[c] ?? 0) > 0),
  },
  { id: "home-restored", title: "Home again", detail: "Your home is fully restored.", test: (s) => s.obodo.places.home >= 3 },
  { id: "obodo-whole", title: "The whole hometown", detail: "Every place in your hometown is alive again.", test: (s) => restored(s) >= 7 },
  { id: "first-proverb", title: "First proverb", detail: "A proverb joined your collection.", test: (s) => collected(s, "ilu") >= 1 },
  { id: "five-names", title: "Five names", detail: "You know the meaning of five names.", test: (s) => collected(s, "aha") >= 5 },
  { id: "first-story", title: "First story", detail: "You read your first story chapter.", test: (s) => collected(s, "akuko") >= 1 },
  { id: "together", title: "Together", detail: "Your cohort reached its weekly goal.", test: (s) => s.counts.questsDone >= 1 },
  { id: "out-in-the-world", title: "Out in the world", detail: "You used your words with someone real.", test: (s) => s.counts.missions >= 1 },
];

/** A seasonal achievement granted directly (not from a state test). */
export const NEW_YAM: Omit<AchievementDef, "test"> = { id: "new-yam", title: "New yam", detail: "You brought in a harvest in the New Yam season." };

const ALL: readonly Omit<AchievementDef, "test">[] = [...ACHIEVEMENTS, NEW_YAM];

/** Unlock everything newly true. Order follows the catalog. */
export function unlockAchievements(s: GameState, nowIso: string): { achievements: Record<string, string>; effects: GameEffect[] } {
  const achievements = { ...s.achievements };
  const effects: GameEffect[] = [];
  for (const a of ACHIEVEMENTS) {
    if (achievements[a.id]) continue;
    if (a.test(s)) {
      achievements[a.id] = nowIso;
      effects.push({ kind: "achievement", id: a.id });
    }
  }
  return { achievements, effects };
}

export function grantAchievement(s: GameState, id: string, nowIso: string): { achievements: Record<string, string>; effects: GameEffect[] } {
  if (s.achievements[id]) return { achievements: s.achievements, effects: [] };
  return { achievements: { ...s.achievements, [id]: nowIso }, effects: [{ kind: "achievement", id }] };
}

export function achievementDef(id: string): Omit<AchievementDef, "test"> | null {
  return ALL.find((a) => a.id === id) ?? null;
}

/** Unlocked first (newest first), then the rest in catalog order. */
export function achievementsView(s: GameState): AchievementView[] {
  const views = ALL.map((a) => ({ id: a.id, title: a.title, detail: a.detail, unlockedAt: s.achievements[a.id] ?? null }));
  const unlocked = views.filter((v) => v.unlockedAt).sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
  return [...unlocked, ...views.filter((v) => !v.unlockedAt)];
}

export { ALL as ACHIEVEMENT_CATALOG };
