// Where the library comes from: what is dataset text, what Okwu wrote, what
// is still waiting for review, what we never show, and the credits the
// sources require.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CultureArt } from "@/components/feature/library";
import { Card, Screen, ScreenHeader, Section, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { libraryMeta } from "@/lib/library";

export default function LibraryAbout() {
  const router = useRouter();
  const meta = libraryMeta();
  const c = meta.counts;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library"));

  const facts: [string, string][] = [
    [String(c.names), "names"],
    [String(c.proverbs), "proverbs"],
    [String(c.tales), "tales"],
    [String(c.customs), "customs"],
  ];

  return (
    <Screen testID="library-about-page">
      <ScreenHeader eyebrow="Library" title="Where this comes from" onBack={close} testID="about-header" />

      <Card padding="none">
        <CultureArt motif="circle" seed={9} height={104} field />
        <View style={styles.facts}>
          {facts.map(([n, label]) => (
            <View key={label} style={styles.fact}>
              <T variant="title" numeric tone="accent">
                {n}
              </T>
              <T variant="caption">{label}</T>
            </View>
          ))}
        </View>
      </Card>

      <Section title="From the dataset" testID="about-dataset">
        <T variant="body">
          Every Igbo word, name, proverb and sentence in the library, and every recording, comes from the Nkọwa okwu (Igbo API) dataset, used with permission under CC BY 4.0. Nothing in Igbo was written by AI. Okwu's native reviewers haven't checked these entries yet; until they do, each one is marked "Not yet reviewed".
        </T>
      </Section>

      <Section title="Written by Okwu" testID="about-ours">
        <T variant="body">
          The meanings and usage notes for proverbs, the groupings and breakdowns of names, the retold folktales and the custom explainers are our own English, waiting for review by a cultural advisor. The tales are original retellings of traditional stories, not copies of any published version.
        </T>
      </Section>

      <Section title="Waiting for review" testID="about-waiting">
        <T variant="body">
          {`${c.heldBack} more proverbs found in the dataset are held back until our cultural advisor decides how, or whether, to share them. The market-day calendar follows your own cycle until the advisor confirms a verified date.`}
        </T>
      </Section>

      <Section title="What we never show" testID="about-never">
        <T variant="body">
          No masquerade or mask imagery, no deities or shrines as objects, no sacred nsibidi, no title regalia, and no political symbols. Kola is taught as a custom of respect, never as a reward. Mbe the tortoise lives only in the tales. Regional ways of speaking are never ranked.
        </T>
      </Section>

      <Section title="Credits" testID="about-credits">
        <View style={styles.credits}>
          {meta.credits.map((line) => (
            <View key={line} style={styles.credit}>
              <T variant="body" tone="primary">
                {line}
              </T>
            </View>
          ))}
        </View>
        <T variant="caption">{`Library data built ${meta.builtAt}.`}</T>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: "row", paddingVertical: space.md },
  fact: { flex: 1, alignItems: "center" },
  credits: { gap: space.sm },
  credit: { padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
});
