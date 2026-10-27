// One deck: where its words stand (due, new, strong, and a mastery bar),
// the face to study with, and its cards. The learner's own decks can be
// renamed, emptied card by card, grown ("Add words") and deleted; course
// decks follow the Learn path's Plus rule. The one primary action studies.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { DICTIONARY_SOURCE } from "@/components/feature/practice";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { CardRow, DeckNameSheet, MasteryBar, MasteryLegend, StatTile, useFlashcards } from "@/components/feature/tools";
import { Lock, Pencil, Plus, Search, Trash } from "@/components/glyphs/icons";
import { Button, Card, IconButton, Screen, ScreenHeader, Section, Segmented, T, useConfirm, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { itemMastery } from "@/lib/learning";
import { nextDueWords } from "@/lib/state/practice";
import { FACE_LABELS, STUDY_FACES, STUDY_MAX, STUDY_NEW_MAX, deleteDeck, removeCards, renameDeck, type StudyFace } from "@/lib/tools";

export default function DeckPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const fc = useFlashcards();
  const [renaming, setRenaming] = useState(false);

  const deck = fc.ready && id ? fc.findDeck(id) : null;
  const mine = deck?.kind === "user";
  const locked = deck ? fc.locked(deck) : false;
  const face = fc.face;
  const cards = useMemo(() => (deck ? fc.cardsOf(deck, face) : []), [deck, fc, face]);
  const summary = useMemo(() => (deck ? fc.summaryOf(deck, face) : null), [deck, fc, face]);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/tools/flashcards"));

  if (!deck || !summary) {
    const loading = !fc.ready && !fc.failed;
    return (
      <Screen testID="deck-missing" center footer={loading ? undefined : <Button label="Back to Flashcards" onPress={close} testID="deck-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            {loading ? "Opening the deck…" : "This deck isn't here any more"}
          </T>
        </View>
      </Screen>
    );
  }

  const toStudy = Math.min(STUDY_MAX, summary.due + Math.min(STUDY_NEW_MAX, summary.fresh));
  const study = (ahead = false) => router.push({ pathname: "/tools/flashcards/study", params: { deck: deck.id, ...(ahead ? { ahead: "1" } : {}) } });
  const addWords = () => router.push({ pathname: "/tools/flashcards/add", params: { deck: deck.id } });
  const anyDraft = cards.some((c) => fc.card(c.ref)?.draft);
  const anyDict = cards.some((c) => fc.card(c.ref)?.unreviewed);

  const remove = (ref: string, shown: string) => {
    fc.decks.update((f) => removeCards(f, deck.id, [ref]));
    toast.show(`Took ${shown} out. Its progress stays with you.`, { tone: "neutral" });
  };
  const drop = async () => {
    const ok = await confirm({
      title: `Delete ${deck.name}?`,
      message: "The deck goes. Every word keeps what you've learned, and still comes back in your reviews.",
      confirmLabel: "Delete deck",
      cancelLabel: "Keep it",
      destructive: true,
    });
    if (!ok) return;
    fc.decks.update((f) => deleteDeck(f, deck.id));
    close();
  };

  const footer = locked ? (
    <Button label="See Okwu Plus" icon={Lock} onPress={() => router.push({ pathname: "/paywall", params: { from: "path" } })} testID="deck-plus" block />
  ) : summary.total === 0 ? (
    mine ? (
      <Button label="Add words" icon={Plus} onPress={addWords} testID="deck-add-footer" block />
    ) : undefined
  ) : toStudy > 0 ? (
    <Button label={`Study ${toStudy} ${toStudy === 1 ? "card" : "cards"}`} onPress={() => study()} testID="deck-study" block />
  ) : (
    <Button label="Practise anyway" variant="secondary" onPress={() => study(true)} testID="deck-ahead" block />
  );

  return (
    <Screen testID="deck" footer={footer}>
      <ScreenHeader
        eyebrow={mine ? "Your deck" : "From your course"}
        title={deck.name}
        subtitle={deck.kind === "user" ? undefined : deck.detail}
        onBack={close}
        trailing={
          mine ? (
            <>
              <IconButton icon={Pencil} variant="tinted" accessibilityLabel="Rename this deck" onPress={() => setRenaming(true)} testID="deck-rename" />
              <IconButton icon={Trash} variant="tinted" accessibilityLabel="Delete this deck" onPress={() => void drop()} testID="deck-delete" />
            </>
          ) : undefined
        }
        testID="deck-header"
      />

      {locked ? (
        <Card variant="ink" testID="deck-locked">
          <T variant="label" tone="onInkMuted">
            Okwu Plus
          </T>
          <T variant="title" tone="onInk">
            This unit opens with Plus
          </T>
          <T variant="body" tone="onInkMuted">
            Its words are here to look through. Studying them opens with the rest of the path.
          </T>
        </Card>
      ) : summary.total > 0 ? (
        <Card testID="deck-summary">
          <View style={styles.stats}>
            <StatTile big value={String(summary.due)} label="Due" note={summary.due === 0 && summary.nextDue ? `Next ${nextDueWords(summary.nextDue, fc.now)}` : undefined} testID="deck-due" />
            <StatTile big value={String(summary.fresh)} label="New" note={FACE_LABELS[face]} testID="deck-new" />
            <StatTile big value={String(summary.strong)} label="Strong" note={`of ${summary.total}`} testID="deck-strong" />
          </View>
          <View style={styles.mastery}>
            <MasteryBar levels={summary.levels} height={10} testID="deck-mastery" />
            <MasteryLegend levels={summary.levels} testID="deck-legend" />
          </View>
        </Card>
      ) : null}

      {summary.total > 0 && !locked ? (
        <Section title="Study as" testID="deck-face">
          <Segmented<StudyFace>
            options={STUDY_FACES.map((f) => ({ value: f, label: FACE_LABELS[f] }))}
            value={fc.face}
            onChange={fc.setFace}
            accessibilityLabel="Card face"
            testID="deck-face-picker"
          />
          {deck.suggestedFace === "audio" && fc.face !== "audio" ? <T variant="caption">Tone pairs work best heard first: try Listen first.</T> : null}
        </Section>
      ) : null}

      <Section
        title={summary.total > 0 ? `${summary.total} ${summary.total === 1 ? "card" : "cards"}` : "Cards"}
        action={mine && summary.total > 0 ? <Button label="Add words" icon={Plus} variant="ghost" size="sm" onPress={addWords} testID="deck-add" /> : undefined}
        testID="deck-cards"
      >
        {summary.total > 0 ? (
          <Card variant="flat" padding="md">
            {cards.map((c, i) => {
              const view = fc.card(c.ref);
              if (!view) return null;
              return (
                <CardRow
                  key={c.ref}
                  card={view}
                  level={itemMastery(fc.learning.progress, c.ref, fc.now, fc.learning.scheduler).level}
                  due={c.due}
                  marks={fc.profile.toneMarks}
                  onRemove={mine ? () => remove(c.ref, view.spelling) : undefined}
                  divider={i < cards.length - 1}
                  testID={`deck-card-${i}`}
                />
              );
            })}
          </Card>
        ) : (
          <Card variant="sunk" testID="deck-empty">
            <T variant="body" strong tone="primary">
              {mine ? "An empty deck, ready for words" : deck.kind === "tricky" ? "Nothing tricky right now" : "No words here yet"}
            </T>
            <T variant="caption" style={styles.emptyLine}>
              {mine
                ? "Add words you've met in your lessons, or find new ones in the dictionary."
                : deck.kind === "tricky"
                  ? "When a word comes back “not yet”, it waits here for another go."
                  : "They arrive with the lessons."}
            </T>
            {mine ? <Button label="Search the dictionary" icon={Search} variant="secondary" size="sm" onPress={() => router.push("/practice/dictionary")} testID="deck-empty-dictionary" /> : null}
          </Card>
        )}
        {anyDraft ? <DraftTag testID="deck-draft" /> : null}
        {anyDict ? <T variant="caption">{DICTIONARY_SOURCE}</T> : null}
      </Section>

      <DeckNameSheet
        visible={renaming}
        onClose={() => setRenaming(false)}
        onSave={(name) => {
          fc.decks.update((f) => renameDeck(f, deck.id, name));
          setRenaming(false);
        }}
        initial={deck.name}
        mode="rename"
        testID="deck-name"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md },
  stats: { flexDirection: "row", gap: space.md },
  mastery: { gap: space.sm, marginTop: space.lg },
  emptyLine: { marginTop: space.xxs, marginBottom: space.md },
});
