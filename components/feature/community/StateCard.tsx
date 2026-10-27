// The calm states every Community surface needs: offline, something went
// wrong, nothing here yet, and locked. Each says what happens next and
// offers the one action that helps.
import React from "react";
import { StyleSheet, View } from "react-native";
import { CircleAlert, Lock, WifiOff, type IconComponent } from "@/components/glyphs/icons";
import { Button, Card, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";

export interface StateCardProps {
  kind?: "offline" | "error" | "empty" | "locked";
  icon?: IconComponent;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; testID: string; icon?: IconComponent };
  secondary?: { label: string; onPress: () => void; testID: string };
  testID: string;
}

const DEFAULT_ICON: Record<NonNullable<StateCardProps["kind"]>, IconComponent | null> = {
  offline: WifiOff,
  error: CircleAlert,
  empty: null,
  locked: Lock,
};

export function StateCard({ kind = "empty", icon, title, body, action, secondary, testID }: StateCardProps) {
  const Icon = icon ?? DEFAULT_ICON[kind];
  return (
    <Card variant={kind === "empty" ? "flat" : "sunk"} testID={testID}>
      <View style={styles.wrap}>
        {Icon ? (
          <View style={[styles.well, kind === "empty" ? styles.wellAccent : styles.wellInk]}>
            <Icon size={size.icon} color={kind === "empty" ? colors.accent : colors.ink80} strokeWidth={2} />
          </View>
        ) : null}
        <View style={styles.text}>
          <T variant="body" strong tone="primary">
            {title}
          </T>
          {body ? <T variant="caption">{body}</T> : null}
        </View>
      </View>
      {action || secondary ? (
        <View style={styles.actions}>
          {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} testID={action.testID} variant="secondary" size="md" /> : null}
          {secondary ? <Button label={secondary.label} onPress={secondary.onPress} testID={secondary.testID} variant="ghost" size="md" /> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  well: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  wellAccent: { backgroundColor: colors.accent12 },
  wellInk: { backgroundColor: colors.ink06 },
  text: { flex: 1, gap: space.xxs, paddingTop: space.xxs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
});
