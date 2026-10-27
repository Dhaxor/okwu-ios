// Studying a deck: cards that are due (most overdue first), then new ones,
// turned and rated by the learner. Each rating goes through usePlay().answer
// with the flashcard's exercise, so it reviews the same FSRS-6 card a lesson
// or the daily review would (one scheduler), lands in the review log, and
// counts for the market-day chain like any practice. Leaving loses nothing.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { DUE_DECK, Flashcard, RatingBar, StatTile, useFlashcards } from "@/components/feature/tools";
import { RotateCcw, X } from "@/components/glyphs/icons";
import { Button, Card, IconButton, ProgressBar, Screen, T, haptic, useConfirm } from "@/components/ui";
import { space } from "@/constants/theme";
import { xpOf, type GameEffect } from "@/lib/game";
import { cardKey, seedFrom, type Rating } from "@/lib/learning";
import { usePlay } from "@/lib/state";
import { nextDueWords } from "@/lib/state/practice";
import { flashOutcome, ratingPreview, studyQueue, tally, type StudyCard } from "@/lib/tools";

export default function StudyRoute() {
  const { deck: deckId, ahead } = useLocalSearchParams<{ deck: string; ahead?: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const fc = useFlashcards();
  const play = usePlay();
  const planned = useRef<StudyCard[] | null>(null);
  const [at, setAt] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const ratings = useRef<Rating[]>([]);
  const effects = useRef<GameEffect[]>([]);
  const startedAt = useRef(Date.now());
  const shownAt = useRef(Date.now());

  const deck = fc.ready && deckId ? fc.findDeck(deckId) : null;
  if (!planned.current && fc.ready && fc.bundle) {
    planned.current =
      deck && !fc.locked(deck)
        ? studyQueue({
            bundle: fc.bundle,
            progress: fc.learning.progress,
            scheduler: fc.learning.scheduler,
            refs: deck.refs.filter((r) => fc.card(r)),
            face: fc.face,
            now: new Date(),
            audible: fc.audible,
            seed: seedFrom(`flash:${deckId}:${Date.now()}`),
            ahead: ahead === "1",
            // "Study 4 due cards" studies those 4: no new cards from every open deck mixed in.
            ...(deckId === DUE_DECK ? { newMax: 0 } : {}),
          })
        : [];
  }
  const queue = planned.current ?? [];
  const current = queue[at];
  const view = current ? fc.card(current.ref) : null;

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/tools/flashcards")), [router]);

  // Listen first: the recording plays as the card appears. The answer side plays it once more.
  useEffect(() => {
    if (!view || finished) return;
    if (!flipped && current?.face === "audio") fc.audio.play(view);
    if (flipped) fc.audio.play(view);
  }, [at, flipped, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = current ? (fc.learning.progress.cards[cardKey(current.ref, current.facet)] ?? null) : null;
  const preview = useMemo(() => (current ? ratingPreview(fc.learning.scheduler, live, current.ref, current.facet, new Date()) : null), [current, live, fc.learning.scheduler]);

  const rate = (r: Rating) => {
    if (!current) return;
    const res = play.answer({ exercise: current.exercise, outcome: flashOutcome(r), durationMs: Date.now() - shownAt.current, source: "review" });
    effects.current.push(...res.effects);
    ratings.current.push(r);
    fc.audio.stop();
    haptic(r === 1 ? "select" : "success");
    if (at + 1 >= queue.length) {
      void play.flush();
      setFinished(true);
      return;
    }
    shownAt.current = Date.now();
    setFlipped(false);
    setAt(at + 1);
  };

  const leave = async () => {
    fc.audio.stop();
    if (ratings.current.length === 0) return close();
    const ok = await confirm({ title: "Leave these cards?", message: "Every card you rated is saved. The rest wait for next time.", confirmLabel: "Leave for now", cancelLabel: "Keep going" });
    if (!ok) return;
    await play.flush();
    close();
  };

  // ---- not ready, nothing to study, locked ----
  if (!fc.ready) return <Screen testID="study-loading" />;
  if (!deck || queue.length === 0) {
    const summary = deck && !fc.locked(deck) ? fc.summaryOf(deck) : null;
    const canAhead = !!summary && summary.total > 0 && ahead !== "1";
    return (
      <Screen
        testID="study-empty"
        center
        footer={
          <>
            {canAhead ? (
              <Button label="Practise anyway" onPress={() => router.replace({ pathname: "/tools/flashcards/study", params: { deck: deck!.id, ahead: "1" } })} testID="study-empty-ahead" block />
            ) : null}
            <Button label="Back to the deck" variant={canAhead ? "ghost" : "primary"} onPress={close} testID="study-empty-back" block />
          </>
        }
      >
        <View style={styles.center}>
          <Nnenne size={120} ground={summary?.total ? "ochre" : "paper"} mood={summary?.total ? "glad" : "calm"} />
          <T variant="label" tone="accent" center>
            Flashcards
          </T>
          <T variant="display" center accessibilityRole="header">
            {summary?.total ? "All caught up" : "No cards to study yet"}
          </T>
          <T variant="body" tone="muted" center>
            {summary?.nextDue
              ? `The next card comes back ${nextDueWords(summary.nextDue, new Date())}, just as it starts to fade. Practising early is fine too.`
              : "Add words to this deck, then come back."}
          </T>
        </View>
      </Screen>
    );
  }

  // ---- the end ----
  if (finished) {
    const t = tally(ratings.current);
    const xp = xpOf(effects.current).total;
    const after = fc.summaryOf(deck);
    const kept = effects.current.find((e) => e.kind === "izu-kept");
    return (
      <Screen
        testID="study-end"
        center
        footer={
          <>
            <Button label="Done" onPress={close} testID="study-end-done" block />
            {after.due > 0 || after.fresh > 0 ? (
              <Button
                label="Study more"
                icon={RotateCcw}
                variant="ghost"
                onPress={() => router.replace({ pathname: "/tools/flashcards/study", params: { deck: deck.id } })}
                testID="study-end-more"
                block
              />
            ) : null}
          </>
        }
      >
        <View style={styles.center}>
          <Nnenne size={120} ground="ochre" mood="glad" />
          <T variant="label" tone="accent" center>
            {deck.name}
          </T>
          <T variant="display" center accessibilityRole="header">
            {`${t.studied} ${t.studied === 1 ? "card" : "cards"} studied`}
          </T>
          <T variant="body" tone="muted" center>
            {t.again === 0
              ? "Each word comes back just as it starts to fade."
              : t.again === t.studied
                ? "They all come back soon, for another go."
                : `${t.again === 1 ? "One word comes" : `${t.again} words come`} back soon for another go; the rest wait until they start to fade.`}
          </T>
        </View>
        <Card variant="flat" padding="lg" testID="study-end-summary">
          <View style={styles.stats}>
            <StatTile big center value={String(t.knew)} label="Knew it" testID="study-end-knew" />
            <StatTile big center value={String(t.effort)} label="With effort" testID="study-end-effort" />
            <StatTile big center value={String(t.again)} label="Not yet" testID="study-end-again" />
          </View>
          <T variant="caption" center style={styles.endLine}>
            {[
              xp > 0 ? `+${xp} XP` : null,
              kept && kept.kind === "izu-kept" ? `Market week kept: ${kept.length}` : null,
              `${Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000))} min`,
              after.nextDue ? `Next card ${nextDueWords(after.nextDue, new Date())}` : after.due > 0 ? `${after.due} still due` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </T>
        </Card>
      </Screen>
    );
  }

  // ---- a card ----
  return (
    <Screen
      testID="study"
      contentStyle={styles.page}
      footer={
        flipped && preview ? (
          <>
            <T variant="caption" center>
              How well did you know it?
            </T>
            <RatingBar preview={preview} onRate={rate} testID="study-rate" />
          </>
        ) : (
          <Button label="Show answer" onPress={() => setFlipped(true)} testID="study-flip" block />
        )
      }
    >
      <View style={styles.top}>
        <IconButton icon={X} accessibilityLabel="Leave these cards" onPress={() => void leave()} testID="study-close" />
        <View style={styles.flex}>
          <ProgressBar value={at / queue.length} accessibilityLabel={`Card ${at + 1} of ${queue.length}`} testID="study-progress" />
        </View>
        <T variant="caption" numeric>{`${at + 1}/${queue.length}`}</T>
      </View>
      <View style={styles.meta}>
        <T variant="label" tone="accent" numberOfLines={1}>
          {deck.name}
        </T>
        {current && !current.card ? (
          <T variant="caption" tone="accent">
            New card
          </T>
        ) : null}
      </View>
      {view && current ? <Flashcard card={view} face={current.face} flipped={flipped} marks={fc.profile.toneMarks} audio={fc.audio} testID="study-card" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1 },
  center: { alignItems: "center", gap: space.sm },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: -space.md },
  stats: { flexDirection: "row", gap: space.md },
  endLine: { marginTop: space.md },
});
