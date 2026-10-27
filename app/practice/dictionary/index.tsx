// Dictionary search. Type Igbo with or without tone marks and dots ("kedu"
// finds kedụ), a regional form ("oye" finds Orie), or English ("market").
// Never an empty screen: before a search it shows recent searches, the word
// of the day and places to start. Every screen names its source.
import React, { useDeferredValue, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { DictWordCard, ResultRow, SourceNote } from "@/components/feature/practice";
import { Search } from "@/components/glyphs/icons";
import { Button, Card, Chip, IgboKeyStrip, Screen, ScreenHeader, Section, T, TextField, useIgboInput } from "@/components/ui";
import { space } from "@/constants/theme";
import { deviceCalendar } from "@/lib/game";
import { searchDictionary } from "@/lib/content";
import { SUGGESTED_SEARCHES, dictionaryWordOfTheDay } from "@/lib/state/dictionary";
import { useDictionary, useDictionaryAudio, useRecentSearches } from "@/lib/state/useDictionary";

const LIMIT = 30;

export default function DictionarySearch() {
  const router = useRouter();
  const dict = useDictionary();
  const audio = useDictionaryAudio();
  const { recent, add, clear } = useRecentSearches();
  const igbo = useIgboInput("");
  const query = useDeferredValue(igbo.value.trim());

  const hits = useMemo(() => (dict.index && query ? searchDictionary(dict.index, query, { limit: LIMIT }) : []), [dict.index, query]);
  const word = useMemo(() => (dict.index ? dictionaryWordOfTheDay(dict.index, deviceCalendar.dayKey(new Date())) : null), [dict.index]);
  const labels = dict.index?.dialects ?? {};

  const close = () => (router.canGoBack() ? router.back() : router.replace("/practice"));
  const open = (id: string, remember = true) => {
    if (remember && query) add(query);
    router.push({ pathname: "/practice/dictionary/[id]", params: { id } });
  };
  const search = (q: string) => igbo.setValue(q);

  return (
    <Screen testID="dictionary" keyboard>
      <ScreenHeader eyebrow="Dictionary" title="Find a word" onBack={close} testID="dictionary-header" />

      <View style={styles.field}>
        <TextField
          igbo
          {...igbo.field}
          label="Igbo or English"
          placeholder="kedu, market, nnọọ…"
          returnKeyType="search"
          onSubmitEditing={() => query && add(query)}
          hint="Tone marks and dots are optional."
          testID="dictionary-input"
        />
        <IgboKeyStrip {...igbo.strip} tones={false} testID="dictionary-keys" />
      </View>

      {dict.status === "error" ? (
        <Card variant="sunk" testID="dictionary-error">
          <View style={styles.state}>
            <T variant="title">The dictionary didn't open</T>
            <T variant="body" tone="muted">
              Try again in a moment.
            </T>
            <Button label="Try again" variant="secondary" onPress={dict.retry} testID="dictionary-retry" />
          </View>
        </Card>
      ) : !query ? (
        <>
          {recent.length > 0 ? (
            <Section title="Recent" action={<Button label="Clear" variant="ghost" size="sm" onPress={clear} testID="dictionary-recent-clear" />} testID="dictionary-recent">
              <View style={styles.chips}>
                {recent.map((q, i) => (
                  <Chip key={q} label={q} igbo onPress={() => search(q)} testID={`dictionary-recent-${i}`} />
                ))}
              </View>
            </Section>
          ) : null}
          {word ? (
            <Section title="Word of the day" testID="dictionary-wotd">
              <DictWordCard entry={word} audio={audio} onOpen={() => open(word.id, false)} testID="dictionary-word" />
            </Section>
          ) : null}
          <Section title="Try" testID="dictionary-try">
            <View style={styles.chips}>
              {SUGGESTED_SEARCHES.map((q, i) => (
                <Chip key={q} label={q} icon={Search} onPress={() => search(q)} testID={`dictionary-try-${i}`} />
              ))}
            </View>
          </Section>
        </>
      ) : hits.length === 0 && dict.status === "ready" ? (
        <Card variant="sunk" testID="dictionary-none">
          <View style={styles.state}>
            <T variant="title">
              {"No match for "}
              <T variant="title" igbo>
                {`“${query}”`}
              </T>
            </T>
            <T variant="body" tone="muted">
              Check the spelling, try fewer letters, or search in English. Regional forms are found too.
            </T>
            <View style={styles.chips}>
              {SUGGESTED_SEARCHES.slice(0, 4).map((q, i) => (
                <Chip key={q} label={q} onPress={() => search(q)} testID={`dictionary-none-try-${i}`} />
              ))}
            </View>
          </View>
        </Card>
      ) : (
        <Section title={hits.length >= LIMIT ? `Top ${LIMIT} matches` : `${hits.length} ${hits.length === 1 ? "match" : "matches"}`} testID="dictionary-results">
          <Card variant="flat" padding="md">
            {hits.map((h, i) => (
              <ResultRow key={h.entry.id} hit={h} labels={labels} onPress={() => open(h.entry.id)} divider={i < hits.length - 1} testID={`dictionary-hit-${i}`} />
            ))}
          </Card>
        </Section>
      )}

      <SourceNote testID="dictionary-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  state: { gap: space.sm },
});
