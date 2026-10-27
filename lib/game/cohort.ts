// Ọgbọ co-op weekly quests (docs/CONTRACTS.md §3, §4). A cohort shares one
// target for the ISO week; everyone's practice adds to the same total and
// nobody is ranked. The device counts this learner's part; the server
// (owner C) syncs the cohort total. The displayed total is the last synced
// total plus whatever this learner did since that sync, so progress shows
// immediately offline and never double counts after a sync.
import { daysLeftInWeek, weekKey as weekKeyOf } from "./calendar";
import { QUESTS } from "./rules";
import type { CohortQuest, CohortSnapshot, GameEffect, LocalDate, QuestMetric, QuestView } from "./types";

const MILESTONES = [25, 50, 75] as const;

/** A stable number from a week key (FNV-1a), to pick that week's default quest. */
function seedFromWeek(week: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < week.length; i++) {
    h ^= week.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function questDef(id: string) {
  return QUESTS.find((q) => q.id === id) ?? null;
}

/** The quest for a week when the server has not chosen one (deterministic per week). */
export function defaultQuestFor(week: string) {
  return QUESTS[seedFromWeek(week) % QUESTS.length] ?? QUESTS[0]!;
}

export function startQuest(week: string, members: number, questId?: string): CohortQuest {
  const def = (questId ? questDef(questId) : null) ?? defaultQuestFor(week);
  const m = Math.max(1, Math.floor(members));
  return {
    week,
    questId: def.id,
    metric: def.metric,
    target: def.perMember * m,
    members: m,
    mine: 0,
    mineSynced: 0,
    syncedTotal: 0,
    syncedAt: null,
    milestones: [],
    completedAt: null,
  };
}

export function questTotal(q: CohortQuest): number {
  return q.syncedTotal + Math.max(0, q.mine - q.mineSynced);
}

/** Celebrate milestones and completion once each. */
function milestones(q: CohortQuest, nowIso: string): { quest: CohortQuest; effects: GameEffect[]; completed: boolean } {
  const effects: GameEffect[] = [];
  const pct = q.target > 0 ? (questTotal(q) / q.target) * 100 : 0;
  let quest = q;
  for (const m of MILESTONES) {
    if (pct >= m && !quest.milestones.includes(m) && pct < 100) {
      quest = { ...quest, milestones: [...quest.milestones, m] };
      effects.push({ kind: "quest-progress", percent: m });
    }
  }
  let completed = false;
  if (pct >= 100 && !quest.completedAt) {
    quest = { ...quest, completedAt: nowIso, milestones: [...new Set([...quest.milestones, ...MILESTONES, 100])] };
    effects.push({ kind: "quest-complete", questId: quest.questId });
    completed = true;
  }
  // Only the highest new milestone is worth a moment.
  const progress = effects.filter((e) => e.kind === "quest-progress");
  const trimmed: GameEffect[] = effects.filter((e) => e.kind !== "quest-progress");
  if (!completed && progress.length > 0) trimmed.unshift(progress[progress.length - 1]!);
  return { quest, effects: trimmed, completed };
}

/** Count this learner's practice toward the quest if it measures `metric`. */
export function contribute(q: CohortQuest | null, metric: QuestMetric, amount: number, nowIso: string): { quest: CohortQuest | null; effects: GameEffect[]; completed: boolean } {
  if (!q || q.metric !== metric || amount <= 0) return { quest: q, effects: [], completed: false };
  return milestones({ ...q, mine: q.mine + amount }, nowIso);
}

/** A new week starts a new quest with the same cohort (the server may replace it at the next sync). */
export function rollWeek(q: CohortQuest | null, today: LocalDate): CohortQuest | null {
  if (!q) return null;
  const week = weekKeyOf(today);
  return q.week === week ? q : startQuest(week, q.members);
}

/** Merge the server's totals. A snapshot for another week or quest replaces the local quest. */
export function sync(q: CohortQuest | null, snap: CohortSnapshot, nowIso: string): { quest: CohortQuest; effects: GameEffect[]; completed: boolean } {
  const same = q && q.week === snap.week && q.questId === snap.questId;
  const base: CohortQuest = same && q ? q : { ...startQuest(snap.week, snap.members, snap.questId), mine: 0 };
  const mine = Math.max(base.mine, snap.mine);
  const merged: CohortQuest = {
    ...base,
    week: snap.week,
    questId: snap.questId,
    metric: snap.metric,
    target: Math.max(1, snap.target),
    members: Math.max(1, snap.members),
    mine,
    mineSynced: Math.min(mine, snap.mine),
    syncedTotal: Math.max(0, snap.total),
    syncedAt: nowIso,
  };
  return milestones(merged, nowIso);
}

export function questView(q: CohortQuest | null, today: LocalDate): QuestView | null {
  if (!q) return null;
  const def = questDef(q.questId);
  const total = questTotal(q);
  return {
    questId: q.questId,
    metric: q.metric,
    title: def?.title ?? "This week together",
    detail: def?.detail ?? "Practise together as a cohort.",
    target: q.target,
    total,
    mine: q.mine,
    members: q.members,
    progress: q.target > 0 ? Math.min(1, total / q.target) : 0,
    daysLeft: q.week === weekKeyOf(today) ? daysLeftInWeek(today) : 0,
    complete: !!q.completedAt,
  };
}
