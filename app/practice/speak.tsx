// "Say it": a short shadowing set. Hear a native voice, see the expected
// pitch line, say it aloud (on iPhone, record yourself and play the two
// back to back), then decide: "matched" or "not yet". Never scored; "not
// yet" only brings the word back sooner. One session a day is free (Okwu
// Plus: "speaking-trainer"); once it is used, the start button opens the
// paywall softly, never mid-session.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LessonPlayer } from "@/components/feature/lesson/LessonPlayer";
import { SpokenEnd } from "@/components/feature/practice";
import { Ear, Mic, RotateCcw, Sparkles, type IconComponent } from "@/components/glyphs/icons";
import { Button, Card, Chip, Screen, ScreenHeader, Section, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { toneMarked } from "@/lib/content";
import { seedFrom, type Exercise } from "@/lib/learning";
import { resolveTrack, useContent, useLearning, useProfile, useVoiceRecorder } from "@/lib/state";
import { speakingSet, spokenSummary, type TrainerAnswer } from "@/lib/state/practice";
import { allowanceNote, useTrainerAllowance } from "@/lib/tools";

function Step({ icon: Icon, title, detail, testID }: { icon: IconComponent; title: string; detail: string; testID: string }) {
  return (
    <View style={styles.step} testID={testID}>
      <View style={styles.stepIcon}>
        <Icon size={size.iconSm} color={colors.success} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <T variant="body" strong tone="primary">
          {title}
        </T>
        <T variant="caption">{detail}</T>
      </View>
    </View>
  );
}

export default function SpeakRoute() {
  const router = useRouter();
  const { bundle } = useContent();
  const learning = useLearning();
  const { profile } = useProfile();
  const recorder = useVoiceRecorder();
  const seed = useRef(seedFrom(`speak:${Date.now()}`)).current;
  const [session, setSession] = useState<Exercise[] | null>(null);
  const answers = useRef<TrainerAnswer[]>([]);
  const allowance = useTrainerAllowance("speaking-trainer");
  const usedUp = allowance.ready && allowance.gate === "plus";

  const close = () => (router.canGoBack() ? router.back() : router.replace("/practice"));
  const set: Exercise[] = useMemo(() => (bundle && learning.ready ? speakingSet(bundle, learning.progress, learning.scheduler, new Date(), seed) : []), [bundle, learning.ready, learning.progress, learning.scheduler, seed]);
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
        source="review"
        reportSource="speaking"
        onAnswered={onAnswered}
        endContent={(s) => {
          const said = spokenSummary(answers.current);
          const again = said.notYetItems.map((id) => bundle.items[id]).filter((i): i is NonNullable<typeof i> => !!i).map((i) => toneMarked(i) ?? i.spelling);
          return <SpokenEnd said={said.said} notYet={again} summary={s} testID="speak-end-summary" />;
        }}
        onLeave={close}
        onDone={close}
        doneLabel="Back to Practice"
        testID="speak-session"
      />
    );
  }

  const words = set.map((e) => (e.spec.type === "say-it" ? bundle?.items[e.spec.target] : undefined)).filter((i): i is NonNullable<typeof i> => !!i);
  return (
    <Screen
      testID="speak"
      footer={
        set.length > 0 ? (
          <>
            <Button
              label={usedUp ? "Practise more with Plus" : `Start: ${set.length} ${set.length === 1 ? "word" : "words"}`}
              icon={usedUp ? Sparkles : Mic}
              onPress={() => {
                // The free daily session is used: Plus is offered here, before a session, never during one.
                if (!allowance.begin()) return router.push({ pathname: "/paywall", params: { from: "trainer" } });
                answers.current = [];
                setSession(set);
              }}
              testID="speak-start"
              block
            />
            {usedUp ? <Button label="Back to Practice" variant="ghost" onPress={close} testID="speak-back-footer" block /> : null}
          </>
        ) : (
          <Button label="Back to Practice" onPress={close} testID="speak-back-footer" block />
        )
      }
    >
      <ScreenHeader eyebrow="Practice" title="Say it" subtitle="Speak along with a native voice, privately. Nothing you say is scored." onBack={close} testID="speak-header" />

      {usedUp ? (
        <Card variant="flat" padding="md" testID="speak-allowance">
          <T variant="body" strong tone="primary">
            {allowanceNote("speaking-trainer").title}
          </T>
          <T variant="caption">{allowanceNote("speaking-trainer").body}</T>
        </Card>
      ) : null}

      <Card padding="md" testID="speak-how">
        <View style={styles.steps}>
          <Step icon={Ear} title="Listen" detail="Hear a native speaker, at natural speed or slower." testID="speak-step-listen" />
          <Step
            icon={Mic}
            title="Say it with the pitch line"
            detail={recorder.supported ? "The line shows where the voice goes high and low. Record yourself and play the two back to back." : "The line shows where the voice goes high and low. Say it aloud along with the voice (recording yourself works in the iPhone app)."}
            testID="speak-step-say"
          />
          <Step icon={RotateCcw} title="You decide" detail={`Tap "Matched" or "Not yet". "Not yet" only brings the word back sooner.`} testID="speak-step-decide" />
        </View>
      </Card>

      {words.length > 0 ? (
        <Section title="In this set" testID="speak-words">
          <View style={styles.chips}>
            {words.map((w, i) => (
              <Chip key={w.id} label={toneMarked(w) ?? w.spelling} igbo testID={`speak-word-${i}`} />
            ))}
          </View>
          <T variant="caption">Words you've met and words that are due come first.</T>
        </Section>
      ) : (
        <Card variant="sunk" testID="speak-empty">
          <T variant="body" tone="muted">
            The words to shadow arrive with their tones and recordings. Finish a lesson, and come back.
          </T>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  steps: { gap: space.md },
  step: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  stepIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.success12, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
