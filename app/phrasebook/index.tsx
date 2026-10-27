// The phrasebook. Search in Igbo or English (tone marks and dots optional),
// or open a situation. Never an empty screen: before a search it shows your
// favourites and the twelve situations. Every phrase is a recorded dataset
// sentence, pending native review, and the screen says so.
import React, { useDeferredValue, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PhraseList, PhraseSourceNote, ReviewChip, SituationTile } from "@/components/feature/phrasebook";
import { Search } from "@/components/glyphs/icons";
import { Button, Card, Chip, IgboKeyStrip, Row, Screen, ScreenHeader, Section, T, TextField, useIgboInput } from "@/components/ui";
import { space } from "@/constants/theme";
import { PHRASE_SUGGESTIONS, phraseById, searchPhrases, situationOf, type Phrase, type SituationSummary } from "@/lib/phrasebook";
import { useFavourites, usePhraseAudio, usePhrasebook } from "@/lib/phrasebook/hooks";

const LIMIT = 40;
const FAVOURITES_PREVIEW = 3;

function pairs<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

export default function PhrasebookHome() {
  const router = useRouter();
  const book = usePhrasebook();
  const audio = usePhraseAudio();
  const favs = useFavourites();
  const igbo = useIgboInput("");
  const query = useDeferredValue(igbo.value.trim());

  const index = book.index;
  const hits = useMemo(() => (index && query ? searchPhrases(index, query, { limit: LIMIT }) : []), [index, query]);
  const favourites = useMemo(() => (index ? favs.ids.map((id) => phraseById(index, id)).filter((p): p is Phrase => !!p) : []), [index, favs.ids]);
  const titleOf = (id: string) => (index ? situationOf(index, id)?.title ?? "" : "");

  const close = () => (router.canGoBack() ? router.back() : router.replace("/practice"));
  const openPhrase = (p: Phrase) => router.push({ pathname: "/phrasebook/phrase/[id]", params: { id: p.id } });
  const openSituation = (s: SituationSummary) => router.push({ pathname: "/phrasebook/[situation]", params: { situation: s.id } });

  return (
    <Screen testID="phrasebook" keyboard>
      <ScreenHeader
        eyebrow="Practice"
        title="Phrasebook"
        subtitle={index ? `${index.size} everyday phrases in ${index.situations.length} situations, each with a native recording.` : "Everyday phrases for real situations, each with a native recording."}
        onBack={close}
        testID="phrasebook-header"
      />

      <View style={styles.field}>
        <TextField
          igbo
          {...igbo.field}
          label="Igbo or English"
          placeholder="daalu, how much, welcome…"
          returnKeyType="search"
          hint="Tone marks and dots are optional."
          testID="phrasebook-input"
        />
        <IgboKeyStrip {...igbo.strip} tones={false} testID="phrasebook-keys" />
      </View>

      {book.status === "error" ? (
        <Card variant="sunk" testID="phrasebook-error">
          <View style={styles.state}>
            <T variant="title">The phrasebook didn't open</T>
            <T variant="body" tone="muted">
              Try again in a moment.
            </T>
            <Button label="Try again" variant="secondary" onPress={book.retry} testID="phrasebook-retry" />
          </View>
        </Card>
      ) : query ? (
        hits.length > 0 ? (
          <Section title={hits.length >= LIMIT ? `Top ${LIMIT} phrases` : `${hits.length} ${hits.length === 1 ? "phrase" : "phrases"}`} testID="phrasebook-results">
            <PhraseList phrases={hits.map((h) => h.phrase)} audio={audio} onOpen={openPhrase} situationTitle={titleOf} testID="phrasebook-hit" />
          </Section>
        ) : book.status === "ready" ? (
          <Card variant="sunk" testID="phrasebook-none">
            <View style={styles.state}>
              <T variant="title">
                {"No phrase with "}
                <T variant="title" igbo>
                  {`“${query}”`}
                </T>
              </T>
              <T variant="body" tone="muted">
                Try one word, or search in English. Single words are in the dictionary.
              </T>
              <View style={styles.chips}>
                {PHRASE_SUGGESTIONS.slice(0, 4).map((q, i) => (
                  <Chip key={q} label={q} onPress={() => igbo.setValue(q)} testID={`phrasebook-none-try-${i}`} />
                ))}
              </View>
              <Button label="Search the dictionary" variant="secondary" size="sm" onPress={() => router.push("/practice/dictionary")} testID="phrasebook-none-dictionary" />
            </View>
          </Card>
        ) : null
      ) : (
        <>
          {favourites.length > 0 ? (
            <Section title="Your favourites" testID="phrasebook-favourites">
              <PhraseList phrases={favourites.slice(0, FAVOURITES_PREVIEW)} audio={audio} onOpen={openPhrase} situationTitle={titleOf} testID="phrasebook-fav" />
              {favourites.length > FAVOURITES_PREVIEW ? (
                <Card variant="flat" padding="md">
                  <Row title={`All ${favourites.length} favourites`} onPress={() => router.push("/phrasebook/favourites")} testID="phrasebook-favourites-all" />
                </Card>
              ) : null}
            </Section>
          ) : null}

          <Section title="Situations" testID="phrasebook-situations">
            <View style={styles.grid}>
              {index
                ? pairs(index.situations).map((row, r) => (
                    <View key={r} style={styles.gridRow}>
                      {row.map((s) => (
                        <SituationTile key={s.id} situation={s} onPress={() => openSituation(s)} testID={`phrasebook-situation-${s.id}`} />
                      ))}
                      {row.length === 1 ? <View style={styles.flex} /> : null}
                    </View>
                  ))
                : null}
            </View>
          </Section>

          <Section title="Try" testID="phrasebook-try">
            <View style={styles.chips}>
              {PHRASE_SUGGESTIONS.map((q, i) => (
                <Chip key={q} label={q} icon={Search} onPress={() => igbo.setValue(q)} testID={`phrasebook-try-${i}`} />
              ))}
            </View>
          </Section>
        </>
      )}

      <View style={styles.end}>
        <ReviewChip testID="phrasebook-review" />
        <PhraseSourceNote credit={index?.credit ?? "Phrases and recordings: Nkọwa okwu (Igbo API), CC BY 4.0, used with permission"} testID="phrasebook-source" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: space.sm },
  state: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  grid: { gap: space.sm },
  gridRow: { flexDirection: "row", gap: space.sm },
  end: { gap: space.sm },
});
