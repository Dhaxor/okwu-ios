// A name's page: the name and its recording, the dataset's meaning (or an
// honest "pending review"), a literal breakdown where every part is a
// dataset word, the market day it remembers, regional forms and sentences
// with their recordings, and "Report a problem" (the flag up top and a row at
// the end). The one primary action keeps it as a family name.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { IgboLine, PlayButton, ReviewTag, SourceNote, WordChips } from "@/components/feature/library";
import { ReportSheet } from "@/components/feature/practice";
import { ArrowLeft, BookOpen, CalendarDays, Flag, Star } from "@/components/glyphs/icons";
import { Button, Card, IconButton, Row, Screen, Section, T, useToast } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { MEANING_PENDING, calendarFile, libraryVersion, nameById, namesFile } from "@/lib/library";
import { useFamilyNames, useLibraryAudio } from "@/lib/library/useLibrary";
import { nameSubject } from "@/lib/state/reportTargets";

export default function NamePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const audio = useLibraryAudio();
  const family = useFamilyNames();
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const name = id ? nameById(id) : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library/names"));

  if (!name) {
    return (
      <Screen testID="name-missing" center footer={<Button label="Back to the names book" onPress={close} testID="name-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            We couldn't find this name
          </T>
          <T variant="body" tone="muted" center>
            It may have moved in a newer edition of the book. Search for it again.
          </T>
        </View>
      </Screen>
    );
  }

  const theme = namesFile().themes.find((t) => t.id === name.theme);
  const day = name.day ? calendarFile().days.find((d) => d.id === name.day) : undefined;
  const saved = family.isSaved(name.id);
  const showToned = name.toned && name.toned !== name.spelling;

  const toggle = () => {
    if (saved) {
      family.remove(`book:${name.id}`);
      toast.show(`${name.spelling} removed from your family names`);
    } else {
      family.saveBook(name);
      toast.show(`${name.spelling} kept in your family names`, { tone: "success" });
    }
  };

  return (
    <Screen
      testID="name"
      footer={
        <Button
          label={saved ? "Kept in your family names" : "Keep as a family name"}
          icon={Star}
          variant={saved ? "secondary" : "primary"}
          onPress={toggle}
          accessibilityHint={saved ? "Removes it from your family names" : "Keeps it on this phone"}
          testID="name-save"
          block
        />
      }
    >
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} testID="name-back" variant="tinted" />
        <T variant="label" tone="accent" style={styles.flex}>
          {theme?.title ?? "Names"}
        </T>
        <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} variant="tinted" testID="name-report-flag" />
      </View>

      <Card testID="name-hero">
        <View style={styles.hero}>
          <View style={styles.flex}>
            <T variant="display" igbo accessibilityRole="header">
              {name.spelling}
            </T>
            {showToned ? (
              <T variant="body" tone="muted">
                {"Said "}
                <T variant="body" igbo tone="secondary">
                  {name.toned}
                </T>
              </T>
            ) : null}
            {name.datasetSpelling ? <T variant="caption">{`Dataset spelling: ${name.datasetSpelling}`}</T> : null}
          </View>
          <PlayButton id={name.audio} audio={audio} label={`Play ${name.spelling}`} playKey={`name-${name.id}`} testID="name-play" />
        </View>
        <View style={styles.meaning}>
          <T variant="label">Meaning</T>
          <T variant="title" tone={name.meaning ? "primary" : "muted"}>
            {name.meaning ?? MEANING_PENDING}
          </T>
          <T variant="caption">{name.meaning ? "From the Nkọwa okwu dataset" : "This name appears in the dataset without a definition. A native reviewer will add its meaning."}</T>
        </View>
      </Card>

      {name.parts.length > 0 ? (
        <Section title="Word by word" testID="name-parts">
          <WordChips words={name.parts} audio={audio} testID="name-part" />
          <T variant="caption">Each part is a word from the dataset. The breakdown is ours, pending cultural review.</T>
        </Section>
      ) : null}

      {day ? (
        <Section title="Market day" testID="name-day">
          <Card variant="flat" padding="md">
            <Row title={`Born on ${day.spelling}`} igbo detail={day.label} icon={CalendarDays} onPress={() => router.push("/library/calendar")} testID="name-day-row" />
          </Card>
        </Section>
      ) : null}

      {name.variants.length > 0 ? (
        <Section title="Also said as" testID="name-variants">
          <Card variant="flat" padding="md">
            {name.variants.map((v, i) => (
              <View key={`${v.spelling}-${i}`} style={[styles.variant, i < name.variants.length - 1 && styles.divider]} testID={`name-variant-${i}`}>
                <View style={styles.flex}>
                  <T variant="title" igbo>
                    {v.spelling}
                  </T>
                  <T variant="caption">
                    {"in "}
                    <T variant="caption" igbo tone="secondary">
                      {v.where.join(", ")}
                    </T>
                  </T>
                </View>
                <PlayButton id={v.audio} audio={audio} label={`Play ${v.spelling}, as said in ${v.where.join(", ")}`} playKey={`variant-${name.id}-${i}`} testID={`name-variant-${i}-play`} />
              </View>
            ))}
          </Card>
          <T variant="caption">Regional forms are never ranked. Some are other names with the same meaning.</T>
        </Section>
      ) : null}

      {name.examples.length > 0 ? (
        <Section title="In a sentence" testID="name-examples">
          <Card variant="flat" padding="md">
            {name.examples.map((e, i) => (
              <IgboLine key={e.igbo} line={e} audio={audio} divider={i < name.examples.length - 1} testID={`name-example-${i}`} />
            ))}
          </Card>
        </Section>
      ) : null}

      {name.dictId ? (
        <Card variant="flat" padding="md">
          <Row title="Open in the dictionary" detail="Pitch line, tones and more" icon={BookOpen} onPress={() => router.push({ pathname: "/practice/dictionary/[id]", params: { id: name.dictId! } })} testID="name-dictionary" />
        </Card>
      ) : null}

      <View style={styles.tags}>
        <ReviewTag kind="dataset" testID="name-unreviewed" />
      </View>
      <View style={styles.end}>
        <SourceNote testID="name-source" />
        <Card variant="flat" padding="md">
          <Row title="Report a problem" detail="Spelling, tone, meaning, audio, dialect or culture" icon={Flag} onPress={() => setReporting(true)} testID="name-report" />
        </Card>
      </View>

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targets={[nameSubject(name, libraryVersion())]} testID="name-report-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", gap: space.sm },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md },
  meaning: { gap: space.xxs, marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  variant: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  end: { gap: space.md },
});
