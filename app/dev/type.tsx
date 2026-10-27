// Igbo type test: every letter, every tone-marked vowel and nasal, at every
// size, with line boxes outlined so a clipped mark is visible at a glance.
// Development only. Re-run the screenshots whenever a font or size changes.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, Screen, ScreenHeader, Section, T } from "@/components/ui";
import { colors, radius, space, typeScale, type TypeVariant } from "@/constants/theme";
import { TONE_SET } from "@/lib/content/draftSamples";
import { IGBO_LETTERS, IGBO_VOWELS, TONE_MARK, graphemeCount, nfc, upperLetter } from "@/lib/igbo/text";

const MARKS = [TONE_MARK.high, TONE_MARK.low, TONE_MARK.downstep];
const toned = (base: string) => MARKS.map((m) => nfc(base + m));
const NASALS = ["m", "n", "ṅ"].flatMap(toned);
const STACK = nfc("ị́ ọ̀ ụ̄ Ị́ Ọ̀ Ụ̄");
const STACK_RUN = nfc("ị́ọ̀ụ̄");
const VARIANTS: TypeVariant[] = ["display", "title", "body", "caption"];
const codePoints = (s: string) =>
  Array.from(s)
    .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");

export default function TypeTest() {
  const router = useRouter();
  const decomposed = "ị́";
  const word = TONE_SET[3]?.text ?? "";
  return (
    <Screen testID="type-test">
      <ScreenHeader eyebrow="Gentium Book Plus · Andika" title="Igbo type test" subtitle="36 letters, three tones, every size." onBack={() => router.back()} testID="type-header" />

      <Section title="The alphabet" testID="type-alphabet">
        <View style={styles.grid}>
          {IGBO_LETTERS.map((l) => (
            <View key={l} style={styles.tile}>
              <T variant="title" igbo center>
                {l}
              </T>
              <T variant="caption" igbo center tone="muted">
                {upperLetter(l, true)}
              </T>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Tone-marked vowels" testID="type-vowels">
        <Card padding="md">
          {IGBO_VOWELS.map((v) => (
            <View key={v} style={styles.vowelRow}>
              <T variant="title" igbo tone="accent" style={styles.vowelBase}>
                {v}
              </T>
              {toned(v).map((t) => (
                <T key={t} variant="title" igbo style={styles.vowelCell}>
                  {t}
                </T>
              ))}
              {toned(upperLetter(v)).map((t) => (
                <T key={t} variant="title" igbo style={styles.vowelCell}>
                  {t}
                </T>
              ))}
            </View>
          ))}
          <View style={styles.nasals}>
            <T variant="label">Syllabic nasals</T>
            <T variant="title" igbo>
              {NASALS.join("  ")}
            </T>
          </View>
        </Card>
      </Section>

      <Section title="Every size, line boxes outlined" testID="type-sizes">
        <Card padding="md">
          {VARIANTS.map((v) => (
            <View key={v} style={styles.sizeRow}>
              <T variant="caption" tone="faint">
                {`${v} ${typeScale[v].fontSize}`}
              </T>
              <View style={styles.box}>
                <T variant={v} igbo>
                  {`${STACK} ${word}`}
                </T>
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Both faces" testID="type-faces">
        <Card padding="md">
          <T variant="caption">Andika (interface)</T>
          <T variant="body" tone="primary">
            {nfc(`${STACK} ${TONE_SET.map((w) => w.text).join(" ")}`)}
          </T>
          <T variant="caption" style={styles.gap}>
            Gentium Book Plus (Igbo)
          </T>
          <T variant="body" igbo tone="primary">
            {`${STACK} ${TONE_SET.map((w) => w.text).join(" ")}`}
          </T>
        </Card>
      </Section>

      <Section title="Normalisation" testID="type-nfc">
        <Card variant="sunk" padding="md">
          <T variant="caption">i + dot below + acute, decomposed:</T>
          <T variant="body" numeric tone="primary">
            {codePoints(decomposed)}
          </T>
          <T variant="caption" style={styles.gap}>
            after NFC (no precomposed form exists, so two code points):
          </T>
          <T variant="body" numeric tone="primary">
            {`${codePoints(nfc(decomposed))}  →  `}
            <T variant="body" igbo tone="primary">
              {nfc(decomposed)}
            </T>
          </T>
          <T variant="caption" style={styles.gap}>
            {`${STACK_RUN}: ${STACK_RUN.length} UTF-16 units, ${graphemeCount(STACK_RUN)} letters (limits count letters)`}
          </T>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tile: {
    width: 52,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  vowelRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  vowelBase: { width: 36 },
  vowelCell: { flex: 1, textAlign: "center" },
  nasals: { marginTop: space.md, gap: space.xxs },
  sizeRow: { gap: space.xxs, marginBottom: space.md },
  box: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent, borderStyle: "dashed", alignSelf: "flex-start" },
  gap: { marginTop: space.sm },
});
