// The names book's rows: a name and its meaning (an elegant list, set like
// a book), the learner's own family names, and a theme heading.
import React from "react";
import { StyleSheet, View } from "react-native";
import { ChevronRight, Star, Trash } from "@/components/glyphs/icons";
import { IconButton, Press, T } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { MEANING_PENDING, meaningLine, type FamilyName, type LibraryName, type NameThemeInfo } from "@/lib/library";
import type { LibraryAudio } from "@/lib/library/useLibrary";
import { PlayButton } from "./parts";

export function NameRow({
  name,
  audio,
  onOpen,
  saved = false,
  note,
  divider,
  testID,
}: {
  name: LibraryName;
  audio: LibraryAudio;
  onOpen: () => void;
  saved?: boolean;
  /** Why a search found it ("Also said as …"). */
  note?: string;
  divider: boolean;
  testID: string;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]} testID={testID}>
      <Press testID={`${testID}-open`} onPress={onOpen} pressScale={1} haptics="select" accessibilityLabel={`${name.spelling}: ${meaningLine(name)}`} style={styles.text}>
        <View style={styles.nameLine}>
          <T variant="title" igbo numberOfLines={1} style={styles.shrink}>
            {name.spelling}
          </T>
          {saved ? <Star size={size.iconSm - 4} color={colors.reward} strokeWidth={2.5} /> : null}
        </View>
        <T variant="body" tone={name.meaning ? "secondary" : "faint"} numberOfLines={2}>
          {meaningLine(name)}
        </T>
        {note ? (
          <T variant="caption" tone="accent" numberOfLines={1}>
            {note}
          </T>
        ) : null}
      </Press>
      <PlayButton id={name.audio} audio={audio} label={`Play ${name.spelling}`} playKey={`name-${name.id}`} testID={`${testID}-play`} />
    </View>
  );
}

export function ThemeHeading({ theme, count, testID }: { theme: NameThemeInfo; count: number; testID: string }) {
  return (
    <View style={styles.heading} testID={testID}>
      <View style={styles.headingTop}>
        <T variant="label" tone="accent" accessibilityRole="header">
          {theme.title}
        </T>
        <T variant="caption" numeric>
          {String(count)}
        </T>
      </View>
      <T variant="body" tone="muted">
        {theme.blurb}
      </T>
    </View>
  );
}

/** A name the learner keeps: from the book (opens it) or typed in their family's spelling. */
export function FamilyNameRow({
  entry,
  book,
  onOpen,
  onRemove,
  divider,
  testID,
}: {
  entry: FamilyName;
  book: LibraryName | null;
  onOpen: (() => void) | null;
  onRemove: () => void;
  divider: boolean;
  testID: string;
}) {
  const detail = [entry.note, book ? meaningLine(book) : MEANING_PENDING].filter(Boolean).join(" · ");
  const body = (
    <>
      <T variant="body" igbo tone="primary" strong numberOfLines={1}>
        {entry.name}
      </T>
      <T variant="caption" numberOfLines={2}>
        {detail}
      </T>
    </>
  );
  return (
    <View style={[styles.row, styles.familyRow, divider && styles.divider]} testID={testID}>
      {onOpen ? (
        <Press testID={`${testID}-open`} onPress={onOpen} pressScale={1} haptics="select" accessibilityLabel={`${entry.name}. ${detail}`} style={[styles.text, styles.openRow]}>
          <View style={styles.flex}>{body}</View>
          <ChevronRight size={size.iconSm} color={colors.ink48} strokeWidth={2} />
        </Press>
      ) : (
        <View style={styles.text}>{body}</View>
      )}
      <IconButton icon={Trash} accessibilityLabel={`Remove ${entry.name} from your family names`} onPress={onRemove} testID={`${testID}-remove`} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm + 2, minHeight: 72 },
  familyRow: { minHeight: 60, paddingVertical: space.xs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  text: { flex: 1, gap: 2 },
  openRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  nameLine: { flexDirection: "row", alignItems: "center", gap: space.xs },
  shrink: { flexShrink: 1 },
  heading: { gap: space.xxs, paddingTop: space.xs },
  headingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
