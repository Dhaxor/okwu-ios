// Okwu Plus, the honest version. What stays free comes first; then what
// Plus adds; then four plans with StoreKit's own prices. Guideline
// 3.1.2(c): on every plan the billed amount is the biggest price, the trial
// and per-month figure are smaller, and the button never carries a price.
// With no StoreKit prices (web, offline) the plans stay neutral. Shown softly
// once after the first lesson (never mid-lesson), and where a learner
// reaches for something in Plus. `?from=` sets the heading.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AkweteBand, Nnenne } from "@/components/art";
import { Benefits, FreeForever, LegalFooter, PlanCard, usePlusActions } from "@/components/feature/plus";
import { X } from "@/components/glyphs/icons";
import { Button, Card, IconButton, Screen, Section, T, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { DEFAULT_PLAN, PLAN_ORDER, anyPrice, buyLabel, demoPricesRequested, demoQuotes, paywallCopy, paywallSource, pricesMissing, usePlus, yearlyIsBetterValue, type PlanId } from "@/lib/state";

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const source = paywallSource(params.from);
  const toast = useToast();
  const plus = usePlus();
  const actions = usePlusActions();
  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN);

  const demo = useMemo(demoPricesRequested, []);
  const quotes = demo ? demoQuotes() : plus.quotes;
  const priced = anyPrice(quotes);
  useEffect(() => {
    if (!demo && pricesMissing(plus.quotes)) plus.reloadPrices();
    // On open only; the provider keeps retrying after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The peak: Plus turns on while this screen is open.
  const was = useRef(plus.isPlus);
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    if (!was.current && plus.isPlus) {
      setJoined(true);
      toast.show("Welcome to Okwu Plus. Thank you.", { tone: "success" });
    }
    was.current = plus.isPlus;
  }, [plus.isPlus, toast]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const copy = paywallCopy(source);

  const footer = plus.isPlus ? (
    <Button label={joined ? "Start learning" : "Done"} onPress={close} testID="paywall-done" block />
  ) : (
    <>
      <Button label={buyLabel(plan, quotes[plan])} onPress={() => void actions.buy(plan)} loading={actions.busy === "buy" || actions.awaiting} disabled={actions.busy === "restore"} testID="paywall-buy" accessibilityHint={priced ? undefined : "The App Store shows the price before you confirm"} block />
      <Button label="Not now" variant="ghost" onPress={close} testID="paywall-not-now" block />
    </>
  );

  return (
    <Screen testID="paywall" footer={footer}>
      <View style={styles.top}>
        <T variant="label" tone="accent">
          Okwu Plus
        </T>
        <IconButton icon={X} variant="tinted" accessibilityLabel="Close" onPress={close} testID="paywall-close" />
      </View>

      <Card variant="ink" padding="none" testID="paywall-hero">
        <AkweteBand height={24} />
        <View style={styles.hero}>
          <View style={styles.flex}>
            <T variant="display" tone="onInk" accessibilityRole="header" testID="paywall-title">
              {plus.isPlus ? "You have Okwu Plus" : copy.title}
            </T>
            <T variant="body" tone="onInkMuted" testID="paywall-lead">
              {plus.isPlus ? "Every unit, every story and the trainers are open. Thank you for supporting real voices and careful review." : copy.lead}
            </T>
          </View>
          <Nnenne size={64} ground="ochre" mood={plus.isPlus ? "glad" : undefined} />
        </View>
      </Card>

      <FreeForever title={plus.isPlus ? "Still free, for everyone" : "Free forever"} testID="paywall-free" />

      <Section title={plus.isPlus ? "Yours with Plus" : "What Plus adds"} testID="paywall-benefits">
        <Benefits owned={plus.isPlus} testID="paywall-benefit-list" />
      </Section>

      {!plus.isPlus ? (
        <Section title="Choose a plan" testID="paywall-plans">
          <View style={styles.plans} accessibilityRole="radiogroup" accessibilityLabel="Plans">
            {PLAN_ORDER.map((p) => (
              <PlanCard
                key={p}
                plan={p}
                quote={quotes[p]}
                selected={plan === p}
                tag={p === "yearly" && yearlyIsBetterValue(quotes) ? "Best value" : p === "family" ? "For the whole family" : null}
                disabled={actions.busy !== null}
                onPress={() => setPlan(p)}
                testID={`plan-${p}`}
              />
            ))}
          </View>
          <T variant="caption" center testID="paywall-price-note">
            {priced ? "Prices come from the App Store, in your currency." : Platform.OS === "ios" ? "The App Store shows your price, in your currency, before you confirm." : "Purchases work in the iPhone app, where the App Store shows your price."}
          </T>
        </Section>
      ) : null}

      <LegalFooter
        onRestore={plus.isPlus ? null : () => void actions.restore()}
        restoring={actions.busy === "restore"}
        showManage={plus.isPlus && plus.plan === "subscription" && Platform.OS === "ios"}
        onManage={() => void plus.manageSubscriptions()}
        testID="paywall-legal"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hero: { flexDirection: "row", alignItems: "flex-end", gap: space.md, padding: space.lg },
  flex: { flex: 1, gap: space.sm },
  plans: { gap: space.sm },
});
