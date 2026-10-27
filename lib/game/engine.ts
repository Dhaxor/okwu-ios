// The GameEngine (docs/CONTRACTS.md §3). Pure: the same state, event and
// time always give the same result, and the input state is never mutated.
// It consumes LearningEvents from owner A's engine and returns the next
// state plus GameEffects for the UI to celebrate (one peak per flow).
//
//   screen ── LearningEvent ──▶ engine.apply(state, event, now) ──▶ { state, effects }
//   app open / foreground     ─▶ engine.tick(state, now)
//   UI                         ─▶ engine.view(state, now), engine.notifications(…)
import type { LearningEvent } from "@/lib/learning/types";
import type { UnitId } from "@/lib/content/types";
import { grantAchievement, NEW_YAM, unlockAchievements, achievementsView } from "./achievements";
import { daysBetween, deviceCalendar, festivalOn, marketDayOf, alignment } from "./calendar";
import { collectChapter, collectionsView, collectItem, PLACEHOLDER_CATALOG } from "./collections";
import { contribute, questView, rollWeek, sync } from "./cohort";
import { canRevive, izuContext, izuView, practiseDay, repairLesson, revive, rollIzu } from "./izu";
import { planNotifications } from "./notifications";
import { obodoView, restore } from "./obodo";
import { MARKET_DAY_ANCHOR, TOUCHES_PER_PRACTICE_DAY } from "./rules";
import { gardenView, harvest, tend } from "./ubi";
import { grant, grantedToday, type XpGrant } from "./xp";
import type { GameEffect, GameEngine, GameEngineOptions, GameResult, GameState, LocalDate, QuestMetric, XpSource } from "./types";

/** Away at least this many days, the next practice is a welcome back. */
export const WELCOME_BACK_AFTER_DAYS = 7;

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

