// The tale reader. "English" reads the retelling with the Igbo lines set in
// it, each with its recording and translation. "Igbo" shows the Igbo lines
// alone for listening, the English behind a tap, until a native storyteller
// records a full Igbo telling. "Report a problem" (the flag up top and a row
// at the end) offers the tale's Igbo lines. The one primary action opens the
// next tale.
import React, { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { CultureArt, IgboLine, ReviewTag, SourceNote } from "@/components/feature/library";
import { ReportSheet } from "@/components/feature/practice";
import { ArrowLeft, ArrowRight, Flag } from "@/components/glyphs/icons";
import { Button, Card, IconButton, Row, Screen, Segmented, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { libraryVersion, nextOf, taleById, talesFile } from "@/lib/library";
import { useLibraryAudio } from "@/lib/library/useLibrary";
import { taleLineSubjects } from "@/lib/state/reportTargets";

type Mode = "en" | "ig";

export default function TaleReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const audio = useLibraryAudio();
  const [mode, setMode] = useState<Mode>("en");
  const [reporting, setReporting] = useState(false);
  // On short phones the art steps back so the story starts sooner.
  const artHeight = useWindowDimensions().height < 760 ? 112 : 148;
  const { tales } = talesFile();
  const tale = id ? taleById(id) : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library/tales"));

  if (!tale) {
    return (
      <Screen testID="tale-missing" center footer={<Button label="Back to the tales" onPress={close} testID="tale-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            We couldn't find this tale
          </T>
        </View>
      </Screen>
    );
  }

  const next = nextOf(tales, tale.id);
  const lines = tale.parts.flatMap((p) => (p.kind === "line" ? [p] : []));
  const seed = tales.findIndex((t) => t.id === tale.id) + 11;

  return (
    <Screen
      testID="tale"
      footer={next ? <Button label={`Next: ${next.title}`} icon={ArrowRight} iconPosition="trailing" onPress={() => router.replace({ pathname: "/library/tales/[id]", params: { id: next.id } })} testID="tale-next" block /> : undefined}
    >
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} testID="tale-back" variant="tinted" />
        <T variant="label" tone="accent" style={styles.flex}>
          {`Akụkọ · ${tale.minutes} min`}
        </T>
        {lines.length > 0 ? <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} variant="tinted" testID="tale-report-flag" /> : null}
      </View>

      <View style={styles.head}>
        <Card padding="none">
          <CultureArt motif={tale.motif} seed={seed} height={artHeight} field />
        </Card>
        <T variant="display" accessibilityRole="header">
          {tale.title}
        </T>
        <T variant="body" tone="muted">
          {tale.told}
        </T>
      </View>

      <Segmented<Mode>
        options={[
          { value: "en", label: "English" },
          { value: "ig", label: "Igbo lines" },
        ]}
        value={mode}
        onChange={setMode}
        accessibilityLabel="Read in English, or listen to the Igbo lines"
        testID="tale-mode"
      />

      {mode === "en" ? (
        <View style={styles.story} testID="tale-story">
          {tale.parts.map((p, i) =>
            p.kind === "p" ? (
              <T key={i} variant="body" tone="primary" style={styles.para}>
                {p.text}
              </T>
            ) : (
              <View key={i} style={styles.quote}>
                <View style={styles.quoteBar} />
                <View style={styles.flex}>
                  <IgboLine line={p} audio={audio} size="title" testID={`tale-line-${i}`} />
                </View>
              </View>
            )
          )}
        </View>
      ) : (
        <View style={styles.story} testID="tale-igbo">
          <Card variant="sunk">
            <T variant="body" tone="muted">
              A full Igbo telling will come from a native storyteller. Until then, listen to the Igbo lines from this tale, then tap to check the English.
            </T>
          </Card>
          <Card variant="flat" padding="md">
            {lines.map((l, i) => (
              <IgboLine key={`${l.igbo}-${i}`} line={l} audio={audio} size="title" reveal divider={i < lines.length - 1} testID={`tale-igbo-${i}`} />
            ))}
          </Card>
        </View>
      )}

      <Card testID="tale-moral">
        <View style={styles.moral}>
          <T variant="label">What the tale teaches</T>
          <T variant="title">{tale.moral}</T>
        </View>
      </Card>

      <View style={styles.credit}>
        <View style={styles.tags}>
          <ReviewTag kind="draft" testID="tale-review" />
        </View>
        <T variant="caption">{`Okwu's own retelling of the traditional tale "${tale.outline}". Not copied from any published version.`}</T>
      </View>
      <SourceNote testID="tale-source" />
      {lines.length > 0 ? (
        <Card variant="flat" padding="md">
          <Row title="Report a problem" detail="One of the Igbo lines: spelling, tone, meaning or audio" icon={Flag} onPress={() => setReporting(true)} testID="tale-report" />
        </Card>
      ) : null}

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targets={taleLineSubjects(tale, libraryVersion())} testID="tale-report-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", gap: space.sm },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md },
  head: { gap: space.sm },
  story: { gap: space.lg },
  para: { lineHeight: 28 },
  quote: { flexDirection: "row", gap: space.md, paddingVertical: space.xs, paddingRight: space.xs, borderRadius: radius.lg, backgroundColor: colors.surface },
  quoteBar: { width: 3, marginLeft: space.md, marginVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.accent },
  moral: { gap: space.xs },
  credit: { gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
