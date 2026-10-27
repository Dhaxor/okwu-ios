// Library cards: the hub's shelf tiles, proverb cards, tale and explainer
// cards. Built from components/ui and constants/theme only.
import React from "react";
import { StyleSheet, View } from "react-native";
import { ChevronRight, Clock } from "@/components/glyphs/icons";
import { Card, Press, T } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import type { CultureMotif, LibraryCustom, LibraryProverb, LibraryTale } from "@/lib/library";
import type { LibraryAudio } from "@/lib/library/useLibrary";
import { CultureArt } from "./CultureArt";
import { PlayButton } from "./parts";

/** One shelf of the library on the hub: art, the Igbo word, the English name and a count. */
export function ShelfTile({
  igbo,
  title,
  detail,
  motif,
  seed,
  onPress,
  testID,
}: {
  igbo: string;
  title: string;
  detail: string;
  motif: CultureMotif;
  seed: number;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Card padding="none" onPress={onPress} testID={testID} accessibilityLabel={`${title}: ${detail}`} style={styles.tile}>
      <CultureArt motif={motif} seed={seed} height={84} />
      <View style={styles.tileBody}>
        <T variant="title" igbo numberOfLines={1}>
          {igbo}
        </T>
        <T variant="body" tone="primary" strong numberOfLines={1}>
          {title}
        </T>
        <T variant="caption" numberOfLines={1}>
          {detail}
        </T>
      </View>
    </Card>
  );
}

/** A proverb card: the Igbo, its recording and the dataset's translation; opens the full card. */
export function ProverbCard({ proverb, audio, onOpen, themeTitle, testID }: { proverb: LibraryProverb; audio: LibraryAudio; onOpen: () => void; themeTitle: string; testID: string }) {
  return (
    <Card padding="none" testID={testID}>
      <View style={styles.proverbTop}>
        <Press testID={`${testID}-open`} onPress={onOpen} pressScale={1} haptics="select" accessibilityLabel={`${proverb.en}. Open the meaning`} style={styles.flex}>
          <T variant="title" igbo>
            {proverb.igbo}
          </T>
          <T variant="body" tone="muted">
            {proverb.en}
          </T>
        </Press>
        <PlayButton id={proverb.audio} audio={audio} label={`Play the proverb: ${proverb.en}`} playKey={`proverb-${proverb.id}`} testID={`${testID}-play`} />
      </View>
      <Press testID={`${testID}-more`} onPress={onOpen} pressScale={1} haptics="select" accessibilityLabel="What it means and when it's used" style={styles.proverbFoot}>
        <T variant="caption" strong tone="accent" style={styles.flex}>
          {proverb.meaning ? "What it means" : "Meaning pending review"}
        </T>
        <T variant="caption" tone="faint">
          {themeTitle}
        </T>
        <ChevronRight size={size.iconSm} color={colors.ink48} strokeWidth={2} />
      </Press>
    </Card>
  );
}

export function TaleCard({ tale, onPress, testID, seed }: { tale: LibraryTale; onPress: () => void; testID: string; seed: number }) {
  return (
    <Card padding="none" onPress={onPress} testID={testID} accessibilityLabel={`${tale.title}. ${tale.minutes} minute read`}>
      <CultureArt motif={tale.motif} seed={seed} height={120} field />
      <View style={styles.cardBody}>
        <T variant="title">{tale.title}</T>
        <T variant="body" tone="muted">
          {tale.told}
        </T>
        <View style={styles.meta}>
          <Clock size={size.iconSm - 2} color={colors.ink68} strokeWidth={2} />
          <T variant="caption">{`${tale.minutes} min · English with Igbo lines`}</T>
        </View>
      </View>
    </Card>
  );
}

export function CustomCard({ custom, onPress, testID, seed }: { custom: LibraryCustom; onPress: () => void; testID: string; seed: number }) {
  return (
    <Card variant="raised" padding="none" onPress={onPress} testID={testID} accessibilityLabel={`${custom.title}. ${custom.summary}`}>
      <View style={styles.customRow}>
        <View style={styles.customArt}>
          {custom.motif === "none" ? (
            <View style={styles.quietMark}>
              <T variant="caption" tone="faint" center>
                No images
              </T>
            </View>
          ) : (
            <CultureArt motif={custom.motif} seed={seed} height={96} />
          )}
        </View>
        <View style={styles.customText}>
          <T variant="label" tone="accent" igbo>
            {custom.kicker}
          </T>
          <T variant="body" strong tone="primary">
            {custom.title}
          </T>
          <T variant="caption" numberOfLines={3}>
            {custom.summary}
          </T>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tile: { flexGrow: 1, flexBasis: "45%" },
  tileBody: { padding: space.md, gap: 2 },
  proverbTop: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.lg, paddingBottom: space.md },
  proverbFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: size.tapMin + space.xs,
    paddingHorizontal: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
  },
  cardBody: { padding: space.lg, gap: space.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xxs },
  customRow: { flexDirection: "row", alignItems: "stretch" },
  customArt: { width: 104, backgroundColor: colors.surfaceSunk, justifyContent: "center" },
  quietMark: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.sm },
  customText: { flex: 1, padding: space.md, gap: 2, justifyContent: "center" },
});
