// Build the sentence: tap word tiles (taken from the approved sentence, plus
// a couple of approved distractors) into order. Tap a placed tile to take
// it back. After checking, the sentence plays.
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Press, T } from "@/components/ui";
import { colors, radius, shadow, space } from "@/constants/theme";
import { needsDraftTag } from "@/lib/content";
import { ExerciseHeader } from "./parts";
import type { ExerciseViewProps } from "./types";

export function BuildSentenceView({ exercise, bundle, phase, outcome, audio, onDraft, onMode, testID }: ExerciseViewProps) {
  const spec = exercise.spec.type === "build-sentence" ? exercise.spec : null;
  const target = spec ? bundle.items[spec.target] : undefined;
  const shown = useMemo(() => (spec ? exercise.order.map((i) => [...spec.tiles, ...spec.distractorTiles][i] ?? "") : []), [exercise, spec]);
  const [placed, setPlaced] = useState<number[]>([]);
  const checked = phase === "feedback";

  useEffect(() => {
    onMode({ kind: "check" });
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (checked) audio.play(target);
  }, [checked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec || !target) return null;

  const update = (next: number[]) => {
    setPlaced(next);
    onDraft(next.length > 0 ? { type: "tiles", order: next } : null);
  };
  const place = (i: number) => !checked && !placed.includes(i) && update([...placed, i]);
  const remove = (i: number) => !checked && update(placed.filter((x) => x !== i));
  const railLook = checked ? (outcome?.correct ? styles.railRight : styles.railClose) : null;

  return (
    <View style={styles.wrap}>
      <ExerciseHeader label="Build the sentence" title={`Build “${target.gloss.en}” in Igbo`} draft={needsDraftTag(target)} testID={`${testID}-header`} />
      <View style={[styles.rail, railLook]} testID={`${testID}-answer`} accessibilityLabel={placed.length ? `Your sentence: ${placed.map((i) => shown[i]).join(" ")}` : "Your sentence is empty"}>
        {placed.length === 0 ? (
          <T variant="body" tone="faint">
            Tap the words in order
          </T>
        ) : (
          placed.map((i) => (
            <Press key={i} testID={`${testID}-placed-${i}`} onPress={() => remove(i)} disabled={checked} haptics="select" accessibilityLabel={`Remove ${shown[i]}`} style={[styles.tile, styles.tilePlaced]}>
              <T variant="title" igbo tone="primary">
                {shown[i]}
              </T>
            </Press>
          ))
        )}
      </View>
      <View style={styles.bank}>
        {shown.map((word, i) => {
          const used = placed.includes(i);
          return (
            <Press
              key={i}
              testID={`${testID}-tile-${i}`}
              onPress={() => place(i)}
              disabled={used || checked}
              haptics="select"
              accessibilityLabel={used ? `${word}, placed` : word}
              style={[styles.tile, used ? styles.tileUsed : styles.tileIdle]}
            >
              <T variant="title" igbo tone={used ? "faint" : "primary"} style={used ? styles.hidden : undefined}>
                {word}
              </T>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  rail: {
    minHeight: 120,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    alignItems: "center",
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceSunk,
  },
  railRight: { borderStyle: "solid", borderColor: colors.success, backgroundColor: colors.success12 },
  railClose: { borderStyle: "solid", borderColor: colors.reward, backgroundColor: colors.reward12 },
  bank: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, justifyContent: "center" },
  tile: { minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tileIdle: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong, boxShadow: shadow.key },
  tilePlaced: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong, boxShadow: shadow.key },
  tileUsed: { backgroundColor: colors.surfaceSunk, borderColor: colors.surfaceSunk },
  hidden: { opacity: 0 },
});
