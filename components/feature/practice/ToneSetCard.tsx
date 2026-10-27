// One minimal set for the tone trainer's intro: the same letters, a
// different tone pattern for each meaning, each drawn as its pitch line (the
// explicit contour HVPT pairs with listening). Expected tones from the
// content, never a measurement.
import React from "react";
import { StyleSheet, View } from "react-native";
import { PitchLine } from "@/components/art";
import { Card, Chip, T } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import type { ToneSetView } from "@/lib/state/practice";

export function ToneSetCard({ set, testID }: { set: ToneSetView; testID: string }) {
  return (
    <Card padding="md" testID={testID}>
      <View style={styles.head}>
        <T variant="title" igbo>
          {set.spelling}
        </T>
        <T variant="caption" style={styles.flex}>
          {`${set.members.length} tone patterns`}
        </T>
        {set.met ? <Chip label="Met before" tone="success" testID={`${testID}-met`} /> : null}
      </View>
      <View style={styles.members}>
        {set.members.map((m, i) => (
          <View key={m.id} style={[styles.member, i > 0 && styles.rule]} testID={`${testID}-member-${i}`}>
            <View style={styles.word}>
              <T variant="title" igbo tone="primary">
                {m.marked}
              </T>
              <T variant="caption" numberOfLines={1}>
                {m.gloss}
              </T>
            </View>
            <View style={styles.pitch}>
              <PitchLine tones={m.tones} height={40} accessibilityLabel={`${m.marked}: ${m.gloss}`} />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  members: {},
  member: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  word: { flex: 1 },
  pitch: { width: 120 },
});
