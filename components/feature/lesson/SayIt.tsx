// Say it: shadowing. Hear a native speaker (natural or slow), see the
// expected pitch line from the tone layer, record yourself and play the two
// back to back, then say how it went: "Matched" or "Not yet". Never a score:
// the pitch line is the expected contour from the content, not a measurement.
// Recording is on the device only and nothing is uploaded.
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Mic, Play, RotateCcw } from "@/components/glyphs/icons";
import { Button, Card, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { needsDraftTag } from "@/lib/content";
import { ExerciseHeader, ItemPitch, ItemText, PendingNotice, PlayButton } from "./parts";
import type { ExerciseViewProps } from "./types";

export function SayItView({ exercise, bundle, phase, marks, audio, recorder, onMode, testID }: ExerciseViewProps) {
  const spec = exercise.spec.type === "say-it" ? exercise.spec : null;
  const target = spec ? bundle.items[spec.target] : undefined;
  const playable = audio.availability(target) === "playing";
  const checked = phase === "feedback";
  const recording = recorder.state === "recording";

  useEffect(() => {
    onMode({ kind: "self" });
    recorder.reset();
    if (playable) audio.play(target);
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec || !target) return null;

  const record = async () => {
    audio.stop();
    if (recording) await recorder.stop();
    else await recorder.start();
  };
  const mineKey = `${target.id}#mine`;

  return (
    <View style={styles.wrap}>
      <ExerciseHeader label="Say it" title="Listen, then say it out loud" draft={needsDraftTag(target)} testID={`${testID}-header`} />
      <Card testID={`${testID}-card`}>
        <View style={styles.word}>
          <ItemText item={target} marks={marks} center testID={`${testID}-text`} />
          <T variant="body" tone="muted" center>
            {target.gloss.en}
          </T>
        </View>
        <ItemPitch item={target} height={64} testID={`${testID}-pitch`} />
      </Card>

      <View style={styles.controls}>
        {playable ? (
          <View style={styles.native}>
            <PlayButton onPress={() => audio.play(target, { speed: "natural" })} playing={audio.playing && audio.current === target.id} label="Native voice" size={72} testID={`${testID}-play`} />
            <Button label="Slower" variant="secondary" size="sm" onPress={() => audio.play(target, { speed: "slow", key: target.id })} disabled={checked} testID={`${testID}-slow`} />
          </View>
        ) : (
          <PendingNotice testID={`${testID}-pending`} />
        )}
      </View>

      {recorder.supported ? (
        <View style={styles.mine} testID={`${testID}-recorder`}>
          <Button
            label={recording ? "Stop" : recorder.state === "recorded" ? "Record again" : "Record yourself"}
            icon={recording ? undefined : recorder.state === "recorded" ? RotateCcw : Mic}
            variant={recording ? "danger" : "secondary"}
            size="md"
            onPress={() => void record()}
            disabled={checked}
            testID={`${testID}-record`}
          />
          {recorder.state === "recorded" && recorder.uri ? (
            <Button label="Play mine" icon={Play} variant="secondary" size="md" onPress={() => recorder.uri && audio.playUri(recorder.uri, mineKey)} testID={`${testID}-mine`} />
          ) : null}
          <T variant="caption" center style={styles.note}>
            {recorder.state === "denied"
              ? "Okwu needs the microphone to let you hear yourself. You can allow it in Settings, or just say it aloud."
              : recorder.state === "error"
                ? "That recording didn't work. Try again, or just say it aloud."
                : "Your recording stays on this phone. Compare it with the native voice."}
          </T>
        </View>
      ) : (
        <T variant="caption" center testID={`${testID}-web-note`}>
          Recording yourself works in the iPhone app. Here, say it aloud along with the voice.
        </T>
      )}

      {!checked ? (
        <T variant="body" tone="secondary" center testID={`${testID}-ask`}>
          How did it go? Only you decide, and nothing is scored.
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  word: { alignItems: "center", gap: space.xxs, marginBottom: space.sm },
  controls: { alignItems: "center" },
  native: { alignItems: "center", gap: space.sm },
  mine: { alignItems: "center", gap: space.sm },
  note: { maxWidth: 320 },
});
