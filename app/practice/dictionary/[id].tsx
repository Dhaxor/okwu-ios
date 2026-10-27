// A dictionary word page: the headword with its tone layer and pitch line,
// its recording, word class and meanings; "Also said as …" with each area's
// own recording (never ranked); example sentences with their recordings;
// the source, and "Report a problem". The one primary action is "Hear it".
// "Add to deck" saves the word to the learner's flashcards (lib/tools).
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne, PitchLine } from "@/components/art";
import { ExampleRow, ReportSheet, SourceNote, TagRow, VariantRow, headwordOf } from "@/components/feature/practice";
import { PendingNotice } from "@/components/feature/lesson/parts";
import { AddToDeckButton, type DeckTarget } from "@/components/feature/tools";
import { ArrowLeft, Flag, Volume2 } from "@/components/glyphs/icons";
import { Button, Card, IconButton, Row, Screen, Section, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { wordDetailsOf } from "@/lib/content";
import { useContent } from "@/lib/state";
import { refForEntry, snapshotOf } from "@/lib/tools";
import { definitionsOf, entryById, pitchOf, variantLines, wordClassLabel } from "@/lib/state/dictionary";
import { useDictionary, useDictionaryAudio, useWordDetails } from "@/lib/state/useDictionary";

export default function WordPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dict = useDictionary();
  const file = useWordDetails();
  const audio = useDictionaryAudio();
  const [reporting, setReporting] = useState(false);
  const { bundle } = useContent();

  const entry = useMemo(() => (dict.index && id ? entryById(dict.index, id) : null), [dict.index, id]);
  const details = useMemo(() => wordDetailsOf(file, id ?? ""), [file, id]);
  const labels = dict.index?.dialects ?? {};
  const deckTarget = useMemo<DeckTarget | null>(() => {
    if (!entry) return null;
    const { ref, course } = refForEntry(bundle, entry);
    return { refs: [ref], words: course ? [] : [snapshotOf(entry)], shown: headwordOf(entry), igbo: true };
  }, [bundle, entry]);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/practice/dictionary"));

  if (!entry) {
    const loading = dict.status === "loading";
    return (
      <Screen testID="word-missing" center footer={loading ? undefined : <Button label="Back to the dictionary" onPress={close} testID="word-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            {loading ? "Opening the word…" : "We couldn't find this word"}
          </T>
          {!loading ? (
            <T variant="body" tone="muted" center>
              It may have moved in a newer dictionary. Search for it again.
            </T>
          ) : null}
        </View>
      </Screen>
    );
  }

  const pitch = pitchOf(entry.toned);
  const meanings = definitionsOf(entry.gloss);
  const variants = variantLines(entry, labels, details);
  const playable = audio.availability(entry.audio);
  const head = headwordOf(entry);
  const playKey = `word-${entry.id}`;

  return (
    <Screen
      testID="word"
      footer={
        playable === "asset" || playable === "url" ? (
          <Button
            label={audio.playing && audio.current === playKey ? "Playing…" : "Hear it"}
            icon={Volume2}
            onPress={() => audio.play(entry.audio, playKey)}
            testID="word-play"
            block
          />
        ) : undefined
      }
    >
      <View style={styles.bar} testID="word-header">
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} variant="tinted" testID="word-back" />
        <T variant="label" tone="accent">
          Dictionary
        </T>
        <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} variant="tinted" testID="word-report-flag" />
      </View>

      <Card testID="word-hero">
        <View style={styles.hero}>
          <TagRow wordClass={wordClassLabel(entry, details)} testID="word-tags" />
          <T variant="display" igbo accessibilityRole="header" testID="word-headword">
            {head}
          </T>
          {pitch ? (
            <PitchLine tones={pitch.tones} syllables={pitch.syllables} height={64} accessibilityLabel={`Tones: ${pitch.label}`} testID="word-pitch" />
          ) : (
            <T variant="caption" testID="word-tones-pending">
              Tones pending review
            </T>
          )}
          {pitch ? (
            <T variant="caption" testID="word-tones">
              {pitch.label.charAt(0).toUpperCase() + pitch.label.slice(1)}
            </T>
          ) : null}
          {playable === "pending" ? <PendingNotice testID="word-pending" /> : null}
          {deckTarget ? <AddToDeckButton target={deckTarget} testID="word-add-to-deck" /> : null}
        </View>
      </Card>

      <Section title={meanings.length > 1 ? "Meanings" : "Meaning"} testID="word-meanings">
        <View style={styles.meanings}>
          {meanings.map((m, i) => (
            <View key={i} style={styles.meaning}>
              {meanings.length > 1 ? (
                <T variant="body" strong tone="accent" numeric>
                  {`${i + 1}`}
                </T>
              ) : null}
              <T variant="body" tone="primary" style={styles.flex}>
                {m}
              </T>
            </View>
          ))}
        </View>
      </Section>

      {variants.length > 0 ? (
        <Section title="Also said as" testID="word-variants">
          <Card variant="flat" padding="md">
            {variants.map((v, i) => (
              <VariantRow key={`${v.spelling}-${i}`} line={v} audio={audio} divider={i < variants.length - 1} testID={`word-variant-${i}`} />
            ))}
          </Card>
          <T variant="caption">Every form is right where it is said. Places are listed alphabetically.</T>
        </Section>
      ) : null}

      {details.examples.length > 0 ? (
        <Section title="In a sentence" testID="word-examples">
          <Card variant="flat" padding="md">
            {details.examples.map((e, i) => (
              <ExampleRow key={i} example={e} audio={audio} divider={i < details.examples.length - 1} testID={`word-example-${i}`} />
            ))}
          </Card>
        </Section>
      ) : null}

      <View style={styles.end}>
        <SourceNote testID="word-source" />
        <Card variant="flat" padding="md">
          <Row title="Report a problem" detail="Spelling, tone, meaning, audio, dialect or culture" icon={Flag} onPress={() => setReporting(true)} testID="word-report" />
        </Card>
      </View>

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targets={[{ target: { kind: "dictionary", id: entry.id }, shown: head, gloss: meanings[0], source: "dictionary", version: file ? `dictionary ${file.builtAt.slice(0, 10)}` : "dictionary" }]}
        testID="word-report-sheet"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -space.sm },
  center: { alignItems: "center", gap: space.md },
  hero: { gap: space.sm },
  meanings: { gap: space.xs },
  meaning: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  end: { gap: space.md },
});
