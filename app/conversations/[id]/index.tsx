// A conversation's page: the scene, the people in it, how you want to
// practise (listen through, take a part, or say it before you hear it), which
// part is yours, and the cultural tips for the moment. The flag reports any
// line of the conversation. One primary action: start.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { CastRow, ConversationIcon, MODE_COPY, ModeOption, TipCard, TipText, TipsPendingChip } from "@/components/feature/conversations";
import { PhraseSourceNote, ReviewChip } from "@/components/feature/phrasebook";
import { ReportSheet } from "@/components/feature/practice";
import { ArrowLeft, Flag } from "@/components/glyphs/icons";
import { Button, Card, Chip, IconButton, Press, Screen, Section, T } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { CONVERSATIONS_SOURCE_DETAIL, PRACTICE_MODES, conversationById, conversationsVersion, hasDraftLines, linesOf, loadConversations, roleName, type PracticeMode } from "@/lib/phrasebook";
import { conversationLineSubjects } from "@/lib/state/reportTargets";

export default function ConversationPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const conversation = useMemo(() => (id ? conversationById(id) : null), [id]);
  const credit = useMemo(() => loadConversations().credit, []);
  const [mode, setMode] = useState<PracticeMode>("role");
  const [role, setRole] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/conversations"));

  if (!conversation) {
    return (
      <Screen testID="conversation-missing" center footer={<Button label="All conversations" onPress={close} testID="conversation-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            We couldn't find this conversation
          </T>
        </View>
      </Screen>
    );
  }

  const part = role ?? conversation.learnerRole;
  const drafts = conversation.lines.filter((l) => l.provenance === "draft-ai").length;
  const start = () =>
    router.push({ pathname: "/conversations/[id]/play", params: { id: conversation.id, mode, role: mode === "listen" ? conversation.learnerRole : part } });

  return (
    <Screen
      testID="conversation"
      footer={<Button label={mode === "listen" ? MODE_COPY.listen.start : `${MODE_COPY[mode].start} as ${roleName(conversation, part)}`} icon={MODE_COPY[mode].icon} onPress={start} testID="conversation-start" block />}
    >
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} variant="tinted" testID="conversation-back" />
        <T variant="label" tone="accent">
          Conversation
        </T>
        <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} variant="tinted" testID="conversation-report-flag" />
      </View>

      <View style={styles.head} testID="conversation-head">
        <ConversationIcon id={conversation.id} size={56} />
        <T variant="display" accessibilityRole="header">
          {conversation.title}
        </T>
        <TipText text={conversation.setting} tone="secondary" />
        <View style={styles.chips}>
          <Chip label={`${conversation.lines.length} lines`} testID="conversation-lines" />
          <ReviewChip testID="conversation-review" />
          {hasDraftLines(conversation) ? <Chip label={drafts === 1 ? "1 AI-drafted line" : `${drafts} AI-drafted lines`} tone="reward" testID="conversation-drafts" /> : null}
        </View>
      </View>

      <Section title="How do you want to practise?" testID="conversation-modes">
        <View style={styles.options}>
          {PRACTICE_MODES.map((m) => (
            <ModeOption key={m} mode={m} selected={mode === m} onPress={() => setMode(m)} testID={`conversation-mode-${m}`} />
          ))}
        </View>
      </Section>

      <Section title={mode === "listen" ? "The people" : "Choose your part"} testID="conversation-cast">
        <Card variant="flat" padding="md">
          {conversation.roles.map((r, i) =>
            mode === "listen" ? (
              <CastRow key={r.id} name={r.name} note={r.note} mine={false} testID={`conversation-role-${i}`} />
            ) : (
              <View key={r.id} style={i > 0 ? styles.divider : undefined}>
                <RolePick name={r.name} note={`${r.note} · ${linesOf(conversation, r.id)} lines`} selected={part === r.id} onPress={() => setRole(r.id)} testID={`conversation-role-${i}`} />
              </View>
            )
          )}
        </Card>
      </Section>

      <Section title="Before you go" action={<TipsPendingChip testID="conversation-tips-review" />} testID="conversation-tips">
        <View style={styles.options}>
          {conversation.tips.map((t, i) => (
            <TipCard key={i} tip={t} testID={`conversation-tip-${i}`} />
          ))}
        </View>
      </Section>

      <PhraseSourceNote credit={credit} detail={CONVERSATIONS_SOURCE_DETAIL} testID="conversation-source" />

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targets={conversationLineSubjects(conversation, conversation.lines.map((_, i) => i), conversationsVersion()).reverse()}
        testID="conversation-report-sheet"
      />
    </Screen>
  );
}

/** One person of the scene, as a choice: your part is the one marked "Your part". */
function RolePick({ name, note, selected, onPress, testID }: { name: string; note: string; selected: boolean; onPress: () => void; testID: string }) {
  return (
    <Press testID={testID} onPress={onPress} pressScale={1} haptics="select" accessibilityRole="radio" accessibilityLabel={`${name}. ${note}`} accessibilityState={{ selected }}>
      <CastRow name={name} note={note} mine={selected} testID={`${testID}-row`} />
    </Press>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  head: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  options: { gap: space.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
});
