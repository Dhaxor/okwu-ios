// A lesson, full screen over the tabs. The session is planned once when the
// screen opens (every new item introduced, a few due reviews mixed in). The
// lesson opens on its intro (the pattern note, the story, the objectives and
// the planned minutes), then the LessonPlayer plays it; the pattern note
// re-opens from the player's top bar. `/lesson/showcase` is a
// development-only lesson with one exercise of every type.
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { LessonIntro } from "@/components/feature/lesson/LessonIntro";
import { LessonPlayer } from "@/components/feature/lesson/LessonPlayer";
import { AddToDeckButton } from "@/components/feature/tools";
import { Button, Screen, T } from "@/components/ui";
import { space } from "@/constants/theme";
import type { LessonId } from "@/lib/content/types";
import { planSession, seedFrom, trackUnits, type Exercise } from "@/lib/learning";
import { SHOWCASE_ID, learnerSettings, resolveTrack, showcaseExercises, useContent, useItemAudio, useLearning, usePlus, useProfile } from "@/lib/state";

interface Planned {
  exercises: Exercise[];
  lesson: LessonId | null;
  track: string;
  /** The intro's facts: the planned minutes, the items met for the first time, where the lesson sits. */
  minutes: number;
  newWords: number;
  eyebrow: string;
}

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status, bundle, retry } = useContent();
  const learning = useLearning();
  const { profile } = useProfile();
  const audio = useItemAudio();
  const plus = usePlus();
  const planned = useRef<Planned | null>(null);
  const [started, setStarted] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  // Plan once, when the bundle and the saved progress are both in.
  if (!planned.current && bundle && learning.ready) {
    const track = resolveTrack(bundle, profile.track || (profile.heritage ? "heritage" : "new-learner")) ?? "";
    if (id === SHOWCASE_ID && __DEV__) {
      planned.current = { exercises: showcaseExercises(bundle, seedFrom(String(Date.now()))), lesson: null, track, minutes: 0, newWords: 0, eyebrow: "" };
    } else if (id && bundle.lessons[id]) {
      const plan = planSession({
        bundle,
        progress: learning.progress,
        settings: learnerSettings(profile),
        scheduler: learning.scheduler,
        now: new Date(),
        seed: seedFrom(`${id}:${Date.now()}`),
        mode: "lesson",
        lesson: id as LessonId,
      });
      const lesson = bundle.lessons[id];
      const unitAt = track ? trackUnits(bundle, track).indexOf(lesson?.unit as never) : -1;
      const lessonAt = lesson ? (bundle.units[lesson.unit]?.lessons.indexOf(lesson.id) ?? -1) : -1;
      const eyebrow = unitAt >= 0 && lessonAt >= 0 ? `Unit ${unitAt + 1} · Lesson ${lessonAt + 1}` : "Lesson";
      planned.current = { exercises: plan.exercises, lesson: id as LessonId, track, minutes: plan.estMinutes, newWords: plan.newItems.length, eyebrow };
    }
  }

  const p = planned.current;
  const lesson = p?.lesson && bundle ? bundle.lessons[p.lesson] : undefined;
  // The path sends a Plus unit to the paywall; a link straight to one of its lessons gets the same answer.
  const unitFree = lesson && bundle ? (bundle.units[lesson.unit]?.free ?? false) : true;
  if (lesson && !unitFree && !plus.can("full-path", { unitFree })) {
    return (
      <Screen
        testID="lesson-plus"
        center
        footer={
          plus.ready ? (
            <View style={styles.actions}>
              <Button label="See Okwu Plus" onPress={() => router.replace({ pathname: "/paywall", params: { from: "path" } })} testID="lesson-plus-open" block />
              <Button label="Back to Learn" variant="ghost" onPress={close} testID="lesson-plus-back" block />
            </View>
          ) : undefined
        }
      >
        <View style={styles.center}>
          <Nnenne size={112} ground="ochre" />
          <T variant="title" center accessibilityRole="header">
            {plus.ready ? "This lesson is part of Okwu Plus" : "Opening your lesson…"}
          </T>
          {plus.ready ? (
            <T variant="body" tone="muted" center>
              The first units of each track are free forever. Plus opens the whole path.
            </T>
          ) : null}
        </View>
      </Screen>
    );
  }
  if (p && p.exercises.length > 0 && lesson && bundle && !started) {
    return (
      <LessonIntro
        bundle={bundle}
        lesson={lesson}
        eyebrow={p.eyebrow}
        minutes={p.minutes}
        newWords={p.newWords}
        marks={profile.toneMarks}
        audio={audio}
        onStart={() => {
          audio.stop();
          setStarted(true);
        }}
        onClose={() => {
          audio.stop();
          close();
        }}
        testID="lesson-intro"
      />
    );
  }
  if (p && p.exercises.length > 0) {
    return (
      <LessonPlayer
        exercises={p.exercises}
        lesson={p.lesson}
        note={lesson?.note ?? null}
        track={p.track}
        source="lesson"
        onLeave={close}
        onDone={close}
        endExtra={(s) => {
          // The lesson's words, ready for the learner's own flashcard decks.
          const refs = s.items.filter((id) => bundle?.items[id]);
          return refs.length > 0 ? (
            <View style={styles.save}>
              <AddToDeckButton target={{ refs, shown: `${refs.length} ${refs.length === 1 ? "word" : "words"}` }} size="md" center testID="lesson-save-words" />
            </View>
          ) : null;
        }}
        testID="lesson"
      />
    );
  }

  const loading = status === "loading" || (status === "ready" && !learning.ready);
  return (
    <Screen testID="lesson-missing" center footer={loading ? undefined : <Button label={status === "error" ? "Try again" : "Back to Learn"} onPress={status === "error" ? retry : close} testID="lesson-missing-back" block />}>
      <View style={styles.center}>
        <Nnenne size={112} ground="paper" />
        <T variant="title" center accessibilityRole="header">
          {loading ? "Opening your lesson…" : status === "error" ? "We couldn't open your lessons" : "This lesson isn't here yet"}
        </T>
        {!loading ? (
          <T variant="body" tone="muted" center>
            {status === "error" ? "Nothing you've learned is lost. Try again in a moment." : "It may arrive with the next update. Your path has everything that's ready."}
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md },
  actions: { gap: space.xs },
  save: { alignItems: "center" },
});
