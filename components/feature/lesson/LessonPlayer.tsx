// The lesson player: one exercise at a time, a calm progress bar, kind
// feedback in the thumb zone, and the peak-end moments at the close.
//
//   <LessonPlayer exercises={plan.exercises} lesson={id} track={track} source="lesson"
//                 onLeave={() => router.back()} onDone={() => router.back()} testID="lesson" />
//
// Every answer is checked (lib/learning), recorded on the cards and the
// review log, and passed to the game (usePlay().answer) as it happens, so
// leaving mid-lesson loses nothing. The end: LessonCompleteMoment (the one
// peak of the flow), then ChainKeptMoment when the izu chain grew.
//
// Practice sessions reuse it with `lesson={null}`: `onAnswered` sees every
// checked answer (the tone trainer's per-pattern summary) and `endContent`
// replaces the end card with the session's own honest summary. The flag in
// the top bar reports a problem with the words on screen; the book beside it
// re-opens the lesson's pattern note (`note`) in a sheet.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { ChainKeptMoment, LessonCompleteMoment } from "@/components/feature/game";
import { BookOpen, Flag, X } from "@/components/glyphs/icons";
import { Button, IconButton, ProgressBar, Screen, Sheet, haptic, useConfirm, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { toneMarked } from "@/lib/content";
import type { ItemId, LessonId, LessonNote } from "@/lib/content/types";
import { effectCopy, peakOf, xpOf, type GameEffect } from "@/lib/game";
import { createChecker, type CheckOutcome, type Response, type ReviewLog } from "@/lib/learning";
import {
  advance,
  answer,
  current,
  feedbackFor,
  learnerSettings,
  progressOf,
  skip,
  startRun,
  toggleDialect,
  useContent,
  useDialectLabels,
  useGame,
  useItemAudio,
  usePlay,
  useProfile,
  useVoiceRecorder,
  type LessonRun,
} from "@/lib/state";
import type { ReportSource } from "@/lib/state/reports";
import { ReportSheet, type ReportTarget } from "../practice/ReportSheet";
import { BuildSentenceView } from "./BuildSentence";
import { DialogueView } from "./Dialogue";
import { ListenChooseView } from "./ListenChoose";
import { FeedbackPanel } from "./parts";
import { PatternCard } from "./PatternCard";
import { SayItView } from "./SayIt";
import { StoryView } from "./Story";
import { TonePairView } from "./TonePair";
import { TypeItView } from "./TypeIt";
import { itemsShown, type ExerciseViewProps, type FooterMode } from "./types";
import type { Exercise } from "@/lib/learning";

export interface LessonPlayerProps {
  exercises: Exercise[];
  /** The lesson to record as complete (null: a practice session that is not a lesson). */
  lesson: LessonId | null;
  /** The lesson's pattern note, re-opened from the top bar. */
  note?: LessonNote | null;
  track: string;
  source?: ReviewLog["source"];
  /** Leave early (after the calm confirm). */
  onLeave: () => void;
  /** After the end moments. */
  onDone: () => void;
  /** The end screen's button. Default "Continue". */
  doneLabel?: string;
  /** The end moment's headline, when this flow has its own peak (the first run). Default: the game's peak. */
  peak?: { title: string; detail: string } | null;
  /** Every checked answer (and skip), as it happens: for a session's own summary. */
  onAnswered?: (answer: { exercise: Exercise; outcome: CheckOutcome; attempt: number }) => void;
  /** Replaces the end card (the summary of a practice session). The chain moment still follows. */
  endContent?: (summary: SessionSummary) => React.ReactNode;
  /** Where a "Report a problem" from this flow says it came from. */
  reportSource?: ReportSource;
  /** Shown under the end card (a lesson's "Save these words to a deck"). */
  endExtra?: (summary: SessionSummary) => React.ReactNode;
  testID: string;
}

export interface SessionSummary {
  xp: number;
  words: number;
  minutes: number;
  peak: { title: string; detail: string } | null;
  chain: number | null;
  /** Every item the session practised, the new ones first. */
  items: ItemId[];
}

const VIEWS: Record<Exercise["spec"]["type"], React.ComponentType<ExerciseViewProps>> = {
  "listen-choose": ListenChooseView,
  "tone-pair": TonePairView,
  "build-sentence": BuildSentenceView,
  "type-it": TypeItView,
  "say-it": SayItView,
  dialogue: DialogueView,
  story: StoryView,
};

export function LessonPlayer({ exercises, lesson, note = null, track, source = "lesson", onLeave, onDone, doneLabel = "Continue", peak: peakOverride, onAnswered, endContent, reportSource, endExtra, testID }: LessonPlayerProps) {
  const { bundle } = useContent();
  const { profile, set: setProfile } = useProfile();
  const game = useGame();
  const play = usePlay();
  const audio = useItemAudio();
  const recorder = useVoiceRecorder();
  const confirm = useConfirm();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const dialectLabels = useDialectLabels();
  const settings = useMemo(() => learnerSettings(profile), [profile]);
  const checker = useMemo(() => (bundle ? createChecker(bundle) : null), [bundle]);

  const [run, setRun] = useState<LessonRun>(() => startRun(exercises, new Date()));
  const [draft, setDraft] = useState<{ response: Response; chosen: ItemId | null } | null>(null);
  const [mode, setMode] = useState<FooterMode>({ kind: "check" });
  const [end, setEnd] = useState<null | { stage: "complete" | "chain"; summary: SessionSummary }>(null);
  const [reporting, setReporting] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const shownAt = useRef(Date.now());
  const effects = useRef<GameEffect[]>([]);
  const newWords = useRef(new Set<string>());
  const practised = useRef(new Set<string>());

  const item = current(run);
  const ex = item?.exercise ?? null;

  const onDraft = useCallback((response: Response | null, chosen?: ItemId | null) => {
    setDraft(response ? { response, chosen: chosen ?? null } : null);
  }, []);
  const onMode = useCallback((m: FooterMode) => setMode(m), []);

  const submit = useCallback(
    (response: Response) => {
      if (!ex || !checker || !item || run.phase !== "answering") return;
      const latencyMs = Date.now() - shownAt.current;
      const outcome = checker.check(ex, response, settings, { latencyMs, attempt: item.attempt });
      const r = play.answer({ exercise: ex, outcome, durationMs: latencyMs, source });
      effects.current.push(...r.effects);
      for (const e of r.events) if (e.kind === "new-item") newWords.current.add(e.item);
      for (const id of ex.spec.items) practised.current.add(id);
      haptic(outcome.selfAssessed ? "tap" : outcome.correct ? "success" : "warning");
      onAnswered?.({ exercise: ex, outcome, attempt: item.attempt });
      setRun((prev) => answer(prev, outcome));
    },
    [ex, checker, item, run.phase, settings, play, source, onAnswered]
  );

  const finish = useCallback(() => {
    const now = new Date();
    let all = effects.current;
    let minutes = Math.max(1, Math.round((now.getTime() - Date.parse(run.startedAt)) / 60_000));
    if (lesson) {
      const r = play.finishLesson({ track, lesson, startedAt: new Date(run.startedAt), exercises: run.firstTries, correctFirstTry: run.correctFirstTry });
      if (r) {
        all = [...all, ...r.effects];
        minutes = Math.max(1, Math.round(r.result.minutes));
      }
    } else {
      void play.flush();
    }
    const kept = all.find((e) => e.kind === "izu-kept");
    const peak = peakOf(all.filter((e) => e.kind !== "xp" && e.kind !== "izu-kept" && e.kind !== "izu-day"));
    haptic("success");
    setEnd({
      stage: "complete",
      summary: {
        xp: xpOf(all).total,
        words: newWords.current.size,
        minutes,
        peak: peakOverride ?? (peak ? effectCopy(peak, game.labels) : null),
        chain: kept && kept.kind === "izu-kept" ? kept.length : null,
        items: [...new Set([...newWords.current, ...practised.current])] as ItemId[],
      },
    });
  }, [run, lesson, track, play, game.labels, peakOverride]);

  const next = useCallback(() => {
    audio.stop();
    const after = advance(run);
    setDraft(null);
    setMode({ kind: "check" });
    shownAt.current = Date.now();
    if (after.phase === "done") {
      setRun(after);
      finish();
      return;
    }
    setRun(after);
  }, [run, audio, finish]);

  const onSkip = useCallback(() => {
    audio.stop();
    if (ex && item) onAnswered?.({ exercise: ex, outcome: { correct: false, rating: 1, skipped: true }, attempt: item.attempt });
    setDraft(null);
    setMode({ kind: "check" });
    shownAt.current = Date.now();
    const after = skip(run);
    setRun(after);
    if (after.phase === "done") finish();
  }, [run, audio, finish, ex, item, onAnswered]);

  const leave = async () => {
    audio.stop();
    if (run.at === 0 && run.phase === "answering") return onLeave();
    const ok = await confirm({
      title: "Leave this lesson?",
      message: "Everything you answered is saved. You can pick the lesson up again from Learn.",
      confirmLabel: "Leave for now",
      cancelLabel: "Keep going",
    });
    if (ok) {
      await play.flush();
      onLeave();
    }
  };

  // ---- the end: the peak, then the chain ----
  if (end) {
    const s = end.summary;
    const izu = game.view?.izu;
    const toChain = end.stage === "complete" && s.chain !== null && !!izu;
    return (
      <Screen
        testID={`${testID}-end`}
        center
        footer={
          <Button
            label={toChain ? "Continue" : doneLabel}
            onPress={() => (toChain ? setEnd({ ...end, stage: "chain" }) : onDone())}
            testID={`${testID}-end-continue`}
            block
          />
        }
      >
        {end.stage === "complete" && endContent ? (
          endContent(s)
        ) : end.stage === "complete" ? (
          <LessonCompleteMoment xp={s.xp} words={s.words} minutes={s.minutes} peak={s.peak} izu={height >= 760 ? izu : undefined} labels={game.labels} testID={`${testID}-complete`} />
        ) : izu ? (
          <ChainKeptMoment length={s.chain ?? izu.length} cells={izu.cells} labels={game.labels} testID={`${testID}-chain`} />
        ) : null}
        {end.stage === "complete" && endExtra ? endExtra(s) : null}
      </Screen>
    );
  }

  if (!bundle || !ex || !item) return <Screen testID={testID} />;

  const View_ = VIEWS[ex.spec.type];
  const checked = run.phase === "feedback";
  const feedback = checked && run.outcome && !run.outcome.skipped ? feedbackFor({ bundle, exercise: ex, outcome: run.outcome, showTones: settings.showTones, dialectLabels, chosen: draft?.chosen ?? null }) : null;
  const isLast = run.at === run.items.length - 1;
  const reportTargets: ReportTarget[] = [...new Set(itemsShown(ex))]
    .map((id) => bundle.items[id])
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => ({
      target: { kind: "item" as const, id: i.id },
      shown: toneMarked(i) ?? i.spelling,
      gloss: i.gloss.en,
      source: reportSource ?? (source === "story" ? "lesson" : source),
      version: bundle.version,
    }));

  const footer = (
    <>
      {feedback ? (
        <FeedbackPanel
          feedback={feedback}
          onAddDialect={
            feedback.offerDialect && !profile.dialects.includes(feedback.offerDialect.id)
              ? () => {
                  const d = feedback.offerDialect!;
                  setProfile((p) => toggleDialect(p, d.id, true));
                  toast.show(`${d.label} forms are now accepted as answers.`, { tone: "success" });
                }
              : undefined
          }
          testID={`${testID}-feedback`}
        />
      ) : null}
      {checked ? (
        <Button label={isLast ? "Finish" : "Continue"} onPress={next} testID={`${testID}-continue`} block />
      ) : mode.kind === "check" ? (
        <Button label="Check" onPress={() => draft && submit(draft.response)} disabled={!draft} testID={`${testID}-check`} block />
      ) : mode.kind === "self" ? (
        <View style={styles.selfRow}>
          <Button label="Not yet" variant="secondary" onPress={() => submit({ type: "self", matched: false })} testID={`${testID}-not-yet`} style={styles.flex} />
          <Button label="Matched" onPress={() => submit({ type: "self", matched: true })} testID={`${testID}-matched`} style={styles.flex} />
        </View>
      ) : (
        <Button label={mode.label} onPress={mode.onPress} testID={`${testID}-next`} block />
      )}
    </>
  );

  return (
    <Screen testID={testID} keyboard={ex.spec.type === "type-it"} footer={footer}>
      <View style={styles.top}>
        <IconButton icon={X} accessibilityLabel="Leave lesson" onPress={() => void leave()} testID={`${testID}-close`} />
        <View style={styles.flex}>
          <ProgressBar
            value={progressOf(run)}
            accessibilityLabel={`Exercise ${Math.min(run.at + 1, run.items.length)} of ${run.items.length}`}
            testID={`${testID}-progress`}
          />
        </View>
        {note ? <IconButton icon={BookOpen} accessibilityLabel="The pattern for this lesson" onPress={() => setNoteOpen(true)} testID={`${testID}-note`} /> : null}
        {reportTargets.length > 0 ? <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} testID={`${testID}-report`} /> : null}
      </View>
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targets={reportTargets} testID={`${testID}-report-sheet`} />
      {note ? (
        <Sheet
          visible={noteOpen}
          onClose={() => {
            audio.stop();
            setNoteOpen(false);
          }}
          scroll
          footer={
            <Button
              label="Back to the lesson"
              onPress={() => {
                audio.stop();
                setNoteOpen(false);
              }}
              testID={`${testID}-note-close`}
              block
            />
          }
          testID={`${testID}-note-sheet`}
        >
          <PatternCard note={note} bundle={bundle} marks={profile.toneMarks} audio={audio} bare testID={`${testID}-note-card`} />
        </Sheet>
      ) : null}
      <View_
        key={`${ex.id}#${item.attempt}`}
        exercise={ex}
        bundle={bundle}
        phase={checked ? "feedback" : "answering"}
        outcome={run.outcome}
        marks={profile.toneMarks}
        audio={audio}
        recorder={recorder}
        onDraft={onDraft}
        onSubmit={submit}
        onMode={onMode}
        onSkip={onSkip}
        testID={`${testID}-${ex.spec.type}`}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  selfRow: { flexDirection: "row", gap: space.sm },
});
