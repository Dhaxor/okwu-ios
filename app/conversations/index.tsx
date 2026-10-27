// Real-life conversations: role-plays for the moments heritage learners care
// about, practised privately first (RESEARCH §5). The list says how it works,
// which ones you have practised, and that every line is pending review.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ConversationCard, HowItWorks } from "@/components/feature/conversations";
import { PhraseSourceNote, ReviewChip } from "@/components/feature/phrasebook";
import { Screen, ScreenHeader, Section } from "@/components/ui";
import { space } from "@/constants/theme";
import { CONVERSATIONS_SOURCE_DETAIL, loadConversations } from "@/lib/phrasebook";
import { usePracticeLog } from "@/lib/phrasebook/hooks";

export default function ConversationsList() {
  const router = useRouter();
  const { credit, conversations } = useMemo(() => loadConversations(), []);
  const { log } = usePracticeLog();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/practice"));

  return (
    <Screen testID="conversations">
      <ScreenHeader
        eyebrow="Practice"
        title="Conversations"
        subtitle="Role-play the moments that matter, privately, before you need them."
        onBack={close}
        testID="conversations-header"
      />

      <HowItWorks testID="conversations-how" />

      <Section title={`${conversations.length} conversations`} testID="conversations-list">
        <View style={styles.list}>
          {conversations.map((c) => (
            <ConversationCard
              key={c.id}
              conversation={c}
              practised={log[c.id]?.sessions ?? 0}
              onPress={() => router.push({ pathname: "/conversations/[id]", params: { id: c.id } })}
              testID={`conversations-${c.id}`}
            />
          ))}
        </View>
      </Section>

      <View style={styles.end}>
        <ReviewChip testID="conversations-review" />
        <PhraseSourceNote credit={credit} detail={CONVERSATIONS_SOURCE_DETAIL} testID="conversations-source" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  end: { gap: space.sm },
});
