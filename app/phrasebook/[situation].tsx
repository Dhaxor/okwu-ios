// One situation's phrases: a calm header in the situation's colour, then a
// card per phrase with listen, favourite and copy. The one primary action,
// "Play them all", hears the phrases one after another, hands-free.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { PhraseList, PhraseSourceNote, ReviewChip, SITUATION_LOOK, TINTS } from "@/components/feature/phrasebook";
import { ArrowLeft, Headphones, Pause } from "@/components/glyphs/icons";
import { Button, Chip, IconButton, Screen, T } from "@/components/ui";
import { radius, size, space } from "@/constants/theme";
import { phrasesOf, situationOf, type Phrase, type SituationId } from "@/lib/phrasebook";
import { playable, usePhraseAudio, usePhrasebook } from "@/lib/phrasebook/hooks";

export default function SituationPage() {
  const { situation: id } = useLocalSearchParams<{ situation: string }>();
  const router = useRouter();
  const book = usePhrasebook();
  const audio = usePhraseAudio();
  const index = book.index;
  const situation = index && id ? situationOf(index, id) : null;
  const phrases = useMemo(() => (index && situation ? phrasesOf(index, situation.id) : []), [index, situation]);

  // "Play them all": one phrase after another, until the end or a tap.
  const [run, setRun] = useState<number | null>(null);
  const started = useRef(false);
  const keyOf = (p: Phrase) => `phrase-${p.id}`;
  useEffect(() => {
    if (run === null) return;
    const p = phrases[run];
    if (!p) {
      setRun(null);
      return;
    }
    started.current = false;
    if (!playable(audio.play(p.audio, keyOf(p)))) setRun((n) => (n === null ? null : n + 1));
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (run === null) return;
    const p = phrases[run];
    if (!p || audio.current !== keyOf(p)) return;
    if (audio.playing) started.current = true;
    // Next phrase once this one has played to its end (`playing` flickers while a clip loads).
    if (audio.finished === keyOf(p)) {
      const t = setTimeout(() => setRun((n) => (n === null ? null : n + 1)), 700);
      return () => clearTimeout(t);
    }
  }, [audio.playing, audio.current, audio.finished, run, phrases]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/phrasebook"));

  if (!situation) {
    const loading = book.status === "loading";
    return (
      <Screen testID="situation-missing" center footer={loading ? undefined : <Button label="Back to the phrasebook" onPress={close} testID="situation-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            {loading ? "Opening the phrasebook…" : "We couldn't find these phrases"}
          </T>
        </View>
      </Screen>
    );
  }

  const look = SITUATION_LOOK[situation.id as SituationId];
  const tint = TINTS[look.tint];
  const Icon = look.icon;
  const anyPlayable = phrases.some((p) => playable(audio.availability(p.audio)));
  const running = run !== null;

  return (
    <Screen
      testID="situation"
      footer={
        anyPlayable ? (
          <Button
            label={running ? "Stop" : "Play them all"}
            icon={running ? Pause : Headphones}
            variant={running ? "secondary" : "primary"}
            onPress={() => {
              if (running) {
                setRun(null);
                audio.stop();
              } else setRun(0);
            }}
            testID="situation-play-all"
            block
          />
        ) : undefined
      }
    >
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} variant="tinted" testID="situation-back" />
        <T variant="label" tone="accent">
          Phrasebook
        </T>
        <View style={styles.barEnd} />
      </View>

      <View style={[styles.hero, { backgroundColor: tint.ground }]} testID="situation-hero">
        <View style={[styles.badge, { backgroundColor: tint.badge }]}>
          <Icon size={size.icon + 6} color={tint.mark} strokeWidth={2} />
        </View>
        <T variant="display" accessibilityRole="header">
          {situation.title}
        </T>
        <T variant="body" tone="secondary">
          {situation.blurb}
        </T>
        <View style={styles.chips}>
          <Chip label={`${situation.count} phrases`} testID="situation-count" />
          <ReviewChip testID="situation-review" />
        </View>
      </View>

      <PhraseList phrases={phrases} audio={audio} onPlayed={() => setRun(null)} onOpen={(p) => router.push({ pathname: "/phrasebook/phrase/[id]", params: { id: p.id } })} testID="situation-phrase" />

      <PhraseSourceNote credit={index?.credit ?? ""} testID="situation-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  barEnd: { width: size.iconButton },
  hero: { borderRadius: radius.xl, padding: space.lg, gap: space.sm },
  badge: { width: 56, height: 56, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", marginBottom: space.xxs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xxs },
});
