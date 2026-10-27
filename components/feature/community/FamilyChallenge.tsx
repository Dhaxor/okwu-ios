// The Family Circle's weekly challenge: one goal the whole family shares,
// one bar, and the names of whoever helped. Co-op only: nobody is ranked,
// nobody's amount is shown to anyone else, and a week that ends unfinished
// just gives way to Monday's challenge. Finishing it is the circle's small
// peak: a bloom of uli dots and a thank-you.
//   <FamilyChallengeCard challenge={circle.challenge} me={me} testID="circle-challenge" />   the circle screen
//   <FamilyChallengeStrip challenge={circle.challenge} testID="…-challenge" />                 the Community tab card
import React from "react";
import { StyleSheet, View } from "react-native";
import { RewardBloom } from "@/components/art/game";
import { BookOpen, CircleCheck, HeartHandshake, Languages, Mic, Sparkles, type IconComponent } from "@/components/glyphs/icons";
import { Card, Chip, ProgressBar, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { AccountId, FamilyChallengeKind, FamilyChallengeView } from "@/lib/social";
import { AvatarStack } from "./Avatar";
import { CHALLENGE_COPY, challengeA11y, daysLeftLabel, helpersLine, mineLine, orderedHelpers, stripLine, unitFor } from "./challenge";

const KIND_ICON: Record<FamilyChallengeKind, IconComponent> = {
  lessons: BookOpen,
  words: Languages,
  "voice-replies": Mic,
};

export interface FamilyChallengeCardProps {
  challenge: FamilyChallengeView;
  me: AccountId | null;
  testID: string;
}

export function FamilyChallengeCard({ challenge: c, me, testID }: FamilyChallengeCardProps) {
  const copy = CHALLENGE_COPY[c.kind];
  const Icon = KIND_ICON[c.kind];
  const share = c.target > 0 ? Math.min(1, c.progress / c.target) : 0;
  const mineShare = c.target > 0 ? Math.min(share, c.mine / c.target) : 0;
  const people = orderedHelpers(c.helpers, me).map((p) => ({ id: p.id, name: p.displayName }));
  return (
    <Card testID={testID}>
      <View style={styles.head}>
        <View style={[styles.badge, c.completed ? styles.badgeDone : null]}>
          {c.completed ? <CircleCheck size={size.icon} color={colors.success} strokeWidth={2} /> : <Icon size={size.icon} color={colors.rewardText} strokeWidth={2} />}
        </View>
        <View style={styles.headText}>
          <T variant="label" tone={c.completed ? "success" : "reward"}>
            {c.completed ? "Done this week" : "Family challenge"}
          </T>
          <T variant="title" accessibilityRole="header">
            {copy.title(c.target)}
          </T>
        </View>
      </View>

      {c.completed ? (
        <View style={styles.done} testID={`${testID}-done`} accessible accessibilityLabel={challengeA11y(c)}>
          <RewardBloom size={136}>
            <View style={styles.doneDisc}>
              <HeartHandshake size={size.icon + 10} color={colors.accent} strokeWidth={2} />
            </View>
          </RewardBloom>
          <T variant="title" center>
            Together, you did it
          </T>
          <T variant="body" tone="muted" center>
            {`${c.target} ${unitFor(c.kind, c.target)} as a family this week. A new challenge starts on Monday.`}
          </T>
        </View>
      ) : (
        <>
          <T variant="caption" style={styles.how}>
            {copy.how}
          </T>
          <View style={styles.numbers}>
            <View style={styles.big}>
              <T variant="display" numeric strong tone="primary" testID={`${testID}-progress`}>
                {String(c.progress)}
              </T>
              <T variant="body" tone="muted" style={styles.of}>
                {`of ${c.target} ${unitFor(c.kind, c.target)}`}
              </T>
            </View>
            <Chip label={daysLeftLabel(c.endsAt, new Date())} testID={`${testID}-days`} />
          </View>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={challengeA11y(c)}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
            testID={`${testID}-bar`}
          >
            <View style={[styles.fill, styles.family, { width: `${share * 100}%` }]} />
            <View style={[styles.fill, styles.mine, { width: `${mineShare * 100}%` }]} />
            {[0.25, 0.5, 0.75].map((m) => (
              <View key={m} style={[styles.tick, { left: `${m * 100}%` }]} />
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.key, styles.mine]} />
              <T variant="caption" tone="secondary">
                {mineLine(c)}
              </T>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.key, styles.family]} />
              <T variant="caption" tone="secondary">
                The family
              </T>
            </View>
          </View>
        </>
      )}

      <View style={styles.helpers} testID={`${testID}-helpers`}>
        {people.length ? <AvatarStack people={people} max={4} /> : <Sparkles size={size.iconSm} color={colors.rewardText} strokeWidth={2} />}
        <T variant="caption" tone="secondary" style={styles.flex}>
          {helpersLine(c, me)}
        </T>
      </View>
    </Card>
  );
}

/** The challenge in one line and a slim bar, inside the Community tab's circle card. */
export function FamilyChallengeStrip({ challenge: c, testID }: { challenge: FamilyChallengeView; testID: string }) {
  const Icon = c.completed ? CircleCheck : KIND_ICON[c.kind];
  return (
    <View style={[styles.strip, c.completed ? styles.stripDone : null]} testID={testID} accessible accessibilityLabel={challengeA11y(c)}>
      <View style={styles.stripHead}>
        <Icon size={size.iconSm} color={c.completed ? colors.success : colors.rewardText} strokeWidth={2} />
        <View style={styles.flex}>
          <T variant="caption" tone={c.completed ? "success" : "reward"} strong numberOfLines={1}>
            {c.completed ? "Family challenge done" : "Family challenge"}
          </T>
          <T variant="body" tone="primary" numberOfLines={2}>
            {CHALLENGE_COPY[c.kind].title(c.target)}
          </T>
        </View>
        {c.completed ? null : (
          <T variant="caption" numeric strong tone="primary">
            {`${c.progress}/${c.target}`}
          </T>
        )}
      </View>
      {c.completed ? (
        <T variant="caption" tone="secondary">
          {`${stripLine(c)}. A new one starts on Monday.`}
        </T>
      ) : (
        <ProgressBar value={c.target > 0 ? c.progress / c.target : 0} tone="reward" accessibilityLabel={stripLine(c)} />
      )}
    </View>
  );
}

const TRACK = 12;

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1, gap: space.xxs },
  badge: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.reward12, alignItems: "center", justifyContent: "center" },
  badgeDone: { backgroundColor: colors.success12 },
  flex: { flex: 1 },
  how: { marginTop: space.md },
  numbers: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, marginTop: space.lg },
  big: { flexDirection: "row", alignItems: "baseline", gap: space.xs, flexShrink: 1 },
  of: { flexShrink: 1 },
  track: { height: TRACK, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, marginTop: space.md, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  family: { backgroundColor: colors.reward },
  mine: { backgroundColor: colors.accent },
  tick: { position: "absolute", top: 3, bottom: 3, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.surface, opacity: 0.8 },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md, marginTop: space.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  key: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  helpers: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  done: { alignItems: "center", gap: space.xs, marginTop: space.sm },
  doneDisc: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.hairline },
  strip: { marginTop: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface, gap: space.sm },
  stripDone: { borderColor: colors.success12, backgroundColor: colors.success12 },
  stripHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
