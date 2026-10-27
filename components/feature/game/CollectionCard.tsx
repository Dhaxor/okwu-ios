// Collection cards: Ilu (proverbs), Aha (names) and Akụkọ (story chapters).
// All Igbo on a card comes from approved content and is set with <T igbo>.
//   ilu    the precious one: an ink card with a spoken spiral and a drop of palm oil
//   aha    a paper card with a name seal
//   akuko  a paper card with an open book, or the folktale's own character
//   locked a quiet sunk card that says how to find it (never "locked out")
import React from "react";
import { StyleSheet, View } from "react-native";
import { AhaSeal, AkukoMark, IluMark, MbeFolktale } from "@/components/art/game/CollectionArt";
import { Card, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import type { CollectionKind } from "@/lib/game/types";

export interface CollectionCardProps {
  kind: CollectionKind;
  testID: string;
  /** The proverb, name or story title in Igbo (approved content). */
  igbo?: string;
  /** English: the meaning, gloss or chapter title. */
  english?: string;
  /** A short line under it (literal rendering, usage, chapter number). */
  note?: string;
  /** Not collected yet. */
  locked?: boolean;
  /** Akụkọ only: the folktale's own character drawn on its card. */
  character?: "mbe";
  onPress?: () => void;
}

const KIND_LABEL: Record<CollectionKind, string> = { ilu: "Proverb", aha: "Name", akuko: "Story" };
const HOW_TO_FIND: Record<CollectionKind, string> = {
  ilu: "Meet it in a lesson to keep it here.",
  aha: "Learn it in a lesson to keep it here.",
  akuko: "Read the chapter to keep it here.",
};

function Mark({ kind, character, onInk, faint }: { kind: CollectionKind; character?: "mbe"; onInk?: boolean; faint?: boolean }) {
  const el =
    kind === "ilu" ? <IluMark size={56} onInk={onInk} /> : kind === "aha" ? <AhaSeal size={56} onInk={onInk} /> : character === "mbe" ? <MbeFolktale size={64} /> : <AkukoMark size={56} />;
  return <View style={faint ? styles.faint : null}>{el}</View>;
}

export function CollectionCard({ kind, testID, igbo, english, note, locked = false, character, onPress }: CollectionCardProps) {
  if (locked) {
    return (
      <View testID={testID} style={[styles.base, styles.locked]} accessible accessibilityLabel={`${KIND_LABEL[kind]}, not collected yet. ${HOW_TO_FIND[kind]}`}>
        <Mark kind={kind} character={character} faint />
        <View style={styles.text}>
          <T variant="label" tone="faint">
            {KIND_LABEL[kind]}
          </T>
          <T variant="body" tone="muted">
            Waiting for you
          </T>
          <T variant="caption" tone="muted">
            {HOW_TO_FIND[kind]}
          </T>
        </View>
      </View>
    );
  }

  const ink = kind === "ilu";
  const a11y = [KIND_LABEL[kind], igbo, english, note].filter(Boolean).join(". ");
  const body = (
    <>
      <View style={styles.markRow}>
        <Mark kind={kind} character={character} onInk={ink} />
        <T variant="label" tone={ink ? "onInkMuted" : kind === "aha" ? "reward" : "accent"}>
          {KIND_LABEL[kind]}
        </T>
      </View>
      <View style={styles.text}>
        {igbo ? (
          <T variant={kind === "ilu" ? "body" : "title"} igbo strong={kind === "ilu"} tone={ink ? "onInk" : "primary"}>
            {igbo}
          </T>
        ) : null}
        {english ? (
          <T variant={igbo ? "caption" : "body"} strong={!igbo} tone={ink ? "onInkMuted" : igbo ? "secondary" : "primary"}>
            {english}
          </T>
        ) : null}
        {note ? (
          <T variant="caption" tone={ink ? "onInkMuted" : "muted"}>
            {note}
          </T>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Card variant={ink ? "ink" : "raised"} padding="md" onPress={onPress} testID={testID} accessibilityLabel={a11y} style={styles.base}>
        {body}
      </Card>
    );
  }
  return (
    <Card variant={ink ? "ink" : "raised"} padding="md" testID={testID} style={styles.base}>
      <View accessible accessibilityLabel={a11y} style={styles.inner}>
        {body}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, minHeight: 208, gap: space.sm },
  inner: { gap: space.sm, flex: 1 },
  locked: {
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairlineStrong,
  },
  markRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  text: { gap: space.xxs },
  faint: { opacity: 0.32 },
});
