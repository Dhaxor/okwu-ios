// One festival or custom: original uli art (none for masquerades), a short
// explainer in English, the words you'll hear and dataset sentences with
// their recordings, how practice varies, links onward, and "Report a
// problem" (the flag up top and a row at the end: the page, a word or a
// sentence). The one primary action opens the next explainer.
import React, { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { CultureArt, IgboLine, PlayButton, ReviewTag, SourceNote, VariesNote, WordChips } from "@/components/feature/library";
import { ReportSheet } from "@/components/feature/practice";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Flag, Users } from "@/components/glyphs/icons";
import { Button, Card, IconButton, Press, Row, Screen, Section, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { customById, customsFile, libraryVersion, nextOf, proverbById } from "@/lib/library";
import { useLibraryAudio } from "@/lib/library/useLibrary";
import { customSubjects } from "@/lib/state/reportTargets";

export default function CustomPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const audio = useLibraryAudio();
  const [reporting, setReporting] = useState(false);
  const { customs } = customsFile();
  const artHeight = useWindowDimensions().height < 760 ? 120 : 156;
  const c = id ? customById(id) : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library/customs"));

  if (!c) {
    return (
      <Screen testID="custom-missing" center footer={<Button label="Back to customs" onPress={close} testID="custom-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            We couldn't find this page
          </T>
        </View>
      </Screen>
    );
  }

  const next = nextOf(customs, c.id);
  const proverb = c.proverb ? proverbById(c.proverb) : undefined;
  const seed = customs.findIndex((x) => x.id === c.id) + 21;

  return (
    <Screen
      testID="custom"
      footer={next ? <Button label={`Next: ${next.title}`} icon={ArrowRight} iconPosition="trailing" onPress={() => router.replace({ pathname: "/library/customs/[id]", params: { id: next.id } })} testID="custom-next" block /> : undefined}
    >
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} testID="custom-back" variant="tinted" />
        <T variant="label" tone="accent" style={styles.flex}>
          Festivals and customs
        </T>
        <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} variant="tinted" testID="custom-report-flag" />
      </View>

      <View style={styles.head}>
        {c.motif === "none" ? (
          <Card variant="sunk" testID="custom-no-images">
            <T variant="body" tone="muted">
              Out of respect, this page has no pictures. Okwu never draws masquerades.
            </T>
          </Card>
        ) : (
          <Card padding="none">
            <CultureArt motif={c.motif} seed={seed} height={artHeight} field testID="custom-art" />
          </Card>
        )}
        <T variant="title" igbo tone="accent">
          {c.kicker}
        </T>
        <T variant="display" accessibilityRole="header">
          {c.title}
        </T>
        <T variant="body" tone="muted">
          {c.summary}
        </T>
      </View>

      <View style={styles.sections} testID="custom-sections">
        {c.sections.map((s) => (
          <View key={s.h} style={styles.block}>
            <T variant="title">{s.h}</T>
            <T variant="body" tone="primary" style={styles.para}>
              {s.p}
            </T>
          </View>
        ))}
      </View>

      <VariesNote text={c.varies} testID="custom-varies" />

      {c.words.length > 0 ? (
        <Section title="Words you'll hear" testID="custom-words">
          <WordChips words={c.words} audio={audio} testID="custom-word" />
        </Section>
      ) : null}

      {c.lines.length > 0 ? (
        <Section title="Hear it in a sentence" testID="custom-lines">
          <Card variant="flat" padding="md">
            {c.lines.map((l, i) => (
              <IgboLine key={l.igbo} line={l} audio={audio} divider={i < c.lines.length - 1} testID={`custom-line-${i}`} />
            ))}
          </Card>
        </Section>
      ) : null}

      {proverb ? (
        <Section title="A proverb that goes with it" testID="custom-proverb">
          <Card padding="none">
            <View style={styles.proverb}>
              <View style={styles.flex}>
                <T variant="title" igbo>
                  {proverb.igbo}
                </T>
                <T variant="body" tone="muted">
                  {proverb.en}
                </T>
              </View>
              <PlayButton id={proverb.audio} audio={audio} label={`Play the proverb: ${proverb.en}`} playKey={`custom-proverb-${proverb.id}`} testID="custom-proverb-play" />
            </View>
            <Press testID="custom-proverb-open" onPress={() => router.push({ pathname: "/library/proverbs/[id]", params: { id: proverb.id } })} pressScale={1} haptics="select" accessibilityLabel="What the proverb means" style={styles.foot}>
              <BookOpen size={size.iconSm} color={colors.accent} strokeWidth={2} />
              <T variant="caption" strong tone="accent">
                What it means
              </T>
            </Press>
          </Card>
        </Section>
      ) : null}

      {c.links.length > 0 ? (
        <Card variant="flat" padding="md" testID="custom-links">
          {c.links.map((l, i) =>
            l === "calendar" ? (
              <Row key={l} title="Market-day calendar" detail="Today and the next 28 days" icon={CalendarDays} divider={i < c.links.length - 1} onPress={() => router.push("/library/calendar")} testID="custom-link-calendar" />
            ) : (
              <Row key={l} title="The names book" detail="Igbo names and what they mean" icon={Users} divider={i < c.links.length - 1} onPress={() => router.push("/library/names")} testID="custom-link-names" />
            )
          )}
        </Card>
      ) : null}

      <View style={styles.tags}>
        <ReviewTag kind="draft" testID="custom-review" />
      </View>
      <SourceNote text="Explainer written in English by Okwu, pending review by a cultural advisor. Igbo words, sentences and recordings: Nkọwa okwu (Igbo API), CC BY 4.0, used with permission." testID="custom-source" />
      <Card variant="flat" padding="md">
        <Row title="Report a problem" detail="Spelling, tone, meaning, audio, dialect or culture" icon={Flag} onPress={() => setReporting(true)} testID="custom-report" />
      </Card>

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targets={customSubjects(c, libraryVersion())} pickLabel="Which one" testID="custom-report-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", gap: space.sm },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md },
  head: { gap: space.xs },
  sections: { gap: space.lg },
  block: { gap: space.xs },
  para: { lineHeight: 28 },
  proverb: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.lg, paddingBottom: space.md },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: size.tapMin + space.xs,
    paddingHorizontal: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
    borderBottomLeftRadius: radius.xl,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
