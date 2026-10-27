// The tone trainer: a short high-variability set (HVPT). First the sets it
// draws from, each word with its pitch line, then 24 listening trials
// (minimal pairs interleaved, every recorded voice), then an honest summary:
// heard right the first time, per tone pattern. Never a pronunciation score.
// One session a day is free (Okwu Plus: "tone-trainer"); once it is used,
// the start button opens the paywall softly, never mid-session.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LessonPlayer } from "@/components/feature/lesson/LessonPlayer";
import { ToneSetCard, TrainerResultsView } from "@/components/feature/practice";
import { Ear, Sparkles } from "@/components/glyphs/icons";
import { Button, Card, Screen, ScreenHeader, Section, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { allowsUnreviewedAudio, hasPlayableAudio } from "@/lib/content";
import { seedFrom, type Exercise } from "@/lib/learning";
import { resolveTrack, useContent, useLearning, useProfile } from "@/lib/state";
import { toneSets, toneTrainerSession, trainerResults, TRAINER_TRIALS, type TrainerAnswer } from "@/lib/state/practice";
import { allowanceNote, useTrainerAllowance } from "@/lib/tools";

export default function ToneTrainerRoute() {
  const router = useRouter();
  const { bundle } = useContent();
  const learning = useLearning();
  const { profile } = useProfile();
  const [session, setSession] = useState<Exercise[] | null>(null);
  const answers = useRef<TrainerAnswer[]>([]);
  const allowance = useTrainerAllowance("tone-trainer");
  const usedUp = allowance.ready && allowance.gate === "plus";

  const close = () => (router.canGoBack() ? router.back() : router.replace("/practice"));
  const sets = useMemo(() => (bundle ? toneSets(bundle, learning.progress) : []), [bundle, learning.progress]);
  const recorded = useMemo(() => {
    if (!bundle) return 0;
    const allow = allowsUnreviewedAudio(bundle);
    return sets.flatMap((s) => s.members).filter((m) => bundle.items[m.id] && hasPlayableAudio(bundle.items[m.id]!, allow)).length;
  }, [bundle, sets]);
  const words = sets.reduce((n, s) => n + s.members.length, 0);
  const voices = Math.max(0, ...sets.map((s) => s.voices));

  const start = () => {
    if (!bundle) return;
    // The free daily session is used: Plus is offered here, before a session, never during one.
    if (!allowance.begin()) return router.push({ pathname: "/paywall", params: { from: "trainer" } });
    answers.current = [];
    setSession(toneTrainerSession(bundle, learning.progress, seedFrom(`tones:${Date.now()}`)));
  };
  const onAnswered = useCallback((a: TrainerAnswer) => {
    answers.current.push(a);
  }, []);

  if (bundle && session && session.length > 0) {
    const track = resolveTrack(bundle, profile.track || (profile.heritage ? "heritage" : "new-learner")) ?? "";
    return (
      <LessonPlayer
        exercises={session}
        lesson={null}
        track={track}
        source="tone-trainer"
        onAnswered={onAnswered}
        endContent={() => <TrainerResultsView results={trainerResults(bundle, answers.current)} testID="tones-results" />}
        onLeave={close}
        onDone={close}
        doneLabel="Back to Practice"
        testID="tones-session"
      />
    );
  }

  return (
    <Screen
      testID="tones"
      footer={
        sets.length === 0 ? (
          <Button label="Back to Practice" onPress={close} testID="tones-back-footer" block />
        ) : usedUp ? (
          <>
            <Button label="Practise more with Plus" icon={Sparkles} onPress={start} testID="tones-start" block />
            <Button label="Back to Practice" variant="ghost" onPress={close} testID="tones-back-footer" block />
          </>
        ) : (
          <Button label={`Start ${TRAINER_TRIALS} trials`} icon={Ear} onPress={start} testID="tones-start" block />
        )
      }
    >
      <ScreenHeader eyebrow="Practice" title="Tone trainer" subtitle="In Igbo, tone changes the word. Hear words that share their letters and differ only in tone." onBack={close} testID="tones-header" />

      {usedUp ? (
        <Card variant="flat" padding="md" testID="tones-allowance">
          <T variant="body" strong tone="primary">
            {allowanceNote("tone-trainer").title}
          </T>
          <T variant="caption">{allowanceNote("tone-trainer").body}</T>
        </Card>
      ) : null}

      <Card variant="sunk" padding="md" testID="tones-how">
        <View style={styles.how}>
          <T variant="body" tone="primary">
            {`${TRAINER_TRIALS} short trials, about 5 minutes. Hear a word, then pick it by its tone marks and pitch line.`}
          </T>
          <T variant="caption">
            {words === 0
              ? "The tone sets arrive with the next lessons."
              : recorded === words
                ? `Every word here has a recording${voices > 1 ? `, in ${voices} voices` : ""}. Sets are mixed so similar words never come in a row.`
                : `${recorded} of ${words} words have a recording so far; the others show their tones to read until the recording arrives.`}
          </T>
        </View>
      </Card>

      {sets.length > 0 ? (
        <Section title="The tone sets" testID="tones-sets">
          <View style={styles.sets}>
            {sets.map((s, i) => (
              <ToneSetCard key={s.spelling} set={s} testID={`tones-set-${i}`} />
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  how: { gap: space.xs },
  sets: { gap: space.md },
});
