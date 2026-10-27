// A Family Circle on the Community tab: who is in it, this week's family
// challenge, what's new for you, and anything waiting on you (a teen asking
// you to say yes to their voice notes). The whole card opens the circle.
import React from "react";
import { StyleSheet, View } from "react-native";
import { HeartHandshake, Mic } from "@/components/glyphs/icons";
import { Card, Chip, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { AccountId, CircleView } from "@/lib/social";
import { consentRequestsForMe } from "@/lib/state";
import { AvatarStack } from "./Avatar";
import { FamilyChallengeStrip } from "./FamilyChallenge";

export interface CircleCardProps {
  circle: CircleView;
  me: AccountId | null;
  /** Notes addressed to me (prompts) in this circle, newest first. */
  forMe: number;
  latest: string | null;
  onPress: () => void;
  testID: string;
}

export function CircleCard({ circle, me, forMe, latest, onPress, testID }: CircleCardProps) {
  const asks = consentRequestsForMe(circle, me);
  const people = circle.members.map((m) => ({ id: m.profile.id, name: m.profile.displayName }));
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={`${circle.name}, ${circle.members.length} people. Open the Family Circle.`}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <HeartHandshake size={size.icon} color={colors.accent} strokeWidth={2} />
        </View>
        <View style={styles.headText}>
          <T variant="title" numberOfLines={1}>
            {circle.name}
          </T>
          <T variant="caption">{`${circle.members.length} of ${circle.maxMembers} · invite only${circle.myRole === "keeper" ? " · you keep it" : ""}`}</T>
        </View>
      </View>
      <View style={styles.people}>
        <AvatarStack people={people} />
        {forMe > 0 ? <Chip label={forMe === 1 ? "1 prompt for you" : `${forMe} prompts for you`} tone="accent" icon={Mic} testID={`${testID}-for-me`} /> : null}
      </View>
      {circle.challenge ? <FamilyChallengeStrip challenge={circle.challenge} testID={`${testID}-challenge`} /> : null}
      {asks.length ? (
        <View style={styles.ask} testID={`${testID}-asks`}>
          <T variant="body" strong tone="primary">
            {asks.length === 1 ? `${asks[0]!.displayName} asked you about voice notes` : `${asks.length} young people asked you about voice notes`}
          </T>
          <T variant="caption">They need a parent or guardian to say yes before they can send voice notes.</T>
        </View>
      ) : latest ? (
        <T variant="body" tone="secondary" numberOfLines={2} style={styles.latest}>
          {latest}
        </T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1 },
  badge: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent12, alignItems: "center", justifyContent: "center" },
  people: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, marginTop: space.md, flexWrap: "wrap" },
  ask: { marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.reward12, gap: space.xxs },
  latest: { marginTop: space.md },
});
