// "Add to deck": the shared control that saves words to the learner's own
// flashcard decks, from the dictionary word page, a lesson's results and a
// deck's "Add words" screen.
//   <AddToDeckButton target={{ refs, words, shown }} testID="word-add" />
//   <AddToDeckSheet visible target … />   one sheet: tick decks, or make one
// A dictionary word the course teaches is saved as the course item, so the
// two share one FSRS card (refForEntry).
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BookmarkPlus, Check, Plus } from "@/components/glyphs/icons";
import { Button, Press, Sheet, T, TextField, useToast } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { addCards, cleanDeckName, createDeck, deckHasAll, removeCards, useDecks, type WordSnapshot } from "@/lib/tools";

export interface DeckTarget {
  /** Card ids: ItemIds, or "dict:<id>" with a snapshot in `words`. */
  refs: string[];
  words?: WordSnapshot[];
  /** What the learner sees in the sheet: the Igbo word, or "6 words". */
  shown: string;
  /** `shown` is Igbo (one word). */
  igbo?: boolean;
}

export function AddToDeckButton({ target, testID, size: s = "sm", block = false, center = false }: { target: DeckTarget; testID: string; size?: "sm" | "md"; block?: boolean; center?: boolean }) {
  const { file, ready } = useDecks();
  const [open, setOpen] = useState(false);
  const inDecks = useMemo(() => file.decks.filter((d) => deckHasAll(d, target.refs)), [file.decks, target.refs]);
  const label =
    inDecks.length === 0 ? (target.refs.length > 1 ? `Save ${target.refs.length} words to a deck` : "Add to deck") : inDecks.length === 1 ? `In ${inDecks[0]!.name}` : `In ${inDecks.length} decks`;
  return (
    <>
      <Button
        label={label}
        icon={inDecks.length ? Check : BookmarkPlus}
        variant="secondary"
        size={s}
        block={block}
        disabled={!ready || target.refs.length === 0}
        onPress={() => setOpen(true)}
        accessibilityHint="Choose a flashcard deck for this"
        testID={testID}
        style={center ? styles.center : undefined}
      />
      <AddToDeckSheet visible={open} onClose={() => setOpen(false)} target={target} testID={`${testID}-sheet`} />
    </>
  );
}

export function AddToDeckSheet({ visible, onClose, target, testID }: { visible: boolean; onClose: () => void; target: DeckTarget; testID: string }) {
  const { file, update } = useDecks();
  const toast = useToast();
  const [name, setName] = useState("");
  const many = target.refs.length > 1;

  const toggle = (deckId: string, on: boolean, deckName: string) => {
    update((f) => (on ? addCards(f, deckId, target.refs, new Date(), target.words) : removeCards(f, deckId, target.refs)));
    toast.show(on ? `Saved to ${deckName}.` : `Taken out of ${deckName}.`, { tone: on ? "success" : "neutral" });
  };

  const create = () => {
    const clean = cleanDeckName(name);
    if (!clean) return;
    const made = { id: null as string | null };
    update((f) => {
      const r = createDeck(f, clean, new Date());
      if (!r.deck) return f;
      made.id = r.deck.id;
      return addCards(r.file, r.deck.id, target.refs, new Date(), target.words);
    });
    if (made.id) {
      setName("");
      toast.show(`Made ${clean}, with ${many ? `${target.refs.length} words` : "this word"} in it.`, { tone: "success" });
    } else toast.show("You have as many decks as Okwu keeps. Tidy one away first.", { tone: "warning" });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID={testID}
      title={many ? `Save ${target.refs.length} words` : "Add to a deck"}
      subtitle="Your flashcards bring each word back at the right moment, so it stays with you."
      scroll
      footer={<Button label="Done" onPress={onClose} testID={`${testID}-done`} block />}
    >
      <View style={styles.body}>
        {!many ? (
          <View style={styles.word}>
            <T variant="title" igbo={target.igbo} numberOfLines={2}>
              {target.shown}
            </T>
          </View>
        ) : null}
        {file.decks.length > 0 ? (
          <View style={styles.list} testID={`${testID}-decks`}>
            {file.decks.map((d, i) => {
              const on = deckHasAll(d, target.refs);
              return (
                <Press
                  key={d.id}
                  testID={`${testID}-deck-${i}`}
                  onPress={() => toggle(d.id, !on, d.name)}
                  pressScale={1}
                  haptics="select"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${d.name}, ${d.cards.length} cards`}
                  style={[styles.deck, i < file.decks.length - 1 && styles.divider]}
                >
                  <View style={styles.flex}>
                    <T variant="body" tone="primary" numberOfLines={1}>
                      {d.name}
                    </T>
                    <T variant="caption">{`${d.cards.length} ${d.cards.length === 1 ? "card" : "cards"}`}</T>
                  </View>
                  <View style={[styles.tick, on && styles.tickOn]}>{on ? <Check size={size.iconSm} color={colors.onInk} strokeWidth={2.5} /> : null}</View>
                </Press>
              );
            })}
          </View>
        ) : (
          <T variant="body" tone="muted">
            No decks yet. Name your first one: a person, a trip, a topic.
          </T>
        )}
        <View style={styles.make}>
          <View style={styles.flex}>
            <TextField label="New deck" value={name} onChangeText={setName} placeholder="Words for Mum" maxLength={60} returnKeyType="done" onSubmitEditing={create} testID={`${testID}-name`} />
          </View>
          <Button label="Make" icon={Plus} variant="secondary" size="md" disabled={!cleanDeckName(name)} onPress={create} testID={`${testID}-create`} style={styles.makeButton} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: "center" },
  body: { gap: space.lg },
  word: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
  list: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: space.md },
  deck: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  tick: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink24, alignItems: "center", justifyContent: "center" },
  tickOn: { backgroundColor: colors.success, borderColor: colors.success },
  make: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  makeButton: { alignSelf: "flex-end", marginBottom: 2 },
});
