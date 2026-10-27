// Add words to one of the learner's decks: from the lessons they have
// finished (each lesson's words, one tap each or all at once), or from the
// dictionary (search in Igbo or English). A dictionary word the course
// teaches is saved as the course item, so both share one FSRS card.
import React, { useDeferredValue, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SourceNote, headwordOf } from "@/components/feature/practice";
import { useFlashcards } from "@/components/feature/tools";
import { Check, Plus } from "@/components/glyphs/icons";
import { Button, Card, Chip, IgboKeyStrip, Press, Screen, ScreenHeader, Section, Segmented, T, TextField, useIgboInput } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { searchDictionary } from "@/lib/content";
import { SUGGESTED_SEARCHES } from "@/lib/state/dictionary";
import { useDictionary } from "@/lib/state/useDictionary";
import { addCards, finishedLessons, refForEntry, removeCards, snapshotOf } from "@/lib/tools";

type Source = "lessons" | "dictionary";

export default function AddWords() {
  const { deck: deckId } = useLocalSearchParams<{ deck: string }>();
  const router = useRouter();
  const fc = useFlashcards();
  const dict = useDictionary();
  const igbo = useIgboInput("");
  const query = useDeferredValue(igbo.value.trim());
  const deck = fc.decks.file.decks.find((d) => d.id === deckId) ?? null;
  const lessons = useMemo(() => (fc.bundle ? finishedLessons(fc.bundle, fc.learning.progress) : []), [fc.bundle, fc.learning.progress]);
  const [chosen, setSource] = useState<Source | null>(null);
  const source: Source = chosen ?? (lessons.length > 0 ? "lessons" : "dictionary");
  const hits = useMemo(() => (dict.index && query ? searchDictionary(dict.index, query, { limit: 20 }) : []), [dict.index, query]);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/tools/flashcards"));

  if (!deck) {
    return (
      <Screen testID="add-missing" center footer={<Button label="Back to Flashcards" onPress={close} testID="add-missing-back" block />}>
        <T variant="title" center>
          {fc.ready ? "This deck isn't here any more" : "Opening the deck…"}
        </T>
      </Screen>
    );
  }

  const inDeck = new Set(deck.cards.map((c) => c.ref));
  const toggle = (ref: string, word?: ReturnType<typeof snapshotOf>) =>
    fc.decks.update((f) => (inDeck.has(ref) ? removeCards(f, deck.id, [ref]) : addCards(f, deck.id, [ref], new Date(), word ? [word] : [])));

  return (
    <Screen
      testID="add"
      keyboard={source === "dictionary"}
      footer={<Button label={`Done · ${deck.cards.length} ${deck.cards.length === 1 ? "card" : "cards"}`} onPress={close} testID="add-done" block />}
    >
      <ScreenHeader eyebrow="Add words" title={deck.name} onBack={close} testID="add-header" />
      <Segmented<Source>
        options={[
          { value: "lessons", label: "From your lessons" },
          { value: "dictionary", label: "Dictionary" },
        ]}
        value={source}
        onChange={setSource}
        accessibilityLabel="Where the words come from"
        testID="add-source"
      />

      {source === "lessons" ? (
        lessons.length === 0 ? (
          <Card variant="sunk" testID="add-lessons-empty">
            <T variant="body" strong tone="primary">
              Your lessons' words gather here
            </T>
            <T variant="caption">Finish a lesson and its words wait here to be saved. Meanwhile, the dictionary has thousands.</T>
          </Card>
        ) : (
          <View style={styles.lessons}>
            {lessons.map((l, li) => {
              const all = l.refs.every((r) => inDeck.has(r));
              return (
                <Card key={l.lesson} variant="flat" padding="md" testID={`add-lesson-${li}`}>
                  <View style={styles.lessonHead}>
                    <View style={styles.flex}>
                      <T variant="body" strong tone="primary" numberOfLines={1}>
                        {l.title}
                      </T>
                      <T variant="caption" numberOfLines={1}>
                        {l.unitTitle}
                      </T>
                    </View>
                    <Button
                      label={all ? "All in" : `Add all ${l.refs.length}`}
                      icon={all ? Check : Plus}
                      variant="ghost"
                      size="sm"
                      disabled={all}
                      onPress={() => fc.decks.update((f) => addCards(f, deck.id, l.refs, new Date()))}
                      testID={`add-lesson-${li}-all`}
                    />
                  </View>
                  <View style={styles.chips}>
                    {l.refs.map((ref, ri) => {
                      const c = fc.card(ref);
                      if (!c) return null;
                      return (
                        <Chip
                          key={ref}
                          label={fc.profile.toneMarks === "shown" ? (c.toned ?? c.spelling) : c.spelling}
                          igbo
                          icon={inDeck.has(ref) ? Check : Plus}
                          selected={inDeck.has(ref)}
                          onPress={() => toggle(ref)}
                          testID={`add-lesson-${li}-word-${ri}`}
                        />
                      );
                    })}
                  </View>
                </Card>
              );
            })}
          </View>
        )
      ) : (
        <>
          <View style={styles.field}>
            <TextField igbo {...igbo.field} label="Igbo or English" placeholder="ahịa, water, mother…" returnKeyType="search" hint="Tone marks and dots are optional." testID="add-search" />
            <IgboKeyStrip {...igbo.strip} tones={false} testID="add-keys" />
          </View>
          {!query ? (
            <Section title="Try" testID="add-try">
              <View style={styles.chips}>
                {SUGGESTED_SEARCHES.map((q, i) => (
                  <Chip key={q} label={q} onPress={() => igbo.setValue(q)} testID={`add-try-${i}`} />
                ))}
              </View>
            </Section>
          ) : hits.length === 0 && dict.status === "ready" ? (
            <Card variant="sunk" testID="add-none">
              <T variant="body" tone="muted">
                No match. Try fewer letters, or search in English.
              </T>
            </Card>
          ) : (
            <Card variant="flat" padding="md" testID="add-results">
              {hits.map((h, i) => {
                const { ref } = refForEntry(fc.bundle, h.entry);
                const on = inDeck.has(ref);
                return (
                  <Press
                    key={h.entry.id}
                    testID={`add-hit-${i}`}
                    onPress={() => toggle(ref, ref.startsWith("dict:") ? snapshotOf(h.entry) : undefined)}
                    pressScale={1}
                    haptics="select"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${h.entry.spelling}: ${h.entry.gloss}`}
                    style={[styles.hit, i < hits.length - 1 && styles.divider]}
                  >
                    <View style={styles.flex}>
                      <T variant="title" igbo numberOfLines={1}>
                        {headwordOf(h.entry)}
                      </T>
                      <T variant="caption" numberOfLines={2}>
                        {h.entry.gloss}
                      </T>
                    </View>
                    <View style={[styles.tick, on && styles.tickOn]}>
                      {on ? <Check size={size.iconSm} color={colors.onInk} strokeWidth={2.5} /> : <Plus size={size.iconSm} color={colors.ink} strokeWidth={2} />}
                    </View>
                  </Press>
                );
              })}
            </Card>
          )}
          <SourceNote testID="add-source-note" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lessons: { gap: space.sm },
  lessonHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  field: { gap: space.sm },
  hit: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, minHeight: 64 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  tick: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink24, alignItems: "center", justifyContent: "center" },
  tickOn: { backgroundColor: colors.success, borderColor: colors.success },
});