export function createGameEngine(options: GameEngineOptions = {}): GameEngine {
  const cal = options.calendar ?? deviceCalendar;
  const anchor = options.anchor === undefined ? MARKET_DAY_ANCHOR : options.anchor;
  const course = options.course ?? null;
  const catalog = options.catalog ?? PLACEHOLDER_CATALOG;
  const ctxFor = (s: GameState) => izuContext(cal, anchor, s.startedOn);

  /** Roll time forward (izu, repair window, cohort week, today's counters). Mutates `s`. */
  function rollInPlace(s: GameState, now: Date, effects: GameEffect[]) {
    const today = cal.dayKey(now);
    const rolled = rollIzu(s.izu, now, ctxFor(s));
    s.izu = rolled.izu;
    effects.push(...rolled.effects);
    s.cohort = rollWeek(s.cohort, today);
    if (s.day.date !== today) s.day = { date: today, lessons: 0, touches: 0, counted: false };
  }

  function addXp(s: GameState, g: XpGrant, today: LocalDate, effects: GameEffect[]): number {
    const r = grant(s.xp, g, today);
    s.xp = r.ledger;
    if (r.amount > 0) effects.push({ kind: "xp", amount: r.amount, source: r.source });
    return r.amount;
  }

  function grow(s: GameState, source: XpSource, today: LocalDate, nowIso: string, from: UnitId, effects: GameEffect[]) {
    const t = tend(s.ubi, source, today, nowIso, from);
    s.ubi = t.garden;
    effects.push(...t.effects);
  }

  function quest(s: GameState, metric: QuestMetric, amount: number, nowIso: string, effects: GameEffect[]) {
    const r = contribute(s.cohort, metric, amount, nowIso);
    s.cohort = r.quest;
    effects.push(...r.effects);
    if (r.completed) s.counts.questsDone += 1;
  }

  /** A new item met for the first time (from a new-item event or a lesson's list). Deduped per day. */
  function newItem(s: GameState, item: string, today: LocalDate, nowIso: string, from: UnitId, effects: GameEffect[]) {
    if (grantedToday(s.xp, `n:${item}`, today)) return;
    addXp(s, { source: "new-item", key: item }, today, effects);
    s.counts.newItems += 1;
    s.day.touches += 1;
    const c = collectItem(s.collections, item, catalog, nowIso);
    s.collections = c.entries;
    effects.push(...c.effects);
    grow(s, "new-item", today, nowIso, from, effects);
    quest(s, "new-words", 1, nowIso, effects);
  }

  /** Count today toward the izu once it holds a lesson, a chapter, or enough small practice. */
  function maybeCountDay(s: GameState, now: Date, today: LocalDate, nowIso: string, effects: GameEffect[], strong: boolean) {
    if (s.day.counted) return;
    if (!strong && s.day.lessons === 0 && s.day.touches < TOUCHES_PER_PRACTICE_DAY) return;
    s.day.counted = true;
    if (s.lastPractice) {
      const away = daysBetween(s.lastPractice, today);
      if (away >= WELCOME_BACK_AFTER_DAYS) {
        effects.push({ kind: "welcome-back", days: away });
        s.counts.returns += 1;
      }
    }
    if (!s.lastPractice || daysBetween(s.lastPractice, today) > 0) s.lastPractice = today;
    const p = practiseDay(s.izu, now, ctxFor(s));
    s.izu = p.izu;
    effects.push(...p.effects);
    quest(s, "practice-days", 1, nowIso, effects);
  }

  function finish(s: GameState, nowIso: string, effects: GameEffect[]): GameResult {
    const a = unlockAchievements(s, nowIso);
    s.achievements = a.achievements;
    effects.push(...a.effects);
    return { state: s, effects };
  }

  const engine: GameEngine = {
    dayKey: (date) => cal.dayKey(date),

    marketDay(date, state) {
      const key = cal.dayKey(date);
      return marketDayOf(key, alignment(anchor, state?.startedOn ?? key));
    },

    tick(state, now) {
      const s = clone(state);
      const effects: GameEffect[] = [];
      rollInPlace(s, now, effects);
      return { state: s, effects };
    },

    apply(state, event, now) {
      const s = clone(state);
      const effects: GameEffect[] = [];
      rollInPlace(s, now, effects);
      const today = cal.dayKey(now);
      const nowIso = now.toISOString();

      switch (event.kind) {
        case "lesson-complete": {
          const lesson = String(event.result.lesson);
          const unit = (course?.lessons[lesson]?.unit ?? "") as UnitId;
          const first = !s.lessonsDone.includes(lesson);
          // Items the lesson introduced count once, even if their new-item events also arrive.
          for (const item of event.result.newItems) newItem(s, String(item), today, nowIso, unit, effects);
          addXp(s, { source: "lesson", key: lesson, repeat: !first }, today, effects);
          s.counts.lessons += 1;
          s.day.lessons += 1;
          if (first) {
            s.lessonsDone = [...s.lessonsDone, lesson];
            const o = restore(s.obodo, s.lessonsDone, course);
            s.obodo = o.obodo;
            effects.push(...o.effects);
          }
          const r = repairLesson(s.izu, now);
          s.izu = r.izu;
          effects.push(...r.effects);
          if (r.repaired) s.counts.repairs += 1;
          grow(s, "lesson", today, nowIso, unit, effects);
          quest(s, "lessons", 1, nowIso, effects);
          maybeCountDay(s, now, today, nowIso, effects, true);
          break;
        }
        case "new-item": {
          newItem(s, String(event.item), today, nowIso, "" as UnitId, effects);
          maybeCountDay(s, now, today, nowIso, effects, false);
          break;
        }
        case "review": {
          s.counts.reviews += 1;
          s.day.touches += 1;
          const got = addXp(s, { source: "review", key: String(event.log.item) }, today, effects);
          if (got > 0) grow(s, "review", today, nowIso, "" as UnitId, effects);
          maybeCountDay(s, now, today, nowIso, effects, false);
          break;
        }
        case "spoke": {
          s.counts.spoken += 1;
          s.day.touches += 1;
          const got = addXp(s, { source: "speaking", key: String(event.item) }, today, effects);
          if (got > 0) {
            grow(s, "speaking", today, nowIso, "" as UnitId, effects);
            quest(s, "speaking", 1, nowIso, effects);
          }
          maybeCountDay(s, now, today, nowIso, effects, false);
          break;
        }
        case "story-chapter": {
          const c = collectChapter(s.collections, event.story, event.chapter, nowIso);
          s.collections = c.entries;
          effects.push(...c.effects);
          addXp(s, { source: "story", key: `${event.story}:${event.chapter}`, repeat: !c.first }, today, effects);
          if (c.first) {
            s.counts.chapters += 1;
            quest(s, "stories", 1, nowIso, effects);
          }
          grow(s, "story", today, nowIso, "" as UnitId, effects);
          maybeCountDay(s, now, today, nowIso, effects, true);
          break;
        }
      }
      return finish(s, nowIso, effects);
    },

    harvest(state, now) {
      const s = clone(state);
      const effects: GameEffect[] = [];
      rollInPlace(s, now, effects);
      const today = cal.dayKey(now);
      const nowIso = now.toISOString();
      const h = harvest(s.ubi, today);
      if (h.count === 0) return { state: s, effects };
      s.ubi = h.garden;
      s.counts.harvests += h.count;
      effects.push(...h.effects);
      if (h.festival === "iri-ji") {
        const g = grantAchievement(s, NEW_YAM.id, nowIso);
        s.achievements = g.achievements;
        effects.push(...g.effects);
      }
      return finish(s, nowIso, effects);
    },

    revive(state, now) {
      const s = clone(state);
      const effects: GameEffect[] = [];
      rollInPlace(s, now, effects);
      const r = revive(s.izu, cal.dayKey(now));
      s.izu = r.izu;
      effects.push(...r.effects);
      return finish(s, now.toISOString(), effects);
    },

    completeMission(state, missionId, now) {
      const s = clone(state);
      const effects: GameEffect[] = [];
      rollInPlace(s, now, effects);
      const today = cal.dayKey(now);
      const nowIso = now.toISOString();
      const m = s.missions.find((x) => x.id === missionId);
      if (!m || m.doneAt) return { state: s, effects };
      s.missions = s.missions.map((x) => (x.id === missionId ? { ...x, doneAt: nowIso } : x));
      s.counts.missions += 1;
      addXp(s, { source: "mission" }, today, effects);
      grow(s, "mission", today, nowIso, "" as UnitId, effects);
      return finish(s, nowIso, effects);
    },

    syncCohort(state, snapshot, now) {
      const s = clone(state);
      const effects: GameEffect[] = [];
      rollInPlace(s, now, effects);
      const nowIso = now.toISOString();
      const r = sync(s.cohort, snapshot, nowIso);
      s.cohort = r.quest;
      effects.push(...r.effects);
      if (r.completed) s.counts.questsDone += 1;
      return finish(s, nowIso, effects);
    },

    view(state, now) {
      const s = clone(state);
      rollInPlace(s, now, []);
      const today = cal.dayKey(now);
      const ctx = ctxFor(s);
      return {
        today,
        marketDay: marketDayOf(today, ctx.align),
        xp: { total: s.xp.total, today: s.xp.byDay[today] ?? 0 },
        izu: izuView(s.izu, now, ctx, anchor == null),
        garden: gardenView(s.ubi, today, s.lastPractice),
        obodo: obodoView(s.obodo, s.lessonsDone, course),
        collections: collectionsView(s.collections, catalog),
        quest: questView(s.cohort, today),
        achievements: achievementsView(s),
        festival: festivalOn(today),
      };
    },

    notifications(state, now, prefs) {
      const s = clone(state);
      rollInPlace(s, now, []);
      return planNotifications(s, now, prefs, ctxFor(s));
    },
  };
  return engine;
}

/** Convenience for screens: can the Homecoming revival be offered now? */
export function revivalAvailable(engine: GameEngine, state: GameState, now: Date): boolean {
  return engine.view(state, now).izu.revival !== null;
}

export { canRevive };
