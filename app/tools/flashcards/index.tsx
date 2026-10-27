// Flashcards: the learner's own decks and the course's (one per unit,
// "Tricky words" and "Tone pairs"). What is due leads, in the ink card;
// the one primary action studies it. Every deck studies with the app's one
// FSRS-6 scheduler, so a card here is the same card the daily review keeps.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AkweteBand, Nnenne } from "@/components/art";
import { DeckNameSheet, DeckTile, useFlashcards, DUE_DECK } from "@/components/feature/tools";
import { Lock, Plus, Search } from "@/components/glyphs/icons";
import { Button, Card, Row, Screen, ScreenHeader, Section, Segmented, T, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { nextDueWords } from "@/lib/state/practice";
import { FACE_LABELS, STUDY_FACES, STUDY_MAX, createDeck, type StudyFace } from "@/lib/tools";

const TONE_NOTE = { shown: "Tone marks are shown.", reveal: "Tap a word to see its tone marks.", hidden: "Tone marks are hidden." } as const;

export default function FlashcardsHub() {
  const router = useRouter();
  const toast = useToast();
  const fc = useFlashcards();
  const [naming, setNaming] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/me"));
  const open = (id: string) => router.push({ pathname: "/tools/flashcards/[id]", params: { id } });

  const due = useMemo(() => (fc.ready ? fc.summaryOf(fc.dueDeck) : null), [fc]);
  const tiles = useMemo(
    () => ({
      mine: fc.mine.map((d) => ({ deck: d, summary: fc.summaryOf(d) })),
      course: fc.builtIns.map((d) => ({ deck: d, summary: fc.summaryOf(d), locked: fc.locked(d) })),
    }),
    [fc]
  );
  const decksWithDue = [...tiles.mine, ...tiles.course.filter((t) => !t.locked)].filter((t) => t.summary.due > 0).length;
  const dueCount = due?.due ?? 0;
  const session = Math.min(STUDY_MAX, dueCount);

  const makeDeck = (name: string) => {
    const r = createDeck(fc.decks.file, name, new Date());
    if (!r.deck) return toast.show("You have as many decks as Okwu keeps. Tidy one away first.", { tone: "warning" });
    fc.decks.update(() => r.file);
    setNaming(false);
    open(r.deck.id);
  };

  return (
    <Screen
      testID="flashcards"
      footer={
        fc.ready ? (
          dueCount > 0 ? (
            <Button
              label={`Study ${session} due ${session === 1 ? "card" : "cards"}`}
              onPress={() => router.push({ pathname: "/tools/flashcards/study", params: { deck: DUE_DECK } })}
              testID="flashcards-study-due"
              block
            />
          ) : (
            <Button label="Make a deck" icon={Plus} onPress={() => setNaming(true)} testID="flashcards-new-footer" block />
          )
        ) : undefined
      }
    >
      <ScreenHeader eyebrow="Your tools" title="Flashcards" subtitle="Words you choose, brought back at the right moment." onBack={close} testID="flashcards-header" />

      {fc.ready && due ? (
        <Card variant="ink" testID="flashcards-due">
          <View style={styles.band}>
            <AkweteBand height={16} ground="ink" />
          </View>
          <View style={styles.hero}>
            <T variant="label" tone="onInkMuted">
              {dueCount > 0 ? "Due now" : "All caught up"}
            </T>
            <T variant="display" tone="onInk" numeric>
              {dueCount > 0 ? `${dueCount} ${dueCount === 1 ? "card" : "cards"}` : `${due.total} ${due.total === 1 ? "card" : "cards"} in your decks`}
            </T>
            <T variant="body" tone="onInkMuted">
              {dueCount > 0
                ? `From ${decksWithDue} ${decksWithDue === 1 ? "deck" : "decks"} · about ${Math.max(1, Math.ceil((session * 12) / 60))} min`
                : due.nextDue
                  ? `The next card comes back ${nextDueWords(due.nextDue, fc.now)}.`
                  : "Open a deck to meet new words."}
            </T>
          </View>
        </Card>
      ) : null}

      <Section title="Study as" testID="flashcards-face">
        <Segmented<StudyFace>
          options={STUDY_FACES.map((f) => ({ value: f, label: FACE_LABELS[f] }))}
          value={fc.face}
          onChange={fc.setFace}
          accessibilityLabel="Card face"
          testID="flashcards-face-picker"
        />
        <T variant="caption">{`${TONE_NOTE[fc.profile.toneMarks]} Change it in Settings.`}</T>
      </Section>

      <Section
        title="Your decks"
        action={tiles.mine.length > 0 ? <Button label="New deck" icon={Plus} variant="ghost" size="sm" onPress={() => setNaming(true)} testID="flashcards-new" /> : undefined}
        testID="flashcards-mine"
      >
        {tiles.mine.length > 0 ? (
          <View style={styles.list}>
            {tiles.mine.map(({ deck, summary }, i) => (
              <DeckTile key={deck.id} deck={deck} summary={summary} locked={false} onPress={() => open(deck.id)} testID={`flashcards-mine-${i}`} />
            ))}
          </View>
        ) : (
          <Card variant="sunk" testID="flashcards-mine-empty">
            <View style={styles.empty}>
              <Nnenne size={64} ground="paper" />
              <View style={styles.flex}>
                <T variant="body" strong tone="primary">
                  Make a deck of your own
                </T>
                <T variant="caption">Save words from the dictionary or a lesson: words for a call home, a trip, a wedding.</T>
              </View>
            </View>
            <View style={styles.emptyActions}>
              <Button label="New deck" icon={Plus} variant="secondary" size="sm" onPress={() => setNaming(true)} testID="flashcards-mine-new" />
              <Button label="Find words" icon={Search} variant="ghost" size="sm" onPress={() => router.push("/practice/dictionary")} testID="flashcards-mine-dictionary" />
            </View>
          </Card>
        )}
      </Section>

      <Section title="From your course" testID="flashcards-course">
        <View style={styles.list}>
          {tiles.course
            .filter((t) => !t.locked)
            .map(({ deck, summary }, i) => (
              <DeckTile key={deck.id} deck={deck} summary={summary} locked={false} onPress={() => open(deck.id)} testID={`flashcards-course-${i}`} />
            ))}
        </View>
      </Section>

      {tiles.course.some((t) => t.locked) ? (
        <Section title="Units with Okwu Plus" testID="flashcards-locked">
          <Card variant="flat" padding="md">
            {tiles.course
              .filter((t) => t.locked)
              .map(({ deck }, i, all) => (
                <Row key={deck.id} title={deck.name} detail={deck.detail} icon={Lock} onPress={() => open(deck.id)} divider={i < all.length - 1} testID={`flashcards-locked-${i}`} />
              ))}
          </Card>
          <T variant="caption">These units' decks open with the rest of the path. Your first units stay free.</T>
        </Section>
      ) : null}

      <DeckNameSheet visible={naming} onClose={() => setNaming(false)} onSave={makeDeck} mode="new" testID="flashcards-name" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  band: { marginHorizontal: -space.lg, marginTop: -space.lg, marginBottom: space.md },
  hero: { gap: space.xs },
  list: { gap: space.sm },
  empty: { flexDirection: "row", alignItems: "center", gap: space.md },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md, paddingLeft: 64 + space.md },
});
