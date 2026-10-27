// The app's learning state, in one provider (mount inside ProfileProvider):
//   useContent()   the content bundle: loading | ready | error, with retry
//   useLearning()  progress (okwu.progress.v1) and the review log (okwu.reviewlog.v1)
//   useGame()      game state (okwu.game.v1), its view, labels, harvest/revive
//   usePlay()      the actions screens call: answer, finishLesson, place, …
// Every write goes through a crash-safe store (./store) and is flushed when
// the app leaves the foreground; the game ticks when the app comes back.
// The pure logic is in ./play (tested); this file only holds and persists.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { loadBundle } from "@/lib/content";
import type { ContentBundle, LessonId, TrackId } from "@/lib/content/types";
import {
  LEARNING_KEYS,
  createScheduler,
  emptyProgress,
  parseProgress,
  parseReviewLog,
  serializeProgress,
  serializeReviewLog,
  type CheckOutcome,
  type Exercise,
  type LearningEvent,
  type LessonResult,
  type PlacementResult,
  type Progress,
  type ReviewLog,
  type Scheduler,
} from "@/lib/learning";
import { GAME_KEY, deviceCalendar, emptyGameState, parseGameState, type GameEffect, type GameEngine, type GameLabels, type GameState, type GameView } from "@/lib/game";
import { deviceKV } from "./kv";
import { engineFor, gameLabelsFrom, playAnswer, playLessonComplete, playPlacement, utcOffsetMinutes, type LearningData } from "./play";
import { createStore } from "./store";

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

const today = () => deviceCalendar.dayKey(new Date());

export const progressStore = createStore<Progress>({ key: LEARNING_KEYS.progress, kv: deviceKV, parse: parseProgress, serialize: serializeProgress, debounceMs: 250 });
export const reviewLogStore = createStore<ReviewLog[]>({ key: LEARNING_KEYS.reviewLog, kv: deviceKV, parse: parseReviewLog, serialize: serializeReviewLog, debounceMs: 800 });
export const gameStore = createStore<GameState>({ key: GAME_KEY, kv: deviceKV, parse: (raw) => parseGameState(raw, today()), debounceMs: 250 });

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export type ContentStatus = "loading" | "ready" | "error";

export interface ContentState {
  status: ContentStatus;
  bundle: ContentBundle | null;
  error: string | null;
  retry: () => void;
}

export interface LearningState {
  ready: boolean;
  progress: Progress;
  reviewLog: ReviewLog[];
  scheduler: Scheduler;
}

export interface GameCtxState {
  ready: boolean;
  state: GameState;
  /** Derived for drawing (null until the bundle and the saved game are loaded). */
  view: GameView | null;
  engine: GameEngine | null;
  /** Igbo names for market days, places and crops, from approved content only. */
  labels: GameLabels;
  /** Effects from the last foreground tick (a repair window opening, a chain resting). */
  tickEffects: GameEffect[];
  harvest: () => GameEffect[];
  revive: () => GameEffect[];
}

export interface AnswerInput {
  exercise: Exercise;
  outcome: CheckOutcome;
  durationMs: number;
  source?: ReviewLog["source"];
}

export interface FinishInput {
  track: TrackId | string;
  lesson: LessonId;
  startedAt: Date;
  exercises: number;
  correctFirstTry: number;
}

export interface PlayActions {
  /** Record a checked answer on the cards and the log, and apply its events to the game. */
  answer: (input: AnswerInput) => { effects: GameEffect[]; events: LearningEvent[] };
  /** Finish a lesson (unlocking what follows). Returns its result and the effects. */
  finishLesson: (input: FinishInput) => { result: LessonResult; effects: GameEffect[] } | null;
  /** Store a placement result (the start unit opens). */
  place: (placement: PlacementResult) => void;
  /** Forget all learning and game data on this device. */
  resetAll: () => Promise<void>;
  /** Write everything now (before a navigation that may unmount). */
  flush: () => Promise<void>;
}

const ContentCtx = createContext<ContentState | null>(null);
const LearningCtx = createContext<LearningState | null>(null);
const GameCtx = createContext<GameCtxState | null>(null);
const PlayCtx = createContext<PlayActions | null>(null);

function need<T>(v: T | null, name: string): T {
  if (!v) throw new Error(`${name} needs <AppStateProvider> (lib/state/AppState)`);
  return v;
}

