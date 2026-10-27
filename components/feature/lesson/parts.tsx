// Shared pieces of the lesson player: the exercise header, the play
// button, the "Recording coming soon" notice, Igbo text at the learner's
// tone-mark level, answer tiles and the kind feedback panel.
import React, { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { PitchLine } from "@/components/art";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { Check, Info, Volume2 } from "@/components/glyphs/icons";
import { Button, Chip, Press, T, type TTone } from "@/components/ui";
import { colors, radius, shadow, size, space } from "@/constants/theme";
import { RECORDING_PENDING_NOTICE, pitchLineFor, toneMarked } from "@/lib/content";
import type { Item } from "@/lib/content/types";
import type { Feedback, Part, ToneMarks } from "@/lib/state";

export function ExerciseHeader({ label, title, draft, testID }: { label: string; title: string; draft: boolean; testID: string }) {
  return (
    <View style={styles.header} testID={testID}>
      <T variant="label" tone="accent">
        {label}
      </T>
      <T variant="title" accessibilityRole="header">
        {title}
      </T>
      {draft ? <DraftTag testID={`${testID}-draft`} /> : null}
    </View>
  );
}

/** "Recording coming soon": shown wherever a native recording does not exist yet. Never a synthetic voice. */
export function PendingNotice({ testID }: { testID: string }) {
  return <Chip label={RECORDING_PENDING_NOTICE} tone="neutral" icon={Info} testID={testID} />;
}

/** The big ink play button with a caption under it. */
export function PlayButton({ onPress, playing, label = "Tap to hear it", size: given, testID }: { onPress: () => void; playing: boolean; label?: string; size?: number; testID: string }) {
  const { height } = useWindowDimensions();
  // Smaller on SE-class phones, so the answers stay in view.
  const s = given ?? (height < 760 ? 72 : 88);
  return (
    <View style={styles.listen}>
      <Press
        testID={testID}
        onPress={onPress}
        accessibilityLabel={playing ? "Playing" : "Play"}
        accessibilityHint={label}
        style={[styles.play, { width: s, height: s }, playing && styles.playing]}
      >
        <Volume2 size={size.icon + 10} color={colors.onInk} strokeWidth={2} />
      </Press>
      <T variant="caption">{playing ? "Listening…" : label}</T>
    </View>
  );
}

/** Igbo for an item at the learner's tone-mark level: marks shown, tap to reveal, or spelling only. */
export function ItemText({
  item,
  marks,
  variant = "display",
  center = false,
  tone = "primary",
  testID,
}: {
  item: Item;
  marks: ToneMarks;
  variant?: "display" | "title" | "body";
  center?: boolean;
  tone?: TTone;
  testID: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const marked = toneMarked(item);
  if (!marked || marks === "hidden") {
    return (
      <T variant={variant} igbo center={center} tone={tone} testID={testID}>
        {item.spelling}
      </T>
    );
  }
  if (marks === "shown" || revealed) {
    return (
      <T variant={variant} igbo center={center} tone={tone} testID={testID}>
        {marked}
      </T>
    );
  }
  return (
    <Press testID={testID} onPress={() => setRevealed(true)} pressScale={1} haptics="select" accessibilityLabel={`${item.spelling}. Show tone marks`} style={center ? styles.revealCenter : undefined}>
      <T variant={variant} igbo center={center} tone={tone}>
        {item.spelling}
      </T>
      <T variant="caption" tone="accent" center={center}>
        Tap for tones
      </T>
    </Press>
  );
}

export type TileState = "idle" | "selected" | "correct" | "missed" | "wrong";

const LOOK: Record<TileState, object> = {
  idle: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong },
  selected: { backgroundColor: colors.accent06, borderColor: colors.ink, borderWidth: 2 },
  correct: { backgroundColor: colors.success12, borderColor: colors.success, borderWidth: 2 },
  missed: { backgroundColor: colors.success12, borderColor: colors.success },
  wrong: { backgroundColor: colors.reward12, borderColor: colors.reward, borderWidth: 2 },
};

/** An answer tile. A wrong pick turns ochre, never red, and the right answer is marked beside it. */
export function OptionTile({
  children,
  state,
  onPress,
  disabled,
  accessibilityLabel,
  igbo,
  compact,
  testID,
}: {
  children: React.ReactNode;
  state: TileState;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  igbo?: boolean;
  compact?: boolean;
  testID: string;
}) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptics="select"
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityLanguage={igbo ? "ig" : undefined}
      accessibilityState={{ selected: state === "selected" || state === "correct" || state === "wrong", disabled: !!disabled }}
      style={[compact ? styles.row : styles.tile, LOOK[state]]}
    >
      {state === "correct" || state === "missed" ? (
        <View style={[styles.check, compact && styles.checkRow]}>
          <Check size={size.iconSm - 4} color={colors.onInk} strokeWidth={3} />
        </View>
      ) : null}
      {children}
    </Press>
  );
}

/** The tone contour for an item, or a quiet note while its tones are pending review. */
export function ItemPitch({ item, height = 64, syllables = true, testID }: { item: Item; height?: number; syllables?: boolean; testID: string }) {
  const p = pitchLineFor(item);
  if (!p) {
    return (
      <T variant="caption" center testID={testID}>
        Tones pending review
      </T>
    );
  }
  return <PitchLine tones={p.tones} syllables={syllables ? p.syllables : undefined} height={height} accessibilityLabel={`Tones: ${p.label}`} testID={testID} />;
}

function Run({ part, tone }: { part: Part; tone: TTone }) {
  return (
    <T variant="body" igbo={part.igbo} strong={part.strong} tone={part.igbo ? "primary" : tone}>
      {part.text}
    </T>
  );
}

/** The kind feedback panel: leaf when right, ochre for "almost" and "not yet" (never red), paper for speaking. */
export function FeedbackPanel({ feedback, onAddDialect, testID }: { feedback: Feedback; onAddDialect?: () => void; testID: string }) {
  const look = feedback.tone === "correct" ? styles.fbCorrect : feedback.tone === "self" ? styles.fbSelf : styles.fbClose;
  const titleTone: TTone = feedback.tone === "correct" ? "success" : feedback.tone === "self" ? "primary" : "reward";
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={[styles.feedback, look]}>
      <T variant="title" tone={titleTone}>
        {feedback.title}
      </T>
      {feedback.lines.map((line, i) => (
        <T key={i} variant="body" tone="primary">
          {line.map((p, j) => (
            <Run key={j} part={p} tone="primary" />
          ))}
        </T>
      ))}
      {feedback.offerDialect && onAddDialect ? (
        <Button label={`Add ${feedback.offerDialect.label} to my dialects`} size="sm" variant="secondary" onPress={onAddDialect} testID={`${testID}-add-dialect`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  listen: { alignItems: "center", gap: space.xs },
  play: { borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", boxShadow: shadow.inkButton },
  playing: { backgroundColor: colors.inkSoft },
  revealCenter: { alignItems: "center" },
  tile: {
    flex: 1,
    minHeight: 112,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    justifyContent: "center",
    alignItems: "stretch",
    gap: space.xs,
    boxShadow: shadow.card,
  },
  row: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    boxShadow: shadow.card,
  },
  check: {
    position: "absolute",
    top: space.xs,
    right: space.xs,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  checkRow: { top: undefined, right: space.md },
  feedback: { borderRadius: radius.lg, padding: space.md, gap: space.xxs, marginBottom: space.xs },
  fbCorrect: { backgroundColor: colors.success12 },
  fbClose: { backgroundColor: colors.reward12 },
  fbSelf: { backgroundColor: colors.surfaceSunk },
});
