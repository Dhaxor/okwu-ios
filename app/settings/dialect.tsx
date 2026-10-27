// Home dialect: the regional forms Okwu accepts as answers for you, on top of
// Standard Igbo (always on). Names come from the dictionary's registry, in
// alphabetical order: we never rank dialects.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Row, Screen, ScreenHeader, Switch, T } from "@/components/ui";
import { space } from "@/constants/theme";
import type { DialectId } from "@/lib/content/types";
import { dialectOptions, toggleDialect, useDialectLabels, usePlus, useProfile } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

export default function DialectScreen() {
  const router = useRouter();
  const back = useBack("/settings");
  const { profile, set } = useProfile();
  const plus = usePlus();
  const labels = useDialectLabels();
  const options = dialectOptions(labels);

  return (
    <Screen testID="dialect">
      <ScreenHeader eyebrow="Settings" title="Home dialect" subtitle="Where your family is from. Okwu then accepts those forms as right answers, alongside Standard Igbo." onBack={back} testID="dialect-header" />
      <Card variant="flat" padding="md" testID="dialect-list">
        <Row title="Standard Igbo (Igbo Izugbe)" detail="Always on" testID="dialect-standard" divider={options.length > 0} trailing={<Switch value onValueChange={() => {}} disabled accessibilityLabel="Standard Igbo, always on" testID="dialect-standard-switch" />} />
        {options.length === 0 ? (
          <T variant="caption" style={styles.loading}>
            Loading the list of places…
          </T>
        ) : (
          options.map((o, i) => {
            const on = profile.dialects.includes(o.id as DialectId);
            return (
              <Row
                key={o.id}
                title={o.label}
                igbo
                testID={`dialect-${o.id}`}
                divider={i < options.length - 1}
                trailing={<Switch value={on} onValueChange={(v) => set((p) => toggleDialect(p, o.id as DialectId, v))} accessibilityLabel={o.label} testID={`dialect-${o.id}-switch`} />}
              />
            );
          })
        )}
      </Card>
      {!plus.isPlus ? (
        <View style={styles.lens} testID="dialect-lens">
          <T variant="caption">The dialect lens, which plays how words are said in other places, is part of Okwu Plus.</T>
          <Button label="About the dialect lens" variant="ghost" size="sm" onPress={() => router.push({ pathname: "/paywall", params: { from: "dialect-lens" } })} testID="dialect-lens-plus" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: space.sm },
  lens: { gap: space.xxs, alignItems: "flex-start" },
});
