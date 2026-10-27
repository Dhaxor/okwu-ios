// Small shared pieces of the learner tools: Igbo at the learner's tone-mark
// level, a card's recording, the mastery bar and its legend, stat tiles,
// the week's day bars and the count beads for tones. Built only from
// components/ui, components/art and constants/theme.
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Volume2 } from "@/components/glyphs/icons";
import { IconButton, Press, T, type TTone } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { MasteryLevel } from "@/lib/learning";
import { useItemAudio, type ToneMarks } from "@/lib/state";
import { useDictionaryAudio } from "@/lib/state/useDictionary";
import type { CardView } from "@/lib/tools";

// ---------------------------------------------------------------------------
// Igbo text and audio for a card (course item or dictionary word)
// ---------------------------------------------------------------------------

/** A card's Igbo at the Settings tone-mark level: marks shown, tap to see them, or the spelling only. */
export function CardIgbo({
  card,
  marks,
  variant = "display",
  center = false,
  tone = "primary",
  testID,
}: {
  card: Pick<CardView, "spelling" | "toned">;
  marks: ToneMarks;
  variant?: "display" | "title" | "body";
  center?: boolean;
  tone?: TTone;
  testID: string;
}) {
  const [revealed, setRevealed] = useState(false);
  if (!card.toned || marks === "hidden" || marks === "shown" || revealed) {
    return (
      <T variant={variant} igbo center={center} tone={tone} testID={testID}>
        {card.toned && (marks === "shown" || revealed) ? card.toned : card.spelling}
      </T>
    );
  }
  return (
    <Press testID={testID} onPress={() => setRevealed(true)} pressScale={1} haptics="select" accessibilityLabel={`${card.spelling}. Show tone marks`} style={center ? styles.center : undefined}>
      <T variant={variant} igbo center={center} tone={tone}>
        {card.spelling}
      </T>
      <T variant="caption" tone="accent" center={center}>
        Tap for tones
      </T>
    </Press>
  );
}

export interface CardAudio {
  /** "playing", or why not: "pending" (recording coming soon) or "none". */
  play: (card: CardView, key?: string) => "playing" | "pending" | "none";
  available: (card: CardView) => boolean;
  stop: () => void;
  playing: boolean;
  current: string | null;
}

/** One player for both kinds of card: course items (useItemAudio) and dictionary words (dataset clips). */
export function useCardAudio(): CardAudio {
  const items = useItemAudio();
  const dict = useDictionaryAudio();
  const play = useCallback(
    (card: CardView, key?: string) => {
      if (card.item) return items.play(card.item, { key: key ?? card.ref });
      const k = dict.play(card.clip, key ?? card.ref);
      return k === "asset" || k === "url" ? "playing" : k === "pending" ? "pending" : "none";
    },
    [items, dict]
  );
  const available = useCallback(
    (card: CardView) => {
      if (card.item) return items.availability(card.item) === "playing";
      const k = dict.availability(card.clip);
      return k === "asset" || k === "url";
    },
    [items, dict]
  );
  const stop = useCallback(() => {
    items.stop();
    dict.stop();
  }, [items, dict]);
  return { play, available, stop, playing: items.playing || dict.playing, current: items.playing ? items.current : dict.playing ? dict.current : (items.current ?? dict.current) };
}

export function PlayCard({ card, audio, label, testID, variant = "tinted" }: { card: CardView; audio: CardAudio; label?: string; testID: string; variant?: "tinted" | "ink" | "plain" }) {
  if (!audio.available(card)) return null;
  const on = audio.playing && audio.current === card.ref;
  return <IconButton icon={Volume2} variant={on ? "ink" : variant} accessibilityLabel={label ?? `Play ${card.spelling}`} onPress={() => audio.play(card)} testID={testID} />;
}

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

export const LEVEL_COLORS: Record<MasteryLevel, string> = {
  0: colors.surfaceDeep,
  1: colors.rewardLight,
  2: colors.reward,
  3: colors.success,
  4: colors.successDeep,
};

export const LEVEL_NAMES: Record<MasteryLevel, string> = { 0: "Not started", 1: "Learning", 2: "Familiar", 3: "Strong", 4: "Mastered" };

const LEVELS: readonly MasteryLevel[] = [4, 3, 2, 1, 0];

/** Words at each level as one bar: the greens are strong, the ochres on their way, paper is new. */
export function MasteryBar({ levels, height = size.progress, accessibilityLabel, testID }: { levels: Record<MasteryLevel, number>; height?: number; accessibilityLabel?: string; testID?: string }) {
  const total = LEVELS.reduce<number>((n, l) => n + levels[l], 0);
  const label =
    accessibilityLabel ??
    LEVELS.filter((l) => levels[l] > 0)
      .map((l) => `${levels[l]} ${LEVEL_NAMES[l].toLowerCase()}`)
      .join(", ");
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label || "No words yet"} style={[styles.bar, { height }]}>
      {total === 0 ? null : LEVELS.map((l) => (levels[l] > 0 ? <View key={l} style={{ flex: levels[l], backgroundColor: LEVEL_COLORS[l] }} /> : null))}
    </View>
  );
}

