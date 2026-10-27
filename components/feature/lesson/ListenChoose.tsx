// Listen and choose: hear an item, pick its meaning (or the Igbo you heard).
// Without a recording the Igbo is shown instead and the notice says the
// recording is coming; the question becomes "what does this mean?". A story
// question (`comprehension`, after the story is read) asks its own English
// question about the line it plays.
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { needsDraftTag } from "@/lib/content";
import type { Item, ItemId } from "@/lib/content/types";
import { ExerciseHeader, ItemText, OptionTile, PendingNotice, PlayButton, type TileState } from "./parts";
import { itemsShown, type ExerciseViewProps } from "./types";

export function ListenChooseView({ exercise, bundle, phase, outcome, marks, audio, onDraft, onMode, onSkip, testID }: ExerciseViewProps) {
  const spec = exercise.spec.type === "listen-choose" ? exercise.spec : null;
  const prompt = spec ? bundle.items[spec.prompt] : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const playable = audio.availability(prompt) === "playing";
  const byGloss = !spec || spec.answer === "gloss" || !playable;
  const about = spec?.comprehension ?? null;
  const draft = useMemo(() => itemsShown(exercise).some((id) => bundle.items[id] && needsDraftTag(bundle.items[id] as Item)), [exercise, bundle]);

  useEffect(() => {
    onMode({ kind: "check" });
    if (playable) audio.play(prompt);
    // Once per exercise: the prompt plays as it appears.
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec || !prompt) return null;
  const shown = exercise.order.map((i) => spec.options[i] as ItemId);
  const rightAt = shown.indexOf(spec.prompt);
  const checked = phase === "feedback";
  const stateOf = (i: number): TileState => {
    if (!checked) return picked === i ? "selected" : "idle";
    if (outcome?.correct) return picked === i ? "correct" : "idle";
    if (i === rightAt) return "missed";
    return picked === i ? "wrong" : "idle";
  };
  const pick = (i: number) => {
    if (checked) return;
    setPicked(i);
    onDraft({ type: "choice", index: i }, shown[i] ?? null);
  };

  return (
    <View style={styles.wrap}>
      <ExerciseHeader
        label={about ? "About the story" : "Listen and choose"}
        title={about ? about.question : byGloss ? "What does this mean?" : "Which one did you hear?"}
        draft={draft}
        testID={`${testID}-header`}
      />
      {playable ? (
        <PlayButton
          onPress={() => audio.play(prompt)}
          playing={audio.playing && audio.current === prompt.id}
          label={about ? "Hear the line, then choose what it says" : undefined}
          testID={`${testID}-play`}
        />
      ) : (
        <View style={styles.read}>
          <ItemText item={prompt} marks={marks} center testID={`${testID}-prompt`} />
          <PendingNotice testID={`${testID}-pending`} />
        </View>
      )}
      <View style={byGloss ? styles.list : styles.grid}>
        {shown.map((id, i) => {
          const item = bundle.items[id];
          if (!item) return null;
          return byGloss ? (
            <OptionTile key={id} compact state={stateOf(i)} onPress={() => pick(i)} disabled={checked} accessibilityLabel={item.gloss.en} testID={`${testID}-option-${i}`}>
              <T variant="body" tone="primary" style={styles.flex}>
                {item.gloss.en}
              </T>
            </OptionTile>
          ) : (
            <View key={id} style={styles.cell}>
              <OptionTile state={stateOf(i)} onPress={() => pick(i)} disabled={checked} accessibilityLabel={item.spelling} igbo testID={`${testID}-option-${i}`}>
                <ItemText item={item} marks={marks === "hidden" ? "hidden" : "shown"} variant="title" center testID={`${testID}-option-${i}-text`} />
              </OptionTile>
            </View>
          );
        })}
      </View>
      {playable && !checked ? <Button label="Can't listen now" variant="ghost" size="sm" onPress={onSkip} testID={`${testID}-skip`} style={styles.skip} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  read: { alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  list: { gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  cell: { width: "48%", flexGrow: 1 },
  flex: { flex: 1 },
  skip: { alignSelf: "center" },
});
