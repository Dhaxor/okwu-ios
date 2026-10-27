// Development builds only, with the stand-in server: switch between the
// adult and teen experience, go offline, play the other side of a flow (a
// guardian saying yes, a moderator's mute), and pick this week's goals (the
// family challenge, the cohort quest, the voice-notes flag) to check every
// state. Never rendered in a release.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Segmented, Switch, T } from "@/components/ui";
import { space } from "@/constants/theme";
import type { CohortGoalKind, FamilyChallengeKind } from "@/lib/social";
import { useSocial } from "@/lib/state";

export function DevPanel({ testID }: { testID: string }) {
  const social = useSocial();
  const mock = social.mock;
  if (!__DEV__ || !mock || !social.setDevTier) return null;
  const tier = mock.tier;
  return (
    <Card variant="sunk" padding="md" testID={testID}>
      <T variant="label">Development · stand-in server</T>
      <T variant="caption" style={styles.lead}>
        No server is set (EXPO_PUBLIC_OKWU_API), so Community runs on seeded data with the real age rules.
      </T>
      <Segmented<"adult" | "teen">
        options={[
          { value: "adult", label: "Adult 18+" },
          { value: "teen", label: "Teen 13–17" },
        ]}
        value={tier}
        onChange={(t) => social.setDevTier?.(t)}
        testID={`${testID}-tier`}
        accessibilityLabel="Age tier"
      />
      <View style={styles.row}>
        <T variant="body" tone="primary" style={styles.flex}>
          Offline
        </T>
        <Switch
          value={mock.offline}
          onValueChange={(on) => {
            mock.setOffline(on);
            void social.refresh();
          }}
          accessibilityLabel="Simulate being offline"
          testID={`${testID}-offline`}
        />
      </View>
      <View style={styles.row}>
        <T variant="body" tone="primary" style={styles.flex}>
          Voice notes on the server
        </T>
        <Switch
          value={mock.voiceNotes}
          onValueChange={(on) => {
            mock.setVoiceNotes(on);
            void social.refresh();
          }}
          accessibilityLabel="Voice notes switched on at the server"
          testID={`${testID}-voice`}
        />
      </View>
      <T variant="caption" style={styles.label}>
        Family challenge this week
      </T>
      <Segmented<FamilyChallengeKind | "auto">
        options={[
          { value: "auto", label: "Rotation" },
          { value: "lessons", label: "Lessons" },
          { value: "words", label: "Words" },
          ...(mock.voiceNotes ? [{ value: "voice-replies" as const, label: "Replies" }] : []),
        ]}
        value={mock.challengeKind ?? "auto"}
        onChange={(k) => mock.setChallengeKind(k === "auto" ? null : k)}
        testID={`${testID}-challenge`}
        accessibilityLabel="Family challenge kind"
      />
      <T variant="caption" style={styles.label}>
        Cohort goal this week
      </T>
      <Segmented<CohortGoalKind | "auto">
        options={[
          { value: "auto", label: "Rotation" },
          { value: "reviews", label: "Reviews" },
          { value: "lessons", label: "Lessons" },
          { value: "minutes", label: "Minutes" },
        ]}
        value={mock.cohortGoal ?? "auto"}
        onChange={(k) => mock.setCohortGoal(k === "auto" ? null : k)}
        testID={`${testID}-cohort-goal`}
        accessibilityLabel="Cohort goal kind"
      />
      <View style={styles.buttons}>
        <Button label="The family finishes it" variant="secondary" size="sm" onPress={() => mock.finishChallenge()} testID={`${testID}-finish`} />
        {tier === "teen" ? <Button label="A guardian says yes" variant="secondary" size="sm" onPress={() => mock.approveGuardian()} testID={`${testID}-guardian`} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: space.xxs, marginBottom: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.sm },
  flex: { flex: 1 },
  label: { marginTop: space.sm, marginBottom: space.xs },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
});
