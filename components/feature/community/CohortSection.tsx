// Ọgbọ: the cohort's weekly co-op quest (the game's QuestCard, for every goal
// kind the server rotates: reviews, lessons, minutes; ./cohortQuest), the
// preset reactions (no free text, so a cohort can never become a chat) and
// the latest reactions, each name with report, block and mute.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { QuestCard } from "@/components/feature/game";
import { Card, Chip, T, useToast } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { attempt, errorMessage, type CohortView, type ReactionId } from "@/lib/social";
import { REACTION_LABELS, REACTION_ORDER, timeAgo, useSocial } from "@/lib/state";
import { cohortLine, cohortQuestCard } from "./cohortQuest";
import { PersonRow } from "./PersonRow";
import type { SafetySubject } from "./SafetySheet";

export interface CohortSectionProps {
  cohort: CohortView;
  onSafety: (s: SafetySubject) => void;
  testID: string;
}

export function CohortSection({ cohort, onSafety, testID }: CohortSectionProps) {
  const social = useSocial();
  const toast = useToast();
  const [sent, setSent] = useState<ReactionId | null>(null);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const quest = useMemo(() => cohortQuestCard(cohort, new Date()), [cohort]);
  const me = social.account?.id;
  const recent = cohort.reactions.filter((r) => r.from.id !== me).slice(0, 3);

  const react = async (r: ReactionId) => {
    if (busy) return;
    setBusy(true);
    const res = await attempt(social.client.react(cohort.id, r));
    setBusy(false);
    if (!res.ok) return toast.show(errorMessage(res.error), { tone: "warning" });
    setSent(r);
    toast.show(`"${REACTION_LABELS[r]}" sent to your cohort`, { tone: "success" });
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <QuestCard view={quest.view} units={quest.units} subtitle={cohortLine(cohort.members.length)} testID={`${testID}-quest`} />

      <Card variant="flat" padding="md" testID={`${testID}-reactions`}>
        <T variant="body" strong tone="primary">
          Cheer your cohort on
        </T>
        <View style={styles.chips}>
          {REACTION_ORDER.map((r) => (
            <Chip key={r} label={REACTION_LABELS[r]} selected={sent === r} disabled={busy} onPress={() => void react(r)} testID={`${testID}-react-${r}`} />
          ))}
        </View>
        <T variant="caption">Preset words only, so the cohort stays kind. Nobody is ranked.</T>
        {recent.length ? (
          <View style={styles.recent}>
            {recent.map((r, i) => (
              <PersonRow
                key={`${r.from.id}-${r.at}`}
                id={r.from.id}
                name={r.from.displayName}
                detail={`“${REACTION_LABELS[r.reaction]}” · ${timeAgo(r.at, now)}`}
                onMore={() => onSafety({ title: r.from.displayName, what: `${r.from.displayName}'s name`, target: { kind: "account", id: r.from.id }, person: { id: r.from.id, name: r.from.displayName } })}
                divider={i < recent.length - 1}
                testID={`${testID}-reaction-${i}`}
              />
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginVertical: space.sm },
  recent: { marginTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
});