export const useContent = () => need(useContext(ContentCtx), "useContent");
export const useLearning = () => need(useContext(LearningCtx), "useLearning");
export const useGame = () => need(useContext(GameCtx), "useGame");
export const usePlay = () => need(useContext(PlayCtx), "usePlay");

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppStateProvider({ children }: { children?: React.ReactNode }) {
  // Content
  const [bundle, setBundle] = useState<ContentBundle | null>(null);
  const [contentStatus, setContentStatus] = useState<ContentStatus>("loading");
  const [contentError, setContentError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setContentStatus("loading");
    loadBundle()
      .then((b) => {
        if (!live) return;
        if (Object.keys(b.units).length === 0 && Object.keys(b.items).length === 0) throw new Error("empty bundle");
        setBundle(b);
        setContentStatus("ready");
        setContentError(null);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setContentError(e instanceof Error ? e.message : String(e));
        setContentStatus("error");
      });
    return () => {
      live = false;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Learning + game (refs are the source of truth between renders, so fast answers never race)
  const scheduler = useMemo(() => createScheduler(), []);
  const learningRef = useRef<LearningData>({ progress: emptyProgress(), log: [] });
  const gameRef = useRef<GameState>(emptyGameState(today()));
  const [learning, setLearning] = useState<LearningData>(learningRef.current);
  const [game, setGame] = useState<GameState>(gameRef.current);
  const [loaded, setLoaded] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [tickEffects, setTickEffects] = useState<GameEffect[]>([]);

  const engine = useMemo(() => (bundle ? engineFor(bundle) : null), [bundle]);
  const labels = useMemo(() => (bundle ? gameLabelsFrom(bundle) : {}), [bundle]);

  const commitLearning = useCallback((next: LearningData) => {
    const prev = learningRef.current;
    learningRef.current = next;
    setLearning(next);
    if (next.progress !== prev.progress) progressStore.save(next.progress);
    if (next.log !== prev.log) reviewLogStore.save(next.log);
  }, []);
  const commitGame = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
    gameStore.save(next);
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([progressStore.load(), reviewLogStore.load(), gameStore.load()])
      .then(([progress, log, g]) => {
        if (!live) return;
        learningRef.current = { progress, log };
        gameRef.current = g;
        setLearning(learningRef.current);
        setGame(g);
      })
      .catch(() => {})
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  const flush = useCallback(async () => {
    await Promise.all([progressStore.flush(), reviewLogStore.flush(), gameStore.flush()]);
  }, []);

  // Tick when everything is loaded, and again whenever the app returns to the foreground.
  const tick = useCallback(() => {
    if (!engine) return;
    const now = new Date();
    const r = engine.tick(gameRef.current, now);
    setClock(now);
    if (r.state !== gameRef.current) commitGame(r.state);
    if (r.effects.length) setTickEffects(r.effects);
  }, [engine, commitGame]);

  useEffect(() => {
    if (loaded && engine) tick();
  }, [loaded, engine, tick]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") tick();
      else void flush();
    });
    return () => sub.remove();
  }, [tick, flush]);

  const view = useMemo(() => (engine && loaded ? engine.view(game, clock) : null), [engine, loaded, game, clock]);

  const harvest = useCallback(() => {
    if (!engine) return [];
    const r = engine.harvest(gameRef.current, new Date());
    commitGame(r.state);
    return r.effects;
  }, [engine, commitGame]);

  const revive = useCallback(() => {
    if (!engine) return [];
    const r = engine.revive(gameRef.current, new Date());
    commitGame(r.state);
    return r.effects;
  }, [engine, commitGame]);

  const actions = useMemo<PlayActions>(
    () => ({
      answer({ exercise, outcome, durationMs, source = "lesson" }) {
        if (!bundle || !engine) return { effects: [], events: [] };
        const now = new Date();
        const r = playAnswer({ bundle, learning: learningRef.current, game: gameRef.current, engine, scheduler, exercise, outcome, now, durationMs, source });
        if (r.learning !== learningRef.current) commitLearning(r.learning);
        if (r.game !== gameRef.current) commitGame(r.game);
        setClock(now);
        return { effects: r.effects, events: r.events };
      },
      finishLesson({ track, lesson, startedAt, exercises, correctFirstTry }) {
        if (!bundle || !engine) return null;
        const now = new Date();
        const r = playLessonComplete({
          bundle,
          learning: learningRef.current,
          game: gameRef.current,
          engine,
          track,
          lesson,
          startedAt,
          now,
          exercises,
          correctFirstTry,
          utcOffsetMinutes: utcOffsetMinutes(now),
        });
        commitLearning(r.learning);
        commitGame(r.game);
        setClock(now);
        void flush();
        return { result: r.result, effects: r.effects };
      },
      place(placement) {
        commitLearning(playPlacement(learningRef.current, placement, new Date()));
      },
      async resetAll() {
        const fresh: LearningData = { progress: emptyProgress(), log: [] };
        learningRef.current = fresh;
        gameRef.current = emptyGameState(today());
        setLearning(fresh);
        setGame(gameRef.current);
        await Promise.all([progressStore.clear(), reviewLogStore.clear(), gameStore.clear()]);
      },
      flush,
    }),
    [bundle, engine, scheduler, commitLearning, commitGame, flush]
  );

  const content = useMemo<ContentState>(() => ({ status: contentStatus, bundle, error: contentError, retry }), [contentStatus, bundle, contentError, retry]);
  const learningState = useMemo<LearningState>(() => ({ ready: loaded, progress: learning.progress, reviewLog: learning.log, scheduler }), [loaded, learning, scheduler]);
  const gameState = useMemo<GameCtxState>(
    () => ({ ready: loaded && !!engine, state: game, view, engine, labels, tickEffects, harvest, revive }),
    [loaded, engine, game, view, labels, tickEffects, harvest, revive]
  );

  return (
    <ContentCtx.Provider value={content}>
      <LearningCtx.Provider value={learningState}>
        <GameCtx.Provider value={gameState}>
          <PlayCtx.Provider value={actions}>{children}</PlayCtx.Provider>
        </GameCtx.Provider>
      </LearningCtx.Provider>
    </ContentCtx.Provider>
  );
}
