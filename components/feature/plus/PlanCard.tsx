// One plan as a radio card. Guideline 3.1.2(c): the BILLED amount is the
// largest price on the card (title size); a free trial and the per-month
// equivalent sit in the caption line under it. With no StoreKit price (web,
// offline) the card shows only how the plan bills, never a number.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Press, T } from "@/components/ui";
import { colors, radius, shadow, space } from "@/constants/theme";
import { PLAN_COPY, planLines, type PlanId, type PlanQuote } from "@/lib/state";

export interface PlanCardProps {
  plan: PlanId;
  quote: PlanQuote;
  selected: boolean;
  tag?: string | null;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}

export function PlanCard({ plan, quote, selected, tag, disabled, onPress, testID }: PlanCardProps) {
  const copy = PLAN_COPY[plan];
  const lines = planLines(plan, quote);
  const spoken = [copy.label, lines.billed ? `${lines.billed} ${lines.per}` : null, lines.detail, tag].filter(Boolean).join(". ");
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptics="select"
      pressScale={0.98}
      accessibilityRole="radio"
      accessibilityLabel={spoken}
      accessibilityState={{ checked: selected, selected, disabled: !!disabled }}
      style={[styles.card, selected ? styles.on : styles.off]}
    >
      <View style={[styles.ring, selected && styles.ringOn]}>{selected ? <View style={styles.dot} /> : null}</View>
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <T variant="body" strong tone="primary">
            {copy.label}
          </T>
          {tag ? (
            <View style={styles.tag}>
              <T variant="caption" strong tone="reward" numberOfLines={1}>
                {tag}
              </T>
            </View>
          ) : null}
        </View>
        {lines.billed ? (
          <View style={styles.priceRow}>
            <T variant="title" numeric testID={`${testID}-billed`}>
              {lines.billed}
            </T>
            <T variant="body" tone="secondary">
              {lines.per}
            </T>
          </View>
        ) : null}
        <T variant="caption" testID={`${testID}-detail`}>
          {lines.detail}
        </T>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, minHeight: 72 },
  off: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong },
  on: { backgroundColor: colors.accent06, borderColor: colors.ink, borderWidth: 2, padding: space.md - 1, boxShadow: shadow.card },
  ring: { width: 24, height: 24, marginTop: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: "center", justifyContent: "center" },
  ringOn: { borderColor: colors.ink },
  dot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.ink },
  body: { flex: 1, gap: space.xxs },
  labelRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  tag: { paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: colors.reward12 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: space.xs, flexWrap: "wrap" },
});
