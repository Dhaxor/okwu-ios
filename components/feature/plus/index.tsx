// Okwu Plus UI (screens D3): the plan cards, what stays free, what Plus
// adds, the legal footer, the purchase actions shared by the paywall and
// Settings, and a small lock for gated places.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AudioLines, BookOpen, Check, Download, Languages, Lock, Sparkles, type IconComponent } from "@/components/glyphs/icons";
import { Card, Press, T, useToast } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { FREE_FOREVER, LEGAL_URLS, PLUS_BENEFITS, RENEWAL_TERMS, purchaseMessage, usePlus, type PaywallSource, type PlanId, type PlusFeature, type PurchaseResult } from "@/lib/state";

export { PlanCard, type PlanCardProps } from "./PlanCard";

export function FreeForever({ title = "Free forever", testID }: { title?: string; testID: string }) {
  return (
    <Card variant="sunk" padding="md" testID={testID}>
      <T variant="label" tone="success">
        {title}
      </T>
      <View style={styles.list}>
        {FREE_FOREVER.map((f) => (
          <View key={f} style={styles.item}>
            <Check size={size.iconSm} color={colors.success} strokeWidth={2.5} />
            <T variant="body" tone="secondary" style={styles.flex}>
              {f}
            </T>
          </View>
        ))}
      </View>
    </Card>
  );
}

const BENEFIT_ICONS: Record<PlusFeature, IconComponent> = {
  "full-path": BookOpen,
  "tone-trainer": AudioLines,
  "speaking-trainer": AudioLines,
  stories: Sparkles,
  "dialect-lens": Languages,
  "offline-packs": Download,
};

export function Benefits({ owned, testID }: { owned: boolean; testID: string }) {
  return (
    <View style={styles.benefits} testID={testID}>
      {PLUS_BENEFITS.map((b) => {
        const Icon = BENEFIT_ICONS[b.feature];
        return (
          <View key={b.feature} style={styles.benefit}>
            <View style={[styles.benefitIcon, owned && styles.benefitOwned]}>
              <Icon size={size.icon} color={owned ? colors.success : colors.accent} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <T variant="body" strong tone="primary">
                {b.title}
              </T>
              <T variant="caption">{b.detail}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Renewal terms in full, then Restore, Terms of Use and Privacy Policy (each a 44pt target). */
export function LegalFooter({ onRestore, restoring, showManage, onManage, testID }: { onRestore: (() => void) | null; restoring: boolean; showManage: boolean; onManage: () => void; testID: string }) {
  const open = (url: string) => void Linking.openURL(url).catch(() => {});
  return (
    <View style={styles.legal} testID={testID}>
      <T variant="caption" center testID={`${testID}-renewal`}>
        {RENEWAL_TERMS}
      </T>
      <View style={styles.links}>
        {onRestore ? <TextLink label={restoring ? "Restoring…" : "Restore purchases"} onPress={onRestore} disabled={restoring} testID={`${testID}-restore`} /> : null}
        {showManage ? <TextLink label="Manage subscription" onPress={onManage} testID={`${testID}-manage`} /> : null}
        <TextLink label="Terms of Use" onPress={() => open(LEGAL_URLS.terms)} testID={`${testID}-terms`} />
        <TextLink label="Privacy Policy" onPress={() => open(LEGAL_URLS.privacy)} testID={`${testID}-privacy`} />
      </View>
    </View>
  );
}

function TextLink({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID: string }) {
  return (
    <Press testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="link" accessibilityLabel={label} pressScale={0.96} haptics="select" style={styles.link}>
      <T variant="caption" strong tone="secondary" style={styles.linkText}>
        {label}
      </T>
    </Press>
  );
}

/** Purchase and restore with honest, non-blocking feedback; shared by the paywall and Settings. */
export function usePlusActions() {
  const plus = usePlus();
  const toast = useToast();
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!awaiting) return;
    if (plus.isPlus) return setAwaiting(false);
    const t = setTimeout(() => {
      setAwaiting(false);
      toast.show("Your purchase is on its way. Plus turns on as soon as the App Store confirms it.", { duration: 4500 });
    }, 12_000);
    return () => clearTimeout(t);
  }, [awaiting, plus.isPlus, toast]);

  const run = useCallback(async (kind: "buy" | "restore", fn: () => Promise<PurchaseResult>): Promise<PurchaseResult | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(kind);
    try {
      return await fn();
    } catch {
      return "error";
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }, []);

  const buy = useCallback(
    async (plan: PlanId) => {
      const r = await run("buy", () => plus.purchase(plan));
      if (r === null) return null;
      if (r === "purchased" && !plus.isPlus) setAwaiting(true);
      const m = purchaseMessage("buy", r);
      if (m) toast.show(m.message, { tone: m.tone, duration: 4500 });
      return r;
    },
    [run, plus, toast]
  );

  const restore = useCallback(async () => {
    const r = await run("restore", plus.restore);
    if (r === null) return null;
    const m = purchaseMessage("restore", r);
    if (m) toast.show(m.message, { tone: m.tone, duration: 4500 });
    return r;
  }, [run, plus, toast]);

  return { busy, awaiting, buy, restore };
}

/** A quiet lock for a Plus place: tap opens the paywall from that source. */
export function PlusLock({ label, source, testID }: { label: string; source: PaywallSource; testID: string }) {
  const router = useRouter();
  return (
    <Press testID={testID} onPress={() => router.push({ pathname: "/paywall", params: { from: source } })} haptics="select" pressScale={0.98} accessibilityRole="button" accessibilityLabel={`${label}. Part of Okwu Plus.`} style={styles.lock}>
      <Lock size={size.iconSm} color={colors.rewardText} strokeWidth={2} />
      <T variant="caption" strong tone="reward">
        {label}
      </T>
    </Press>
  );
}

export const IS_IOS = Platform.OS === "ios";

const styles = StyleSheet.create({
  list: { gap: space.xs, marginTop: space.sm },
  item: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  benefits: { gap: space.md },
  benefit: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  benefitIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accent12, alignItems: "center", justifyContent: "center" },
  benefitOwned: { backgroundColor: colors.success12 },
  legal: { gap: space.sm },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: space.xs },
  link: { minHeight: size.tapMin, justifyContent: "center", paddingHorizontal: space.sm },
  linkText: { textDecorationLine: "underline", textDecorationColor: colors.ink48 },
  lock: { flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start", minHeight: size.tapMin, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: colors.reward12 },
});
