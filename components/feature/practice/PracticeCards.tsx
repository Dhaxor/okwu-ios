// The Practice tab's cards: today's review (the one featured ink card), the
// tool tiles (tone trainer, say it) and the dictionary's search launcher.
import React from "react";
import { StyleSheet, View } from "react-native";
import { AkweteBand, PitchLine } from "@/components/art";
import { ChevronRight, Search, type IconComponent } from "@/components/glyphs/icons";
import { Card, Chip, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { Tone } from "@/lib/content/types";
import { nextDueWords, type ReviewOverview } from "@/lib/state/practice";

export function ReviewHero({ overview, now, onPress, testID }: { overview: ReviewOverview | null; now: Date; onPress?: () => void; testID: string }) {
  const due = overview?.dueWords ?? 0;
  const learned = overview?.learnedWords ?? 0;
  const body =
    overview === null ? (
      <T variant="body" tone="onInkMuted">
        Opening your words…
      </T>
    ) : due > 0 ? (
      <View style={styles.dueRow}>
        <T variant="display" tone="onInk" numeric testID={`${testID}-count`}>
          {String(due)}
        </T>
        <View style={styles.flex}>
          <T variant="body" tone="onInk">
            {due === 1 ? "word ready to review" : "words ready to review"}
          </T>
          <T variant="caption" tone="onInkMuted">
            {`About ${overview.estMinutes} ${overview.estMinutes === 1 ? "minute" : "minutes"}`}
          </T>
        </View>
      </View>
    ) : learned > 0 ? (
      <View style={styles.copy}>
        <T variant="display" tone="onInk" testID={`${testID}-caught-up`}>
          All caught up
        </T>
        <T variant="body" tone="onInkMuted">
          {overview.nextDue ? `Your ${learned} ${learned === 1 ? "word comes" : "words come"} back ${nextDueWords(overview.nextDue, now)}, just before you'd forget.` : "Every word you know is fresh."}
        </T>
      </View>
    ) : (
      <View style={styles.copy}>
        <T variant="title" tone="onInk" testID={`${testID}-empty`}>
          Your review starts after your first lesson
        </T>
        <T variant="body" tone="onInkMuted">
          Each word you learn comes back here at the right time, so it stays.
        </T>
      </View>
    );
  const inner = (
    <>
      <AkweteBand height={20} />
      <View style={styles.hero}>
        <T variant="label" tone="onInkMuted">
          Today's review
        </T>
        {body}
      </View>
    </>
  );
  return onPress ? (
    <Card variant="ink" padding="none" onPress={onPress} accessibilityLabel={due > 0 ? `Today's review: ${due} words ready` : "Today's review"} testID={testID}>
      {inner}
    </Card>
  ) : (
    <Card variant="ink" padding="none" testID={testID}>
      {inner}
    </Card>
  );
}

export function ToolTile({
  icon: Icon,
  tint,
  title,
  detail,
  meta,
  tones,
  onPress,
  testID,
}: {
  icon: IconComponent;
  tint: "accent" | "success";
  title: string;
  detail: string;
  meta: string;
  /** A real pitch line to preview (from a content item). */
  tones?: readonly Tone[];
  onPress: () => void;
  testID: string;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${detail}`} testID={testID} style={styles.tile}>
      <View style={styles.tileHead}>
        <View style={[styles.badge, { backgroundColor: tint === "accent" ? colors.accent12 : colors.success12 }]}>
          <Icon size={size.icon} color={tint === "accent" ? colors.accent : colors.success} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <T variant="title">{title}</T>
          <T variant="caption">{meta}</T>
        </View>
        <ChevronRight size={size.iconSm} color={colors.ink48} strokeWidth={2} />
      </View>
      <T variant="body">{detail}</T>
      {tones && tones.length > 1 ? <PitchLine tones={tones} height={36} accessibilityLabel="An example pitch line" /> : null}
    </Card>
  );
}

/** Looks like a search field; opens the dictionary's search screen. */
export function DictionaryLauncher({ size: count, onPress, testID }: { size: number | null; onPress: () => void; testID: string }) {
  return (
    <Press testID={testID} onPress={onPress} pressScale={0.98} accessibilityRole="search" accessibilityLabel="Search the dictionary in Igbo or English" style={styles.launcher}>
      <View style={styles.field}>
        <Search size={size.icon} color={colors.ink68} strokeWidth={2} />
        <T variant="body" tone="muted" numberOfLines={1} style={styles.flex}>
          Search Igbo or English
        </T>
      </View>
      <View style={styles.launcherFoot}>
        <Chip label={count ? `${count.toLocaleString("en")} words` : "Dictionary"} tone="accent" testID={`${testID}-count`} />
        <T variant="caption" style={styles.flex}>
          Tones, recordings and regional forms from Nkọwa okwu
        </T>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { padding: space.lg, gap: space.sm },
  dueRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  copy: { gap: space.xs },
  tile: { gap: space.sm },
  tileHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  badge: { width: size.tapMin, height: size.tapMin, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  launcher: { borderRadius: radius.xl, backgroundColor: colors.surface, padding: space.md, gap: space.md, overflow: "hidden", borderWidth: 1, borderColor: colors.hairline },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: size.field,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  launcherFoot: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
