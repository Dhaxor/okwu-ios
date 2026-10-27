// Achievements as a quiet list of seals: what you did, and when. Unearned
// ones wait in the background with their description; nothing is ever
// taken away and nothing counts down.
//   <AchievementList items={game.view(state, now).achievements} limit={6} testID="achievements" />
import React from "react";
import { StyleSheet, View } from "react-native";
import { AchievementSeal } from "@/components/art/game/CollectionArt";
import { Card, T } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import type { AchievementView } from "@/lib/game/types";

export interface AchievementListProps {
  items: readonly AchievementView[];
  /** Show at most this many (earned first). */
  limit?: number;
  testID: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function AchievementList({ items, limit, testID }: AchievementListProps) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <Card testID={testID} padding="md">
      {shown.map((a, i) => (
        <View
          key={a.id}
          testID={`${testID}-${a.id}`}
          style={[styles.row, i < shown.length - 1 ? styles.divider : null]}
          accessible
          accessibilityLabel={a.unlockedAt ? `${a.title}: ${a.detail}` : `Still to come: ${a.title}. ${a.detail}`}
        >
          <AchievementSeal earned={!!a.unlockedAt} />
          <View style={styles.text}>
            <T variant="body" tone={a.unlockedAt ? "primary" : "muted"} strong={!!a.unlockedAt}>
              {a.title}
            </T>
            <T variant="caption" tone={a.unlockedAt ? "secondary" : "muted"}>
              {a.detail}
            </T>
          </View>
          {a.unlockedAt ? (
            <T variant="caption" tone="reward" strong>
              {when(a.unlockedAt)}
            </T>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  text: { flex: 1, gap: space.xxs },
});
