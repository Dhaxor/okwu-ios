// The Ọgbọ weekly quest card: one shared goal for the whole cohort. The bar
// shows the cohort's total with this learner's part in camwood. Nobody is
// ranked and nobody is named; members appear as quiet beads.
//   <QuestCard view={game.view(state, now).quest} title="Ọgbọ" titleIgbo testID="quest" />
import React from "react";
import { StyleSheet, View } from "react-native";
import { CircleCheck, Users } from "@/components/glyphs/icons";
import { Card, Chip, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { QuestMetric, QuestView } from "@/lib/game/types";

export interface QuestCardProps {
  view: QuestView;
  /** Heading; the motif name from content, e.g. "Ọgbọ". Default "This week, together". */
  title?: string;
  titleIgbo?: boolean;
  /** A quiet English line beside an Igbo title (defaults to the English name when the title is Igbo). */
  subtitle?: string;
  /**
   * The unit words, when the goal isn't one of the game's metrics (the Ọgbọ
   * cohort's server goals include reviews and minutes). Defaults to the
   * metric's own words.
   */
  units?: readonly [singular: string, plural: string];
  testID: string;
}

const UNIT: Record<QuestMetric, [string, string]> = {
  lessons: ["lesson", "lessons"],
  speaking: ["word spoken", "words spoken"],
  "new-words": ["new word", "new words"],
  stories: ["chapter", "chapters"],
  "practice-days": ["day of practice", "days of practice"],
};

const MAX_BEADS = 10;

export function QuestCard({ view, title = "This week, together", titleIgbo = false, subtitle, units, testID }: QuestCardProps) {
  const sub = subtitle ?? (titleIgbo ? "This week, together" : undefined);
  const unit = (units ?? UNIT[view.metric])[view.target === 1 ? 0 : 1];
  const mineShare = view.target > 0 ? Math.min(1, view.mine / view.target) : 0;
  const totalShare = view.progress;
  const beads = Math.min(view.members, MAX_BEADS);
  return (
    <Card testID={testID}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <T variant="title" igbo={titleIgbo} accessibilityRole="header">
            {title}
          </T>
          {sub ? <T variant="caption">{sub}</T> : null}
        </View>
        {view.complete ? (
          <Chip label="Done" tone="success" icon={CircleCheck} testID={`${testID}-done`} />
        ) : (
          <Chip label={view.daysLeft === 1 ? "Last day" : `${view.daysLeft} days left`} testID={`${testID}-days`} />
        )}
      </View>
      <View style={styles.quest}>
        <T variant="body" strong tone="primary">
          {view.title}
        </T>
        <T variant="caption">{view.detail}</T>
      </View>

      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Your cohort: ${view.total} of ${view.target} ${unit}. You added ${view.mine}.`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(totalShare * 100) }}
      >
        <View style={[styles.fill, styles.others, { width: `${totalShare * 100}%` }]} />
        <View style={[styles.fill, styles.mine, { width: `${Math.min(mineShare, totalShare) * 100}%` }]} />
        {[0.25, 0.5, 0.75].map((m) => (
          <View key={m} style={[styles.tick, { left: `${m * 100}%` }]} />
        ))}
      </View>

      <View style={styles.numbers}>
        <View style={styles.legend}>
          <View style={[styles.key, styles.mine]} />
          <T variant="caption" tone="secondary">
            You: <T variant="caption" strong numeric tone="primary">{view.mine}</T>
          </T>
        </View>
        <View style={styles.legend}>
          <View style={[styles.key, styles.others]} />
          <T variant="caption" tone="secondary">
            Together: <T variant="caption" strong numeric tone="primary">{view.total}</T> of {view.target} {unit}
          </T>
        </View>
      </View>

      {view.complete ? (
        <View style={styles.done} testID={`${testID}-complete`}>
          <CircleCheck size={size.icon} color={colors.success} strokeWidth={2} />
          <View style={styles.doneText}>
            <T variant="body" strong tone="success">
              Together, you did it
            </T>
            <T variant="caption">Your cohort reached this week's goal. A new one starts on Monday.</T>
          </View>
        </View>
      ) : (
        <View style={styles.members} accessible accessibilityLabel={`${view.members} people in your cohort`}>
          <Users size={size.iconSm} color={colors.ink68} strokeWidth={2} />
          <View style={styles.beads}>
            {Array.from({ length: beads }, (_, i) => (
              <View key={i} style={[styles.member, i === 0 ? styles.memberMe : null]} />
            ))}
          </View>
          <T variant="caption">
            {view.members} in your cohort
          </T>
        </View>
      )}
    </Card>
  );
}

const TRACK = 12;

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm },
  headText: { flex: 1 },
  quest: { marginTop: space.md, gap: space.xxs },
  track: { height: TRACK, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, marginTop: space.lg, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  others: { backgroundColor: colors.reward },
  mine: { backgroundColor: colors.accent },
  tick: { position: "absolute", top: 3, bottom: 3, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.surface, opacity: 0.8 },
  numbers: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.sm, gap: space.sm, flexWrap: "wrap" },
  legend: { flexDirection: "row", alignItems: "center", gap: space.xs },
  key: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  members: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  beads: { flexDirection: "row", gap: space.xxs },
  member: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: colors.ink12, borderWidth: 1, borderColor: colors.hairlineStrong },
  memberMe: { backgroundColor: colors.accent, borderColor: colors.accent },
  done: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.success12 },
  doneText: { flex: 1, gap: space.xxs },
});
