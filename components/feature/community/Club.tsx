// Otu clubs (18+): the club card for browsing, the chat bubble and the
// composer. Club names and descriptions are user-made, so the card has
// report too. The composer runs the shared filter as you type
// (FILTER_MESSAGES): contact details will show as ***, and money, grooming
// and abuse are refused before they are sent. The server decides.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AudioLines, BookOpen, Ellipsis, Languages, Send, Sprout, Users, type IconComponent } from "@/components/glyphs/icons";
import { Button, Card, Chip, IconButton, Press, T, TextField } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { LIMITS, type ClubMessage, type ClubSummary } from "@/lib/social";
import { chatFeedback, timeAgo } from "@/lib/state";

/** Preset club badges (no images in v1). */
export const CLUB_BADGES: readonly { id: string; label: string; icon: IconComponent }[] = [
  { id: "sprout", label: "Beginners", icon: Sprout },
  { id: "users", label: "Speaking", icon: Users },
  { id: "book", label: "Reading", icon: BookOpen },
  { id: "languages", label: "Dialects", icon: Languages },
  { id: "audio", label: "Tones", icon: AudioLines },
];

export function badgeIcon(id: string): IconComponent {
  return CLUB_BADGES.find((b) => b.id === id)?.icon ?? Users;
}

export interface ClubCardProps {
  club: ClubSummary;
  mine: boolean;
  onOpen: () => void;
  onJoin?: () => void;
  joining?: boolean;
  onMore: () => void;
  testID: string;
}

export function ClubCard({ club, mine, onOpen, onJoin, joining, onMore, testID }: ClubCardProps) {
  const Icon = badgeIcon(club.badge);
  const full = club.memberCount >= club.maxMembers;
  return (
    <Card variant="flat" padding="md" testID={testID}>
      <View style={styles.clubHead}>
        <View style={styles.badge}>
          <Icon size={size.icon} color={colors.accent} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <T variant="body" strong tone="primary" numberOfLines={1}>
            {club.name}
          </T>
          <T variant="caption" numeric>{`${club.memberCount} of ${club.maxMembers} members${club.open ? "" : " · invite only"}`}</T>
        </View>
        <IconButton icon={Ellipsis} accessibilityLabel={`More for ${club.name}: report this club`} onPress={onMore} testID={`${testID}-more`} />
      </View>
      {club.description ? (
        <T variant="body" tone="secondary" style={styles.descr} numberOfLines={3}>
          {club.description}
        </T>
      ) : null}
      <View style={styles.clubActions}>
        {mine ? (
          <Button label="Open chat" onPress={onOpen} testID={`${testID}-open`} size="md" />
        ) : onJoin ? (
          <Button label={full ? "Full" : "Join"} onPress={onJoin} disabled={full} loading={joining} variant="secondary" testID={`${testID}-join`} size="md" />
        ) : null}
        {mine ? <Chip label="Your club" tone="success" testID={`${testID}-mine`} /> : null}
      </View>
    </Card>
  );
}

export interface ChatBubbleProps {
  message: ClubMessage;
  mine: boolean;
  /** Owner or officer. */
  role?: "owner" | "officer" | null;
  onMore: () => void;
  testID: string;
}

export function ChatBubble({ message, mine, role, onMore, testID }: ChatBubbleProps) {
  const when = timeAgo(message.at, new Date());
  return (
    <View style={[styles.line, mine && styles.lineMine]}>
      {!mine ? (
        <T variant="caption" strong tone="secondary" style={styles.author} numberOfLines={1}>
          {`${message.author.displayName}${role ? ` · ${role}` : ""}`}
        </T>
      ) : null}
      <Press
        testID={testID}
        onLongPress={onMore}
        onPress={() => {}}
        delayLongPress={350}
        pressScale={0.98}
        haptics="select"
        accessibilityLabel={`${mine ? "You" : message.author.displayName}: ${message.text}. ${when}.`}
        accessibilityHint="Hold for report, block or mute"
        accessibilityActions={[{ name: "longpress", label: mine ? "Delete" : "Report, block or mute" }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && onMore()}
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
      >
        <T variant="body" tone={mine ? "onInk" : "primary"}>
          {message.text}
        </T>
      </Press>
      <T variant="caption" tone="faint" style={[styles.when, mine && styles.whenMine]}>
        {when}
      </T>
    </View>
  );
}

export interface ComposerProps {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Seconds before the next line may go (slow mode); 0 when free. */
  waitSeconds: number;
  disabledReason?: string | null;
  testID: string;
}

export function Composer({ value, onChange, onSend, sending, waitSeconds, disabledReason, testID }: ComposerProps) {
  const feedback = useMemo(() => chatFeedback(value, LIMITS.clubMessageMaxGraphemes), [value]);
  const blocked = !feedback.ok;
  const canSend = !!value.trim() && !blocked && waitSeconds <= 0 && !sending && !disabledReason;
  const note = disabledReason ?? (feedback.ok ? (feedback.hint ?? (waitSeconds > 0 ? `Slow mode: you can send again in ${waitSeconds} s` : null)) : null);
  return (
    <View style={styles.composer}>
      <View style={styles.composeRow}>
        <View style={styles.flex}>
          <TextField
            label="Message the club"
            value={value}
            onChangeText={onChange}
            error={feedback.ok ? undefined : feedback.message}
            hint={note ?? undefined}
            editable={!disabledReason}
            returnKeyType="send"
            onSubmitEditing={() => canSend && onSend()}
            testID={testID}
          />
        </View>
        <View style={styles.sendWrap}>
          <IconButton icon={Send} variant="ink" accessibilityLabel="Send" onPress={onSend} disabled={!canSend} testID={`${testID}-send`} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clubHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  badge: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent12, alignItems: "center", justifyContent: "center" },
  descr: { marginTop: space.sm },
  clubActions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  line: { alignItems: "flex-start", maxWidth: "86%", gap: space.xxs },
  lineMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  author: { marginLeft: space.sm },
  bubble: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.xl },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderTopLeftRadius: radius.sm },
  bubbleMine: { backgroundColor: colors.ink, borderTopRightRadius: radius.sm },
  when: { marginHorizontal: space.sm },
  whenMine: { textAlign: "right" },
  composer: { gap: space.xs },
  composeRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  sendWrap: { paddingTop: 24 },
});
