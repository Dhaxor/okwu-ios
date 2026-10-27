// Dialogue role-play: the conversation unfolds a line at a time. The other
// speaker's lines play as they appear; on the learner's lines they hear the
// model and say it themselves. At the end they say how it went.
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Volume2 } from "@/components/glyphs/icons";
import { IconButton, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { needsDraftTag, speakerName } from "@/lib/content";
import type { Item } from "@/lib/content/types";
import { ExerciseHeader, ItemText } from "./parts";
import type { ExerciseViewProps } from "./types";

export function DialogueView({ exercise, bundle, phase, marks, audio, onMode, testID }: ExerciseViewProps) {
  const spec = exercise.spec.type === "dialogue" ? exercise.spec : null;
  const lines = spec?.lines ?? [];
  const [shown, setShown] = useState(1);
  const checked = phase === "feedback";
  const me = spec ? speakerName(bundle, spec.learnerSpeaker) : "";
  const meIsName = !!spec && !!bundle.items[spec.learnerSpeaker];

  const reveal = (n: number) => {
    setShown(n);
    const line = lines[n - 1];
    const item = line ? bundle.items[line.item] : undefined;
    if (line && item && line.speaker !== spec?.learnerSpeaker) audio.play(item, { key: `line-${n - 1}` });
  };

  useEffect(() => {
    reveal(1);
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!spec) return;
    if (shown >= lines.length) onMode({ kind: "self" });
    else {
      const mine = lines[shown - 1]?.speaker === spec.learnerSpeaker;
      onMode({ kind: "next", label: mine ? "I said it" : "Next line", onPress: () => reveal(shown + 1) });
    }
  }, [shown, exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec) return null;
  const draft = lines.some((l) => {
    const i = bundle.items[l.item];
    return !i || needsDraftTag(i);
  });

  return (
    <View style={styles.wrap}>
      <ExerciseHeader label="Role-play" title="Take your part in the conversation" draft={draft} testID={`${testID}-header`} />
      <T variant="body" tone="muted">
        You are{" "}
        <T variant="body" igbo={meIsName} strong tone="primary">
          {me}
        </T>
        . Say your lines out loud.
      </T>
      <View style={styles.thread}>
        {lines.slice(0, shown).map((line, i) => {
          const item = bundle.items[line.item] as Item | undefined;
          if (!item) return null;
          const mine = line.speaker === spec.learnerSpeaker;
          const who = speakerName(bundle, line.speaker);
          const key = `line-${i}`;
          return (
            <View key={i} style={[styles.row, mine && styles.rowMine]} testID={`${testID}-line-${i}`}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleThem]}>
                <T variant="caption" strong tone={mine ? "accent" : "muted"}>
                  <T variant="caption" strong igbo={!!bundle.items[line.speaker]} tone={mine ? "accent" : "muted"}>
                    {who}
                  </T>
                  {mine ? " · your line" : ""}
                </T>
                <ItemText item={item} marks={marks} variant="title" testID={`${testID}-line-${i}-text`} />
                <T variant="caption">{item.gloss.en}</T>
              </View>
              <IconButton
                icon={Volume2}
                variant={audio.playing && audio.current === key ? "ink" : "tinted"}
                accessibilityLabel={`Play: ${item.gloss.en}`}
                onPress={() => audio.play(item, { key })}
                testID={`${testID}-line-${i}-play`}
              />
            </View>
          );
        })}
      </View>
      {shown >= lines.length && !checked ? (
        <T variant="body" tone="secondary" center testID={`${testID}-ask`}>
          How did your lines go? Only you decide.
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  thread: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
  rowMine: { flexDirection: "row-reverse" },
  bubble: { flexShrink: 1, maxWidth: "82%", paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.lg, gap: space.xxs },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderTopLeftRadius: radius.sm },
  bubbleMine: { backgroundColor: colors.accent06, borderWidth: 1, borderColor: colors.accent12, borderTopRightRadius: radius.sm },
});