export function MasteryLegend({ levels, testID }: { levels: Record<MasteryLevel, number>; testID?: string }) {
  return (
    <View style={styles.legend} testID={testID}>
      {LEVELS.filter((l) => levels[l] > 0).map((l) => (
        <View key={l} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: LEVEL_COLORS[l] }]} />
          <T variant="caption" numeric>{`${levels[l]} ${LEVEL_NAMES[l].toLowerCase()}`}</T>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** A value bigger than its label, with a kind note under it (accent when it went up). */
export function StatTile({
  value,
  label,
  note,
  sub,
  up,
  big = false,
  center = false,
  testID,
}: {
  value: string;
  label: string;
  note?: string;
  sub?: string;
  up?: boolean;
  big?: boolean;
  center?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.stat} testID={testID}>
      <T variant={big ? "display" : "title"} numeric strong={!big} tone="primary" center={center}>
        {value}
      </T>
      <T variant="body" tone="primary" numberOfLines={1} center={center}>
        {label}
      </T>
      {note ? (
        <T variant="caption" tone={up ? "accent" : "muted"} numberOfLines={2} center={center}>
          {note}
        </T>
      ) : null}
      {sub ? (
        <T variant="caption" numberOfLines={1} center={center}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

/** Seven bars, Monday first: minutes a day. Today in camwood (ochre on ink), days to come as a dot. */
export function DayBars({
  minutes,
  today,
  daysSoFar,
  initials,
  onInk = false,
  height = 72,
  testID,
}: {
  minutes: readonly number[];
  today: number;
  daysSoFar: number;
  initials: readonly string[];
  onInk?: boolean;
  height?: number;
  testID: string;
}) {
  const max = Math.max(1, ...minutes);
  const idle = onInk ? colors.onInk24 : colors.ink12;
  const fill = onInk ? colors.onInk : colors.ink;
  const hot = onInk ? colors.rewardLight : colors.accent;
  return (
    <View testID={testID} accessible accessibilityLabel={`Minutes each day: ${minutes.map((m, i) => `${initials[i]} ${Math.round(m)}`).join(", ")}`} style={styles.days}>
      {minutes.map((m, i) => {
        const future = i >= daysSoFar;
        const h = m > 0 ? Math.max(space.xs, Math.round((m / max) * height)) : 0;
        return (
          <View key={i} style={styles.dayCol}>
            <View style={[styles.dayTrack, { height }]}>
              {m > 0 ? (
                <View style={[styles.dayFill, { height: h, backgroundColor: i === today ? hot : fill }]} />
              ) : (
                <View style={[styles.dayDot, { backgroundColor: future ? colors.transparent : idle, borderColor: idle }]} />
              )}
            </View>
            <T variant="caption" tone={onInk ? (i === today ? "onInk" : "onInkMuted") : i === today ? "accent" : "muted"} strong={i === today} center>
              {initials[i]}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** Right out of heard, as beads (a count of listening, never a score). Up to ten beads; longer runs show the share in ten. */
export function CountBeads({ right, heard, testID }: { right: number; heard: number; testID?: string }) {
  const shown = Math.min(heard, 10);
  const filled = heard <= 10 ? right : Math.round((right / heard) * 10);
  return (
    <View style={styles.beads} testID={testID} accessible accessibilityLabel={`${right} of ${heard} heard right the first time`}>
      {Array.from({ length: shown }, (_, i) => (
        <View key={i} style={[styles.bead, i < filled ? styles.beadOn : styles.beadOff]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
  bar: { flexDirection: "row", borderRadius: radius.pill, overflow: "hidden", backgroundColor: colors.surfaceSunk, gap: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: space.xxs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  stat: { flex: 1, gap: 2, minWidth: 0 },
  days: { flexDirection: "row", gap: space.xs, alignItems: "flex-end" },
  dayCol: { flex: 1, alignItems: "center", gap: space.xxs },
  dayTrack: { width: "100%", justifyContent: "flex-end", alignItems: "center" },
  dayFill: { width: "70%", maxWidth: 28, borderRadius: radius.sm },
  dayDot: { width: 6, height: 6, borderRadius: radius.pill, borderWidth: 1, marginBottom: 1 },
  beads: { flexDirection: "row", gap: space.xxs, justifyContent: "flex-end" },
  bead: { width: 10, height: 10, borderRadius: radius.pill },
  beadOn: { backgroundColor: colors.success },
  beadOff: { backgroundColor: colors.transparent, borderWidth: 1.5, borderColor: colors.ink24 },
});
