// A phrase page: the Igbo large (selectable), its English, the native
// recording, a private place to say it yourself (record and replay on
// iPhone; never scored), the words of the phrase that have a dictionary
// page, the source, and "Report a problem" (the flag up top and a row at the
// end, as on a dictionary word). The one primary action is "Hear it".
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { FavouriteButton, PhraseSourceNote, ReviewChip, SITUATION_LOOK, TINTS } from "@/components/feature/phrasebook";
import { ReportSheet } from "@/components/feature/practice";
import { ArrowLeft, Copy, Flag, Mic, Play, RotateCcw, Volume2 } from "@/components/glyphs/icons";
import { Button, Card, Chip, IconButton, Row, Screen, Section, T } from "@/components/ui";
import { size, space } from "@/constants/theme";
import { searchDictionary } from "@/lib/content";
import { phraseById, phrasebookVersion, situationOf, wordsOfPhrase } from "@/lib/phrasebook";
import { playable, useCopyPhrase, useFavourites, usePhraseAudio, usePhrasebook } from "@/lib/phrasebook/hooks";
import { useVoiceRecorder } from "@/lib/state";
import { phraseSubject } from "@/lib/state/reportTargets";
import { useDictionary } from "@/lib/state/useDictionary";

export default function PhrasePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const book = usePhrasebook();
  const dict = useDictionary();
  const audio = usePhraseAudio();
  const favs = useFavourites();
  const copy = useCopyPhrase();
  const recorder = useVoiceRecorder();
  const [reporting, setReporting] = useState(false);

  const index = book.index;
  const phrase = index && id ? phraseById(index, id) : null;
  const situation = index && phrase ? situationOf(index, phrase.situation) : null;

  // Words of the phrase that have their own dictionary page (spelled the same, dots optional).
  const words = useMemo(() => {
    if (!phrase || !dict.index) return [];
    const out: { word: string; entryId: string; gloss: string }[] = [];
    for (const w of wordsOfPhrase(phrase.igbo)) {
      const hit = searchDictionary(dict.index, w, { limit: 1 })[0];
      if (hit && (hit.match === "headword" || hit.match === "without-dots") && !out.some((o) => o.entryId === hit.entry.id)) {
        out.push({ word: w, entryId: hit.entry.id, gloss: hit.entry.gloss.split(/[;,]/)[0]?.trim() ?? "" });
      }
    }
    return out.slice(0, 8);
  }, [phrase, dict.index]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/phrasebook"));

  if (!phrase) {
    const loading = book.status === "loading";
    return (
      <Screen testID="phrase-missing" center footer={loading ? undefined : <Button label="Back to the phrasebook" onPress={close} testID="phrase-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            {loading ? "Opening the phrase…" : "We couldn't find this phrase"}
          </T>
        </View>
      </Screen>
    );
  }

  const key = `phrase-${phrase.id}`;
  const mineKey = `${key}-mine`;
  const clip = audio.availability(phrase.audio);
  const canPlay = playable(clip);
  const nativePlaying = audio.playing && audio.current === key;
  const recording = recorder.state === "recording";
  const look = SITUATION_LOOK[phrase.situation];
  const tint = TINTS[look.tint];

  const record = async () => {
    audio.stop();
    if (recording) await recorder.stop();
    else await recorder.start();
  };

  return (
    <Screen
      testID="phrase"
      footer={
        canPlay ? (
          <Button label={nativePlaying ? "Playing…" : "Hear it"} icon={Volume2} onPress={() => audio.play(phrase.audio, key)} testID="phrase-play" block />
        ) : undefined
      }
    >
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} variant="tinted" testID="phrase-back" />
        <T variant="label" tone="accent">
          Phrasebook
        </T>
        <View style={styles.barEnd}>
          <FavouriteButton on={favs.isFavourite(phrase.id)} onPress={() => favs.toggle(phrase.id)} label={phrase.en} testID="phrase-fav" />
          <IconButton icon={Copy} accessibilityLabel="Copy the Igbo and English" onPress={() => copy(phrase)} variant="tinted" testID="phrase-copy" />
          <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={() => setReporting(true)} variant="tinted" testID="phrase-report-flag" />
        </View>
      </View>

      <Card testID="phrase-hero" padding="none">
        <View style={[styles.band, { backgroundColor: tint.ground }]}>
          <look.icon size={size.iconSm} color={tint.mark} strokeWidth={2} />
          <T variant="label" tone="secondary">
            {situation?.title ?? ""}
          </T>
        </View>
        <View style={styles.hero}>
          <T variant="display" igbo selectable accessibilityRole="header" testID="phrase-igbo">
            {phrase.igbo}
          </T>
          <T variant="body" tone="muted" selectable testID="phrase-en">
            {phrase.en}
          </T>
          <View style={styles.chips}>
            <ReviewChip testID="phrase-review" />
            {clip === "pending" ? <Chip label="Recording coming soon" testID="phrase-pending" /> : null}
          </View>
          <T variant="caption">Tones are not marked yet: they are written only after a linguist checks them against the recording.</T>
        </View>
      </Card>

      <Section title="Say it yourself" testID="phrase-say">
        <Card padding="md" testID="phrase-say-card">
          <View style={styles.say}>
            <T variant="body">
              {canPlay ? "Listen, then say it out loud along with the voice." : "Say it out loud. The recording arrives with the next update."}
            </T>
            {recorder.supported ? (
              <View style={styles.sayButtons}>
                <Button
                  label={recording ? "Stop" : recorder.state === "recorded" ? "Record again" : "Record yourself"}
                  icon={recording ? undefined : recorder.state === "recorded" ? RotateCcw : Mic}
                  variant={recording ? "danger" : "secondary"}
                  size="md"
                  onPress={() => void record()}
                  testID="phrase-record"
                />
                {recorder.state === "recorded" && recorder.uri ? (
                  <Button label="Play mine" icon={Play} variant="secondary" size="md" onPress={() => recorder.uri && audio.playMine(recorder.uri, mineKey)} testID="phrase-mine" />
                ) : null}
              </View>
            ) : (
              <T variant="caption" testID="phrase-web-note">
                Recording yourself works in the iPhone app. Here, say it aloud along with the voice.
              </T>
            )}
            <T variant="caption">
              {recorder.state === "denied"
                ? "Okwu needs the microphone to let you hear yourself. You can allow it in Settings, or just say it aloud."
                : "Your recording stays on this phone, and nothing you say is scored."}
            </T>
          </View>
        </Card>
      </Section>

      {words.length > 0 ? (
        <Section title="Words in this phrase" testID="phrase-words">
          <View style={styles.chips}>
            {words.map((w, i) => (
              <Chip key={w.entryId} label={w.word} igbo onPress={() => router.push({ pathname: "/practice/dictionary/[id]", params: { id: w.entryId } })} testID={`phrase-word-${i}`} />
            ))}
          </View>
          <T variant="caption">Open a word for its tones, regional forms and more examples.</T>
        </Section>
      ) : null}

      <View style={styles.end}>
        <PhraseSourceNote credit={index?.credit ?? ""} testID="phrase-source" />
        <Card variant="flat" padding="md">
          <Row title="Report a problem" detail="Spelling, tone, meaning, audio, dialect or culture" icon={Flag} onPress={() => setReporting(true)} testID="phrase-report" />
        </Card>
      </View>

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targets={[phraseSubject(phrase, phrasebookVersion())]} testID="phrase-report-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  barEnd: { flexDirection: "row", gap: space.xs },
  band: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.lg, paddingVertical: space.sm },
  hero: { padding: space.lg, gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  say: { gap: space.sm },
  sayButtons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  end: { gap: space.md },
});
