// The first lesson, before any sign-up: the first lesson of the learner's
// track, kept short (ten exercises). It opens on the same intro as every
// lesson (the pattern note with examples to hear), then the same
// LessonPlayer plays it. Its end is the first-run peak: LessonCompleteMoment.
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { LessonIntro } from "@/components/feature/lesson/LessonIntro";
import { LessonPlayer } from "@/components/feature/lesson/LessonPlayer";
import { Button, Screen, T } from "@/components/ui";
import { space } from "@/constants/theme";
import type { LessonId } from "@/lib/content/types";
import { planSession, seedFrom, type Exercise } from "@/lib/learning";
import { buildPath, learnerSettings, useContent, useItemAudio, useLearning, useProfile } from "@/lib/state";

/** The first lesson is short: the learner hasn't signed up for anything yet. */
const FIRST_LESSON_EXERCISES = 10;

export default function FirstLesson() {
  const router = useRouter();
  const { bundle, status, retry } = useContent();
  const learning = useLearning();
  const { profile } = useProfile();
  const audio = useItemAudio();
  const planned = useRef<{ exercises: Exercise[]; lesson: LessonId; track: string; minutes: number; newWords: number; eyebrow: string } | null>(null);
  const [started, setStarted] = useState(false);

  if (!planned.current && bundle && learning.ready) {
    const path = buildPath(bundle, learning.progress, profile.track || (profile.heritage ? "heritage" : "new-learner"));
    const next = path.next;
    if (next && path.track) {
      const plan = planSession({
        bundle,
        progress: learning.progress,
        settings: learnerSettings(profile),
        scheduler: learning.scheduler,
        now: new Date(),
        seed: seedFrom(`first:${next.lesson.id}:${Date.now()}`),
        mode: "lesson",
        lesson: next.lesson.id,
        maxExercises: FIRST_LESSON_EXERCISES,
      });
      if (plan.exercises.length > 0) {
        planned.current = { exercises: plan.exercises, lesson: next.lesson.id, track: path.track, minutes: plan.estMinutes, newWords: plan.newItems.length, eyebrow: `Unit ${next.unit.number} · Lesson ${next.lesson.number}` };
      }
    }
  }

  const toAccount = () => router.push("/onboarding/account");
  const p = planned.current;
  const lesson = p && bundle ? bundle.lessons[p.lesson] : undefined;
  if (p && lesson && bundle && !started) {
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
          router.back();
        }}
        testID="lesson-intro"
      />
    );
  }
  if (p) {
    // The first-run peak (DESIGN.md §States): a tone lesson ends on hearing tones for the first time.
    const tones = p.exercises.some((e) => e.spec.type === "tone-pair");
    const peak = tones ? { title: "You heard your first tones.", detail: "One spelling, different meanings. Tone is how Igbo tells them apart, and you just heard it." } : { title: "Your first Igbo lesson.", detail: "You heard real voices and said your first words out loud." };
    return <LessonPlayer exercises={p.exercises} lesson={p.lesson} note={lesson?.note ?? null} track={p.track} source="lesson" peak={peak} onLeave={() => router.back()} onDone={toAccount} doneLabel="Save my progress" testID="lesson" />;
  }

  const loading = status === "loading" || (status === "ready" && !learning.ready);
  return (
    <Screen
      testID="first-lesson-missing"
      center
      footer={loading ? undefined : <Button label={status === "error" ? "Try again" : "Continue"} onPress={status === "error" ? retry : toAccount} testID="first-lesson-continue" block />}
    >
      <View style={styles.center}>
        <Nnenne size={112} ground="ochre" />
        <T variant="title" center>
          {loading ? "Getting your first lesson ready…" : status === "error" ? "Your lesson didn't open" : "Your first lessons are on their way"}
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md },
});
