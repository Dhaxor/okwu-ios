// The Learn tab's way into the Culture and heritage library: one quiet card
// with a little uli art, today's market day and what is inside.
import React from "react";
import { StyleSheet, View } from "react-native";
import { ChevronRight } from "@/components/glyphs/icons";
import { Card, T } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { calendarFile } from "@/lib/library";
import { useTodayInIzu } from "@/lib/library/useLibrary";
import { CultureArt } from "./CultureArt";

export function LibraryEntryCard({ onPress, testID }: { onPress: () => void; testID: string }) {
  const izu = useTodayInIzu();
  const day = calendarFile().days.find((d) => d.id === izu.day);
  return (
    <Card padding="none" onPress={onPress} testID={testID} accessibilityLabel="Culture and heritage library: names, proverbs, tales, customs and the market-day calendar">
      <View style={styles.row}>
        <View style={styles.art}>
          <CultureArt motif="beads" seed={6} height={88} />
        </View>
        <View style={styles.text}>
          <T variant="label" tone="accent">
            Culture and heritage
          </T>
          <T variant="body" strong tone="primary">
            Names, proverbs, tales and customs
          </T>
          {day ? (
            <T variant="caption">
              {izu.verified ? "Today is " : "Today in your izu: "}
              <T variant="caption" igbo strong tone="secondary">
                {day.spelling}
              </T>
            </T>
          ) : null}
        </View>
        <ChevronRight size={size.iconSm} color={colors.ink48} strokeWidth={2} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingRight: space.md },
  art: { width: 96, alignSelf: "stretch", justifyContent: "center", backgroundColor: colors.surfaceSunk },
  text: { flex: 1, gap: 2, paddingVertical: space.md },
});
