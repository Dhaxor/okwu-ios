// The listening check (heritage placement). A few everyday phrases, heard
// and matched to their meaning. No right/wrong marks along the way, and the
// result is never "failed": it is the Heritage track, or a start with the
// sounds, where heritage learners move fast.
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { ExerciseHeader, ItemText, OptionTile, PendingNotice, PlayButton } from "@/components/feature/lesson/parts";
import { X } from "@/components/glyphs/icons";
import { Button, IconButton, ProgressBar, Screen, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { needsDraftTag } from "@/lib/content";
import type { ItemId } from "@/lib/content/types";
import { createChecker, placeLearner, placementQuiz, type PlacementResult } from "@/lib/learning";
import { learnerSettings, useContent, useItemAudio, usePlay, useProfile } from "@/lib/state";

export default function PlacementScreen() {
  const router = useRouter();
  const { bundle } = useContent();
  const { profile, update } = useProfile();
  const play = usePlay();
  const audio = useItemAudio();
  const quiz = useMemo(() => (bundle ? placementQuiz(bundle, 20261023) : []), [bundle]);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ correct: boolean }[]>([]);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const ex = quiz[at];
  const spec = ex?.spec.type === "listen-choose" ? ex.spec : null;
  const prompt = spec && bundle ? bundle.items[spec.prompt] : undefined;
  const playable = audio.availability(prompt) === "playing";

  useEffect(() => {
    if (prompt && playable) audio.play(prompt);
  }, [at, prompt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (all: { correct: boolean }[]) => {
    if (!bundle) return;
    const r = placeLearner({ bundle, understandsSome: true, answers: all });
    play.place(r);
    update({ track: r.track, placement: { takenAt: new Date().toISOString(), correct: r.correct, total: r.total, reason: r.reason } });
    setResult(r);
  };

  const answer = (index: number | null) => {
    if (!ex || !bundle) return;
    audio.stop();
    const correct = index !== null && createChecker(bundle).check(ex, { type: "choice", index }, learnerSettings(profile)).correct;
    const all = [...answers, { correct }];
    setAnswers(all);
    setPicked(null);
    if (at + 1 >= quiz.length) finish(all);
    else setAt(at + 1);
  };

  const skipCheck = () => finish([]);

  if (result) {
    const heritage = result.kind === "heritage";
    const title = result.reason === "heritage-placed" ? "You understand more than you think." : heritage ? "Heritage track it is." : "Let's begin with the sounds.";
    const body =
      result.reason === "heritage-placed"
        ? `You recognised ${result.correct} of ${result.total}. The Heritage track builds on what you already hear, and spends its time on speaking.`
        : heritage
          ? "The Heritage track builds on what you already hear, and spends its time on speaking."
          : "Hearing Igbo tones takes practice for everyone. You'll move quickly through the first lessons, then on to speaking.";
    return (
      <Screen testID="placement-result" center footer={<Button label="Continue" onPress={() => router.push("/onboarding/dialect")} testID="placement-continue" block />}>
        <View style={styles.result}>
          <Nnenne size={144} ground="ochre" mood="glad" />
          <T variant="label" tone="accent" center>
            {heritage ? "Heritage track" : "New learner track"}
          </T>
          <T variant="display" center accessibilityRole="header">
            {title}
          </T>
          <T variant="body" tone="muted" center>
            {body}
          </T>
        </View>
      </Screen>
    );
  }

  if (!bundle || !ex || !spec || !prompt) {
    return (
      <Screen testID="placement" center footer={<Button label="Continue" onPress={skipCheck} testID="placement-skip-empty" block />}>
        <T variant="title" center>
          {bundle ? "The listening check isn't ready yet. You'll start on the Heritage track." : "Getting the check ready…"}
        </T>
      </Screen>
    );
  }

  const shown = ex.order.map((i) => spec.options[i] as ItemId);
  const draft = [spec.prompt, ...spec.options].some((id) => {
    const i = bundle.items[id];
    return !i || needsDraftTag(i);
  });
  return (
    <Screen
      testID="placement"
      footer={
        <>
          <Button label={at + 1 >= quiz.length ? "Finish" : "Next"} onPress={() => answer(picked)} disabled={picked === null} testID="placement-next" block />
          <Button label="I'm not sure" variant="ghost" onPress={() => answer(null)} testID="placement-unsure" block />
        </>
      }
    >
      <View style={styles.top}>
        <IconButton icon={X} accessibilityLabel="Skip the listening check" onPress={skipCheck} testID="placement-close" />
        <View style={styles.flex}>
          <ProgressBar value={at / quiz.length} steps={quiz.length} accessibilityLabel={`Phrase ${at + 1} of ${quiz.length}`} testID="placement-progress" />
        </View>
      </View>
      <ExerciseHeader label="Listening check" title="What does this mean?" draft={draft} testID="placement-header" />
      {playable ? (
        <PlayButton onPress={() => audio.play(prompt)} playing={audio.playing && audio.current === prompt.id} label="Tap to hear it again" testID="placement-play" />
      ) : (
        <View style={styles.read}>
          <ItemText item={prompt} marks="hidden" center testID="placement-prompt" />
          <PendingNotice testID="placement-pending" />
        </View>
      )}
      <View style={styles.list}>
        {shown.map((id, i) => {
          const item = bundle.items[id];
          if (!item) return null;
          return (
            <OptionTile key={`${at}-${id}`} compact state={picked === i ? "selected" : "idle"} onPress={() => setPicked(i)} accessibilityLabel={item.gloss.en} testID={`placement-option-${i}`}>
              <T variant="body" tone="primary" style={styles.flex}>
                {item.gloss.en}
              </T>
            </OptionTile>
          );
        })}
      </View>
      <T variant="caption" center>
        Nothing here is marked right or wrong. It only decides where you start.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  read: { alignItems: "center", gap: space.sm },
  list: { gap: space.sm },
  result: { alignItems: "center", gap: space.sm },
});
