// The Practice tab's way in to real-life Igbo: two small tiles side by side,
// the phrasebook and the conversations.
import React from "react";
import { StyleSheet, View } from "react-native";
import { BookOpen, MessagesSquare, type IconComponent } from "@/components/glyphs/icons";
import { Press, T } from "@/components/ui";
import { colors, radius, shadow, size, space } from "@/constants/theme";

function EntryTile({ icon: Icon, tint, title, meta, detail, onPress, testID }: { icon: IconComponent; tint: "accent" | "reward"; title: string; meta: string; detail: string; onPress: () => void; testID: string }) {
  return (
    <Press testID={testID} onPress={onPress} pressScale={0.97} accessibilityRole="button" accessibilityLabel={`${title}. ${meta}, ${detail}`} style={styles.tile}>
      <View style={[styles.badge, { backgroundColor: tint === "accent" ? colors.accent12 : colors.reward12 }]}>
        <Icon size={size.icon} color={tint === "accent" ? colors.accent : colors.rewardText} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <T variant="body" strong tone="primary" numberOfLines={1}>
          {title}
        </T>
        <T variant="caption" numeric numberOfLines={1}>
          {meta}
        </T>
        <T variant="caption" numberOfLines={1}>
          {detail}
        </T>
      </View>
    </Press>
  );
}

export function RealLifeEntry({ phrases, situations, conversations, onPhrasebook, onConversations, testID }: {
  phrases: number;
  situations: number;
  conversations: number;
  onPhrasebook: () => void;
  onConversations: () => void;
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <EntryTile icon={BookOpen} tint="reward" title="Phrasebook" meta={phrases > 0 ? `${phrases} phrases` : "Everyday phrases"} detail={`${situations} situations`} onPress={onPhrasebook} testID={`${testID}-phrasebook`} />
      <EntryTile icon={MessagesSquare} tint="accent" title="Conversations" meta={`${conversations} role-plays`} detail="Never scored" onPress={onConversations} testID={`${testID}-conversations`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  tile: { flex: 1, minWidth: 0, borderRadius: radius.xl, backgroundColor: colors.surface, padding: space.md, gap: space.sm, boxShadow: shadow.card },
  badge: { width: size.tapMin, height: size.tapMin, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  text: { minWidth: 0 },
});
