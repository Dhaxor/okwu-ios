// Type it: write the Igbo for a meaning (or for what you hear) with the
// ị ọ ụ ṅ key strip. Tone marks are never required here; a missing dot is
// "almost", and a regional form the learner knows is accepted.
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IgboKeyStrip, TextField, useIgboInput } from "@/components/ui";
import { space } from "@/constants/theme";
import { needsDraftTag } from "@/lib/content";
import { ExerciseHeader, PlayButton } from "./parts";
import type { ExerciseViewProps } from "./types";

export function TypeItView({ exercise, bundle, phase, audio, onDraft, onMode, onSkip, testID }: ExerciseViewProps) {
  const spec = exercise.spec.type === "type-it" ? exercise.spec : null;
  const target = spec ? bundle.items[spec.target] : undefined;
  const igbo = useIgboInput();
  const byEar = spec?.prompt === "audio" && audio.availability(target) === "playing";
  const checked = phase === "feedback";
  const last = useRef("");

  useEffect(() => {
    onMode({ kind: "check" });
    if (byEar) audio.play(target);
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const text = igbo.value.trim();
    if (text === last.current) return;
    last.current = text;
    onDraft(text ? { type: "text", text } : null);
  }, [igbo.value, onDraft]);

  if (!spec || !target) return null;
  return (
    <View style={styles.wrap}>
      <ExerciseHeader label="Type it" title={byEar ? "Type what you hear" : `Write “${target.gloss.en}” in Igbo`} draft={needsDraftTag(target)} testID={`${testID}-header`} />
      {byEar ? <PlayButton onPress={() => audio.play(target)} playing={audio.playing && audio.current === target.id} size={72} testID={`${testID}-play`} /> : null}
      <View style={styles.field}>
        <TextField
          igbo
          {...igbo.field}
          label="Your answer"
          hint="Tone marks are optional. Mind the dots: ị ọ ụ ṅ."
          editable={!checked}
          returnKeyType="done"
          testID={`${testID}-input`}
        />
        {!checked ? <IgboKeyStrip {...igbo.strip} tones={false} testID={`${testID}-keys`} /> : null}
      </View>
      {byEar && !checked ? <Button label="Can't listen now" variant="ghost" size="sm" onPress={onSkip} testID={`${testID}-skip`} style={styles.skip} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  field: { gap: space.sm },
  skip: { alignSelf: "center" },
});
