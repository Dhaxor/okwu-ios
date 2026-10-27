// Today's review: the FSRS cards that are due, most overdue first
// (planSession mode "review"), played by the LessonPlayer with no lesson to
// complete. Nothing due: an "all caught up" end state that says when the
// words come back, and offers the tone trainer.
import React, { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { LessonPlayer } from "@/components/feature/lesson/LessonPlayer";
import { ReviewEnd } from "@/components/feature/practice";
import { Button, Screen, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { planSession, seedFrom, type Exercise } from "@/lib/learning";
import { learnerSettings, resolveTrack, useContent, useLearning, useProfile } from "@/lib/state";
import { nextDueWords, reviewOverview } from "@/lib/state/practice";

export default function ReviewRoute() {
  const router = useRouter();
  const { status, bundle, retry } = useContent();
  const learning = useLearning();
  const { profile } = useProfile();
  const planned = useRef<{ exercises: Exercise[]; track: string; words: number } | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/practice"));

  // Plan once, when the bundle and the saved progress are both in.
  if (!planned.current && bundle && learning.ready) {
    const plan = planSession({
      bundle,
      progress: learning.progress,
      settings: learnerSettings(profile),
      scheduler: learning.scheduler,
      now: new Date(),
      seed: seedFrom(`review:${Date.now()}`),
      mode: "review",
    });
    const track = resolveTrack(bundle, profile.track || (profile.heritage ? "heritage" : "new-learner")) ?? "";
    planned.current = { exercises: plan.exercises, track, words: new Set(plan.exercises.flatMap((e) => e.spec.items)).size };
  }

  const p = planned.current;
  if (p && p.exercises.length > 0) {
    return (
      <LessonPlayer
        exercises={p.exercises}
        lesson={null}
        track={p.track}
        source="review"
        onLeave={close}
        onDone={close}
        doneLabel="Back to Practice"
        endContent={(s) => <ReviewEnd summary={s} reviewed={p.words} testID="review-end-summary" />}
        testID="review"
      />
    );
  }

  const loading = status === "loading" || (status === "ready" && !learning.ready);
  const failed = status === "error";
  const overview = bundle && learning.ready ? reviewOverview(bundle, learning.progress, learning.scheduler, new Date()) : null;
  const learned = overview?.learnedWords ?? 0;
  return (
    <Screen
      testID="review-empty"
      center
      footer={
        loading ? undefined : (
          <>
            <Button label={failed ? "Try again" : "Back to Practice"} onPress={failed ? retry : close} testID="review-empty-back" block />
            {!failed && learned > 0 ? <Button label="Train your ear instead" variant="ghost" onPress={() => router.replace("/practice/tones")} testID="review-empty-tones" block /> : null}
          </>
        )
      }
    >
      <View style={styles.center}>
        <Nnenne size={120} ground={learned > 0 ? "ochre" : "paper"} mood={learned > 0 ? "glad" : "calm"} />
        <T variant="label" tone="accent" center>
          Today's review
        </T>
        <T variant="display" center accessibilityRole="header">
          {loading ? "Gathering your words…" : failed ? "Your words didn't open" : learned > 0 ? "All caught up" : "Nothing to review yet"}
        </T>
        {!loading ? (
          <T variant="body" tone="muted" center>
            {failed
              ? "Nothing you've learned is lost. Try again in a moment."
              : learned > 0
                ? overview?.nextDue
                  ? `Your ${learned} ${learned === 1 ? "word comes" : "words come"} back ${nextDueWords(overview.nextDue, new Date())}, just before you'd forget. Come back then.`
                  : "Every word you know is fresh."
                : "Finish a lesson and its words come back here at the right time, so they stay."}
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.sm },
});
