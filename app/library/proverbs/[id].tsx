// One proverb: the Igbo and its recording, the dataset's translation, then
// our draft of what it means and when it's used (or "pending review"), and
// where else it appears, and "Report a problem" (the flag up top and a row at
// the end, as on a dictionary word). The one primary action moves to the next
// proverb.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AkweteBand, Nnenne } from "@/components/art";
import { PlayButton, ReviewTag, SourceNote } from "@/components/feature/library";
import { ReportSheet } from "@/components/feature/practice";
import { ArrowLeft, ArrowRight, BookOpen, Flag, Sprout } from "@/components/glyphs/icons";
import { Button, Card, IconButton, Row, Screen, Section, T } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { MEANING_PENDING, libraryVersion, nextOf, proverbById, proverbsFile } from "@/lib/library";
import { useLibraryAudio } from "@/lib/library/useLibrary";
import { proverbSubject } from "@/lib/state/reportTargets";

export default function ProverbPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const audio = useLibraryAudio();
  const [reporting, setReporting] = useState(false);
  const { proverbs, themes } = proverbsFile();
  const p = id ? proverbById(id) : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library/proverbs"));

  if (!p) {
    return (
      <Screen testID="proverb-missing" center footer={<Button label="Back to the proverbs" onPress={close} testID="proverb-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            We couldn't find this proverb
          </T>
        </View>
      </Screen>
    );
  }

  const next = nextOf(proverbs, p.id);
  const theme = themes.find((t) => t.id === p.theme)?.title ?? "Proverbs";

  return (
    <Screen
      testID="proverb"
      footer={next ? <Button label="Next proverb" icon={ArrowRight} iconPosition="trailing" onPress={() => router.replace({ pathname: "/library/proverbs/[id]", params: { id: next.id } })} testID="proverb-next" block /> : undefined}
    >
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} testID="proverb-back" variant="tinted" />
        <T variant="label" tone="accent" style={styles.flex}>
          {`Ilu · ${theme}`}
        </T>
        <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} variant="tinted" testID="proverb-report-flag" />
      </View>

      <Card variant="ink" padding="none" testID="proverb-card">
        <AkweteBand height={24} />
        <View style={styles.cardBody}>
          <View style={styles.head}>
            <T variant="display" igbo tone="onInk" style={styles.flex} accessibilityRole="header">
              {p.igbo}
            </T>
          </View>
          <View style={styles.playRow}>
            <PlayButton id={p.audio} audio={audio} label={`Play the proverb: ${p.en}`} playKey={`proverb-${p.id}`} testID="proverb-play" onInk />
            <T variant="caption" tone="onInkMuted" style={styles.flex}>
              Recorded by a contributor to the Nkọwa okwu dataset
            </T>
          </View>
        </View>
      </Card>

      <Section title="Translation" testID="proverb-translation">
        <T variant="title" tone="secondary">
          {p.en}
        </T>
        <T variant="caption">{p.literalNote ?? "The dataset's translation. A word-by-word rendering is pending review."}</T>
      </Section>

      <Card variant="flat" testID="proverb-meaning">
        <View style={styles.block}>
          <T variant="label">What it means</T>
          <T variant="body" tone={p.meaning ? "primary" : "muted"}>
            {p.meaning ?? MEANING_PENDING}
          </T>
        </View>
        <View style={styles.rule} />
        <View style={styles.block} testID="proverb-usage">
          <T variant="label">When it's used</T>
          <T variant="body" tone={p.usage ? "primary" : "muted"}>
            {p.usage ?? "Pending review by our cultural advisor."}
          </T>
        </View>
        <View style={styles.tags}>
          <ReviewTag kind="draft" testID="proverb-review" />
        </View>
      </Card>

      {p.seeAlso.length > 0 ? (
        <Section title="Find it in" testID="proverb-see-also">
          <Card variant="flat" padding="md">
            {p.seeAlso.map((s, i) => (
              <Row
                key={`${s.kind}-${s.id}`}
                title={s.title}
                detail={s.kind === "tale" ? "A folktale" : "A custom"}
                icon={s.kind === "tale" ? BookOpen : Sprout}
                divider={i < p.seeAlso.length - 1}
                onPress={() => router.push(s.kind === "tale" ? { pathname: "/library/tales/[id]", params: { id: s.id } } : { pathname: "/library/customs/[id]", params: { id: s.id } })}
                testID={`proverb-see-${i}`}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <View style={styles.end}>
        <SourceNote testID="proverb-source" />
        <Card variant="flat" padding="md">
          <Row title="Report a problem" detail="Spelling, tone, meaning, audio, dialect or culture" icon={Flag} onPress={() => setReporting(true)} testID="proverb-report" />
        </Card>
      </View>

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targets={[proverbSubject(p, libraryVersion())]} testID="proverb-report-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", gap: space.sm },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md },
  cardBody: { padding: space.lg, gap: space.md },
  head: { flexDirection: "row" },
  playRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  block: { gap: space.xs },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong, marginVertical: space.md },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  end: { gap: space.md },
});
