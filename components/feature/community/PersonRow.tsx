// One person in a list: their disc, name and a quiet line, an optional
// trailing element (a streak, a button), and the "…" that opens report,
// block and mute. Holding the name does the same, for people who reach for
// it. The "…" is a sibling of the row's pressable area, never inside it.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ellipsis } from "@/components/glyphs/icons";
import { IconButton, Press, T } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { Avatar } from "./Avatar";

export interface PersonRowProps {
  id: string;
  name: string;
  detail?: string;
  me?: boolean;
  online?: boolean;
  trailing?: React.ReactNode;
  /** Opens the safety sheet (report, block, mute). Omitted for the learner themself. */
  onMore?: () => void;
  onPress?: () => void;
  divider?: boolean;
  testID: string;
}

export function PersonRow({ id, name, detail, me = false, online = false, trailing, onMore, onPress, divider = false, testID }: PersonRowProps) {
  const who = (
    <>
      <Avatar id={id} name={name} me={me} online={online} />
      <View style={styles.text}>
        <T variant="body" tone="primary" numberOfLines={1}>
          {me ? `${name} (you)` : name}
        </T>
        {detail ? (
          <T variant="caption" numberOfLines={1}>
            {detail}
          </T>
        ) : null}
      </View>
    </>
  );
  return (
    <View testID={testID} style={[styles.row, divider && styles.divider]}>
      {onPress || onMore ? (
        <Press
          testID={`${testID}-who`}
          onPress={onPress ?? (() => {})}
          onLongPress={onMore}
          pressScale={1}
          haptics="select"
          accessibilityRole={onPress ? "button" : "text"}
          accessibilityLabel={detail ? `${name}, ${detail}` : name}
          accessibilityActions={onMore ? [{ name: "longpress", label: "Report, block or mute" }] : undefined}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && onMore?.()}
          style={styles.who}
        >
          {who}
        </Press>
      ) : (
        <View style={styles.who}>{who}</View>
      )}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {onMore ? <IconButton icon={Ellipsis} accessibilityLabel={`More for ${name}: report, block or mute`} onPress={onMore} testID={`${testID}-more`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  text: { flex: 1, gap: space.xxs },
  trailing: { alignSelf: "center" },
});
