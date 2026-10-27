// List rows (settings, menus, dictionary results) and the section heading
// that groups them. A row with onPress is a button; one with `trailing`
// (a Switch, a value) is a static row that hosts its own control.
import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, size, space } from "@/constants/theme";
import { ChevronRight, type IconComponent } from "@/components/glyphs/icons";
import { Press } from "./Press";
import { T } from "./T";

export interface RowProps {
  title: string;
  testID: string;
  detail?: string;
  icon?: IconComponent;
  onPress?: () => void;
  trailing?: React.ReactNode;
  igbo?: boolean;
  /** Draw a hairline under the row (all but the last in a group). */
  divider?: boolean;
}

export function Row({ title, testID, detail, icon: Icon, onPress, trailing, igbo, divider = false }: RowProps) {
  const body = (
    <>
      {Icon ? (
        <View style={styles.iconWell}>
          <Icon size={size.iconSm} color={colors.ink} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.text}>
        <T variant="body" tone="primary" igbo={igbo} numberOfLines={1}>
          {title}
        </T>
        {detail ? (
          <T variant="caption" numberOfLines={2}>
            {detail}
          </T>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={size.iconSm} color={colors.ink48} strokeWidth={2} /> : null)}
    </>
  );
  const look = [styles.row, divider && styles.divider];
  if (onPress) {
    return (
      <Press testID={testID} onPress={onPress} pressScale={1} haptics="select" accessibilityLabel={detail ? `${title}, ${detail}` : title} style={look}>
        {body}
      </Press>
    );
  }
  return (
    <View testID={testID} style={look}>
      {body}
    </View>
  );
}

export interface SectionProps {
  title: string;
  children?: React.ReactNode;
  /** A small action at the right of the heading. */
  action?: React.ReactNode;
  testID?: string;
}

/** A labelled group. Space above a section is twice the space inside it. */
export function Section({ title, children, action, testID }: SectionProps) {
  return (
    <View testID={testID} style={styles.section}>
      <View style={styles.sectionHead}>
        <T variant="label" accessibilityRole="header">
          {title}
        </T>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.ink06,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: size.tapMin - space.xs },
});
