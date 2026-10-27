// About › Credits: every licensed source, by where it shows (the course
// bundle's credits, the phrasebook, the culture library; the Igbo API line
// always says it is used with permission), what we changed in the
// recordings and the CC BY 4.0 link, then the type and icons.
import React from "react";
import { Linking, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { OkwuMark } from "@/components/art";
import { ExternalLink } from "@/components/glyphs/icons";
import { Card, IconButton, Screen, ScreenHeader, Section, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { CC_BY_4_URL, RECORDINGS_CHANGED_NOTE, creditSections, useContent } from "@/lib/state";
import { libraryMeta } from "@/lib/library";
import { phrasebookCredit } from "@/lib/phrasebook";
import { useBack } from "@/components/feature/shell/useBack";

const BUILT_WITH: readonly { name: string; detail: string }[] = [
  { name: "Gentium Book Plus and Andika", detail: "Typefaces by SIL International, SIL Open Font License 1.1" },
  { name: "Lucide", detail: "Icons, ISC License" },
  { name: "Expo and React Native", detail: "MIT License" },
];

export default function CreditsScreen() {
  const back = useBack("/settings");
  const { bundle, status } = useContent();
  // The course (the bundle), the phrasebook and the library each credit their sources (CC BY 4.0).
  const sections = bundle ? creditSections({ course: bundle.credits, phrasebook: phrasebookCredit(), library: libraryMeta().credits }) : [];
  return (
    <Screen testID="credits">
      <ScreenHeader eyebrow="About" title="Credits" subtitle="Okwu is made with the help of people who have recorded and written down Igbo for years. Thank you." onBack={back} testID="credits-header" />
      <Section title="Words and recordings" testID="credits-content">
        <Card variant="flat" padding="md">
          {status === "loading" ? (
            <T variant="body" tone="muted">
              Loading…
            </T>
          ) : sections.length ? (
            sections.map((sec, si) => (
              <View key={sec.id} style={si < sections.length - 1 ? styles.section : undefined} testID={`credits-${sec.id}`}>
                <T variant="label" style={styles.sectionTitle}>
                  {sec.title}
                </T>
                {sec.lines.map((c, i) => (
                  <View key={c.id} style={[styles.credit, i < sec.lines.length - 1 && styles.gap]} testID={`credits-${c.id}`}>
                    <T variant="body" tone="primary" style={styles.flex}>
                      {c.text}
                    </T>
                    {c.url ? <IconButton icon={ExternalLink} accessibilityLabel={`Open ${c.url}`} onPress={() => void Linking.openURL(c.url!).catch(() => {})} testID={`credits-${c.id}-link`} /> : null}
                  </View>
                ))}
              </View>
            ))
          ) : (
            <T variant="body" tone="secondary">
              All words and recordings in this version were made for Okwu.
            </T>
          )}
          {sections.length ? (
            <>
              <T variant="caption" style={styles.more} testID="credits-changed">
                {RECORDINGS_CHANGED_NOTE}
              </T>
              <View style={[styles.credit, styles.licence]}>
                <T variant="body" tone="primary" style={styles.flex}>
                  Licence: Creative Commons Attribution 4.0 (CC BY 4.0)
                </T>
                <IconButton icon={ExternalLink} accessibilityLabel={`Open ${CC_BY_4_URL}`} onPress={() => void Linking.openURL(CC_BY_4_URL).catch(() => {})} testID="credits-licence-link" />
              </View>
            </>
          ) : null}
          <T variant="caption" style={styles.more}>
            Every word in a lesson is checked by native speakers before it ships. Lessons still in review say so.
          </T>
        </Card>
      </Section>
      <Section title="Built with" testID="credits-built">
        <Card variant="flat" padding="md">
          {BUILT_WITH.map((b, i) => (
            <View key={b.name} style={i < BUILT_WITH.length - 1 ? styles.gap : undefined}>
              <T variant="body" tone="primary">
                {b.name}
              </T>
              <T variant="caption">{b.detail}</T>
            </View>
          ))}
        </Card>
      </Section>
      <View style={styles.mark}>
        <OkwuMark size={48} />
        <T variant="caption" center>
          {`Okwu ${Constants.expoConfig?.version ?? ""}${bundle ? ` · content ${bundle.version}` : ""}`}
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  credit: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  gap: { marginBottom: space.md },
  more: { marginTop: space.md },
  section: { marginBottom: space.lg },
  sectionTitle: { marginBottom: space.xs },
  licence: { marginTop: space.sm },
  mark: { alignItems: "center", gap: space.xs },
});
