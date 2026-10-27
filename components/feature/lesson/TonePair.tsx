// Tone pairs: one minimal set (àkwà, ákwà, àkwá, ákwá), heard in many
// voices (high-variability practice), each answer drawn with its pitch
// line. The only place tone is right or wrong. Without a recording, the
// set is read instead: "Which one means egg?". After the answer, the same
// word as speakers from other areas say it (dialect variety, never tested).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Volume2 } from "@/components/glyphs/icons";
import { Button, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { allowsUnreviewedAudio, needsDraftTag, toneMarked } from "@/lib/content";
import type { Item, ItemId } from "@/lib/content/types";
import { useDialectLabels, voiceForTrial } from "@/lib/state";
import { regionalRecordings } from "@/lib/state/practice";
import { ExerciseHeader, ItemPitch, OptionTile, PendingNotice, PlayButton, type TileState } from "./parts";
import { itemsShown, type ExerciseViewProps } from "./types";

export function TonePairView({ exercise, bundle, phase, outcome, audio, onDraft, onMode, onSkip, testID }: ExerciseViewProps) {
  const spec = exercise.spec.type === "tone-pair" ? exercise.spec : null;
  const target = spec ? bundle.items[spec.target] : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const trial = useRef(0);
  const voices = spec?.voices ?? [];
  const playable = audio.availability(target) === "playing";
  const draft = useMemo(() => itemsShown(exercise).some((id) => bundle.items[id] && needsDraftTag(bundle.items[id] as Item)), [exercise, bundle]);
  const labels = useDialectLabels();
  const elsewhere = useMemo(
    () => (target ? regionalRecordings(target, labels, allowsUnreviewedAudio(bundle)).filter((r) => audio.availability(target, { dialect: r.dialect }) === "playing") : []),
    [target, labels, bundle, audio]
  );

  const hear = (another = false) => {
    if (another) trial.current += 1;
    const voice = voiceForTrial(voices, trial.current);
    audio.play(target, voice ? { voice } : {});
  };

  useEffect(() => {
    onMode({ kind: "check" });
    if (playable) hear();
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec || !target) return null;
  const shown = exercise.order.map((i) => spec.set[i] as ItemId);
  const rightAt = shown.indexOf(spec.target);
  const checked = phase === "feedback";
  const stateOf = (i: number): TileState => {
    if (!checked) return picked === i ? "selected" : "idle";
    if (i === rightAt) return outcome?.correct ? "correct" : "missed";
    return picked === i ? "wrong" : "idle";
  };
  const pick = (i: number) => {
    if (checked) return;
    setPicked(i);
    onDraft({ type: "choice", index: i }, shown[i] ?? null);
  };

  return (
    <View style={styles.wrap}>
      <ExerciseHeader label="Tone pairs" title={playable ? "Which one did you hear?" : `Which one means “${target.gloss.en}”?`} draft={draft} testID={`${testID}-header`} />
      {playable ? (
        <View style={styles.listen}>
          <PlayButton onPress={() => hear()} playing={audio.playing && audio.current === target.id} label="Same spelling, different tones" testID={`${testID}-play`} />
          {voices.length > 1 && !checked ? <Button label="Hear another voice" variant="secondary" size="sm" onPress={() => hear(true)} testID={`${testID}-voice`} /> : null}
        </View>
      ) : (
        <View style={styles.listen}>
          <PendingNotice testID={`${testID}-pending`} />
          <T variant="caption" center>
            Read the tone marks and the pitch line.
          </T>
        </View>
      )}
      <View style={styles.grid}>
        {shown.map((id, i) => {
          const item = bundle.items[id];
          if (!item) return null;
          const marked = toneMarked(item) ?? item.spelling;
          return (
            <View key={id} style={styles.cell}>
              <OptionTile state={stateOf(i)} onPress={() => pick(i)} disabled={checked} accessibilityLabel={marked} igbo testID={`${testID}-option-${i}`}>
                <T variant="display" igbo center>
                  {marked}
                </T>
                <ItemPitch item={item} height={28} syllables={false} testID={`${testID}-option-${i}-pitch`} />
                {checked ? (
                  <T variant="caption" center>
                    {item.gloss.en}
                  </T>
                ) : null}
              </OptionTile>
            </View>
          );
        })}
      </View>
      {checked && target && elsewhere.length > 0 ? (
        <View style={styles.elsewhere} testID={`${testID}-elsewhere`}>
          <T variant="label">Same word, other places</T>
          {elsewhere.map((r, i) => {
            const key = `elsewhere-${target.id}-${r.dialect}`;
            return (
              <Press
                key={key}
                testID={`${testID}-elsewhere-${i}`}
                onPress={() => audio.play(target, { dialect: r.dialect, key })}
                haptics="select"
                accessibilityLabel={`Play ${r.shown}, as said in ${r.places}`}
                style={[styles.place, audio.playing && audio.current === key && styles.placeOn]}
              >
                <Volume2 size={size.iconSm} color={colors.ink} strokeWidth={2} />
                <T variant="body" igbo tone="primary">
                  {r.shown}
                </T>
                <T variant="caption" igbo style={styles.flex} numberOfLines={1}>
                  {r.places}
                </T>
                {r.toneDiffers ? (
                  <T variant="caption" tone="accent">
                    other tones
                  </T>
                ) : null}
              </Press>
            );
          })}
        </View>
      ) : null}
      {playable && !checked ? <Button label="Can't listen now" variant="ghost" size="sm" onPress={onSkip} testID={`${testID}-skip`} style={styles.skip} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  listen: { alignItems: "center", gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  cell: { width: "48%", flexGrow: 1 },
  skip: { alignSelf: "center" },
  flex: { flex: 1 },
  elsewhere: { gap: space.xs },
  place: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: size.tapMin,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.ink06,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  placeOn: { borderColor: colors.ink },
});
