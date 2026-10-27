// Small pieces every library screen uses: a play control that says "soon"
// honestly, the review and source tags, an Igbo line with its translation,
// word chips and the "this varies" callout.
import React, { useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Info, Volume2 } from "@/components/glyphs/icons";
import { Chip, IconButton, Press, T } from "@/components/ui";
import { colors, gutterFor, radius, size, space } from "@/constants/theme";
import { DATASET_NOTE, REVIEW_NOTE, SOURCE_LINE, type LibraryLine, type LibraryWord } from "@/lib/library";
import type { LibraryAudio } from "@/lib/library/useLibrary";

/** Play a dataset recording, or say plainly that it is not here yet. */
export function PlayButton({ id, audio, label, playKey, testID, onInk = false }: { id: string | null; audio: LibraryAudio; label: string; playKey: string; testID: string; onInk?: boolean }) {
  const kind = audio.availability(id);
  if (kind === "none") return null;
  if (kind === "pending") {
    return (
      <View style={styles.soon} testID={`${testID}-soon`} accessible accessibilityLabel="Recording coming soon">
        <T variant="caption" tone={onInk ? "onInkMuted" : "faint"} center>
          Soon
        </T>
      </View>
    );
  }
  const active = audio.playing && audio.current === playKey;
  return (
    <IconButton
      icon={Volume2}
      variant={onInk || active ? "ink" : "tinted"}
      accessibilityLabel={label}
      onPress={() => audio.play(id, playKey)}
      testID={testID}
      style={onInk ? [styles.onInkButton, active && styles.onInkActive] : undefined}
    />
  );
}

/** "Pending cultural review" (our English) or "Not yet reviewed by Okwu" (dataset entries). */
export function ReviewTag({ kind = "draft", testID }: { kind?: "draft" | "dataset"; testID: string }) {
  return <Chip label={kind === "draft" ? REVIEW_NOTE : "Not yet reviewed by Okwu"} tone="reward" testID={testID} />;
}

export function SourceNote({ text = SOURCE_LINE, testID }: { text?: string; testID: string }) {
  return (
    <View style={styles.source} testID={testID}>
      <Info size={size.iconSm} color={colors.ink68} strokeWidth={2} />
      <T variant="caption" style={styles.flex}>
        {text}
      </T>
    </View>
  );
}

export { DATASET_NOTE };

/**
 * An Igbo line from the dataset with its recording and translation.
 * `reveal`: the translation waits behind a tap (listening first).
 */
export function IgboLine({
  line,
  audio,
  testID,
  size: variant = "body",
  reveal = false,
  divider = false,
}: {
  line: LibraryLine;
  audio: LibraryAudio;
  testID: string;
  size?: "body" | "title";
  reveal?: boolean;
  divider?: boolean;
}) {
  const [shown, setShown] = useState(!reveal);
  return (
    <View style={[styles.line, divider && styles.divider]} testID={testID}>
      <View style={styles.flex}>
        <T variant={variant} igbo tone="primary">
          {line.igbo}
        </T>
        {shown ? (
          <T variant="caption">{line.en}</T>
        ) : (
          <Press testID={`${testID}-reveal`} onPress={() => setShown(true)} pressScale={1} haptics="select" accessibilityLabel="Show the English" style={styles.reveal}>
            <T variant="caption" strong tone="accent">
              Show the English
            </T>
          </Press>
        )}
      </View>
      <PlayButton id={line.audio} audio={audio} label={`Play: ${line.en}`} playKey={`line-${testID}`} testID={`${testID}-play`} />
    </View>
  );
}

/** Dataset headwords as tappable chips: the tone-marked word, its gloss, and a tap to hear it. */
export function WordChips({ words, audio, testID }: { words: LibraryWord[]; audio: LibraryAudio; testID: string }) {
  return (
    <View style={styles.words} testID={testID}>
      {words.map((w, i) => {
        const playable = audio.availability(w.audio) !== "none" && audio.availability(w.audio) !== "pending";
        const active = audio.playing && audio.current === `word-${testID}-${i}`;
        const body = (
          <>
            <View style={styles.wordText}>
              <T variant="body" igbo tone="primary" numberOfLines={1}>
                {w.text}
              </T>
              <T variant="caption" numberOfLines={2}>
                {w.gloss}
              </T>
            </View>
            {playable ? <Volume2 size={size.iconSm} color={active ? colors.accent : colors.ink68} strokeWidth={2} /> : null}
          </>
        );
        return playable ? (
          <Press key={`${w.text}-${i}`} testID={`${testID}-${i}`} onPress={() => audio.play(w.audio, `word-${testID}-${i}`)} haptics="select" accessibilityLabel={`Play ${w.text}: ${w.gloss}`} style={[styles.word, active && styles.wordActive]}>
            {body}
          </Press>
        ) : (
          <View key={`${w.text}-${i}`} testID={`${testID}-${i}`} style={styles.word}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** The quiet callout every explainer carries: practice differs. */
export function VariesNote({ text, testID }: { text: string; testID: string }) {
  return (
    <View style={styles.varies} testID={testID}>
      <View style={styles.variesBar} />
      <View style={styles.flex}>
        <T variant="label" tone="reward">
          It varies
        </T>
        <T variant="body">{text}</T>
      </View>
    </View>
  );
}

/** Filter chips on one line that scroll sideways, running to the screen's edges. */
export function ChipRow({ children, testID }: { children: React.ReactNode; testID: string }) {
  const { width } = useWindowDimensions();
  const gutter = gutterFor(width);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID={testID}
      style={[styles.chipRow, { marginHorizontal: -gutter }]}
      contentContainerStyle={[styles.chipRowInner, { paddingHorizontal: gutter }]}
    >
      {children}
    </ScrollView>
  );
}

/** A short label and count above a list. */
export function Eyebrow({ children }: { children: string }) {
  return (
    <T variant="label" tone="accent">
      {children}
    </T>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  soon: { minWidth: size.tapMin, minHeight: size.tapMin, alignItems: "center", justifyContent: "center" },
  onInkButton: { backgroundColor: colors.onInk12, borderWidth: 1, borderColor: colors.onInk24, boxShadow: "none" },
  onInkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  source: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
  line: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  reveal: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  words: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chipRow: { flexGrow: 0 },
  chipRowInner: { gap: space.xs, alignItems: "center" },
  word: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: size.tapMin + space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    maxWidth: "100%",
  },
  wordActive: { borderColor: colors.accent, backgroundColor: colors.accent06 },
  wordText: { flexShrink: 1 },
  varies: { flexDirection: "row", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.reward12 },
  variesBar: { width: 3, borderRadius: radius.pill, backgroundColor: colors.reward },
});
