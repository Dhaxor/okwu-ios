// A person as a soft disc with their initial (no photos in v1). The tint is
// stable per account, from the earth palette, so a circle of relatives reads
// as a family of colours rather than a row of identical grey dots.
import React from "react";
import { StyleSheet, View } from "react-native";
import { T, type TTone } from "@/components/ui";
import { colors, radius } from "@/constants/theme";
import { initialOf, tintOf } from "@/lib/state";

const TINTS: { bg: string; tone: TTone }[] = [
  { bg: colors.accent12, tone: "accent" },
  { bg: colors.reward12, tone: "reward" },
  { bg: colors.success12, tone: "success" },
  { bg: colors.ink06, tone: "primary" },
];

export interface AvatarProps {
  id: string;
  name: string;
  size?: 32 | 40 | 48;
  /** A ring that marks the learner themself. */
  me?: boolean;
  online?: boolean;
}

export function Avatar({ id, name, size = 40, me = false, online = false }: AvatarProps) {
  const t = me ? { bg: colors.ink, tone: "onInk" as TTone } : TINTS[tintOf(id)]!;
  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.disc, { width: size, height: size, backgroundColor: t.bg }]}>
        <T variant={size >= 48 ? "title" : size >= 40 ? "body" : "caption"} strong tone={t.tone}>
          {initialOf(name)}
        </T>
      </View>
      {online ? <View style={[styles.dot, size <= 32 && styles.dotSmall]} /> : null}
    </View>
  );
}

/** Overlapping discs for a group (a circle's members). */
export function AvatarStack({ people, max = 5 }: { people: { id: string; name: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <View style={styles.stack} accessible accessibilityLabel={`${people.length} ${people.length === 1 ? "person" : "people"}`}>
      {shown.map((p, i) => (
        <View key={p.id} style={[styles.stacked, i > 0 && styles.overlap]}>
          <Avatar id={p.id} name={p.name} size={32} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.stacked, styles.overlap, styles.more]}>
          <T variant="caption" strong tone="secondary" numeric>{`+${more}`}</T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.surface },
  dotSmall: { width: 10, height: 10 },
  stack: { flexDirection: "row", alignItems: "center" },
  stacked: { borderRadius: radius.pill, borderWidth: 2, borderColor: colors.surface },
  overlap: { marginLeft: -10 },
  more: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSunk },
});
