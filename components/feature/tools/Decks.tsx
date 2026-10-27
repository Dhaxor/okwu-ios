// Deck pieces: the deck tile on the Flashcards hub, a card row in a deck,
// and the sheets that name a new deck or rename one.
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BookOpen, Ear, Layers, Lock, RotateCcw, X, type IconComponent } from "@/components/glyphs/icons";
import { Button, Card, Chip, IconButton, Sheet, T, TextField } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { MasteryLevel } from "@/lib/learning";
import type { ToneMarks } from "@/lib/state";
import { cleanDeckName, type CardView, type DeckKind, type DeckSummary, type DeckView } from "@/lib/tools";
import { CardIgbo, LEVEL_COLORS, LEVEL_NAMES, MasteryBar } from "./ToolsParts";

const KIND_ICON: Record<DeckKind, IconComponent> = { user: Layers, unit: BookOpen, tricky: RotateCcw, tones: Ear };

/** "6 due", "All caught up", "12 new": the one number a deck tile leads with. */
export function deckStatus(s: DeckSummary): { label: string; tone: "accent" | "success" | "neutral" } {
  if (s.total === 0) return { label: "Empty", tone: "neutral" };
  if (s.due > 0) return { label: `${s.due} due`, tone: "accent" };
  if (s.fresh > 0) return { label: `${s.fresh} new`, tone: "neutral" };
  return { label: "All caught up", tone: "success" };
}

export function DeckTile({ deck, summary, locked, onPress, testID }: { deck: DeckView; summary: DeckSummary; locked: boolean; onPress: () => void; testID: string }) {
  const Icon = KIND_ICON[deck.kind];
  const status = deckStatus(summary);
  return (
    <Card variant="flat" padding="md" onPress={onPress} testID={testID} accessibilityLabel={`${deck.name}. ${deck.detail}. ${locked ? "Okwu Plus" : status.label}`}>
      <View style={styles.tileHead}>
        <View style={[styles.well, deck.kind === "user" && styles.wellMine]}>
          <Icon size={size.iconSm} color={deck.kind === "user" ? colors.accent : colors.ink} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <T variant="body" strong tone="primary" numberOfLines={1}>
            {deck.name}
          </T>
          <T variant="caption" numberOfLines={1}>
            {deck.detail}
          </T>
        </View>
        {locked ? <Chip label="Plus" icon={Lock} tone="reward" testID={`${testID}-plus`} /> : <Chip label={status.label} tone={status.tone} testID={`${testID}-status`} />}
      </View>
      {summary.total > 0 && !locked ? (
        <View style={styles.tileBar}>
          <MasteryBar levels={summary.levels} height={6} testID={`${testID}-mastery`} />
        </View>
      ) : null}
    </Card>
  );
}

/** One card in a deck's list: the Igbo at the learner's tone level, its meaning, where it stands. */
export function CardRow({
  card,
  level,
  due,
  marks,
  onRemove,
  divider,
  testID,
}: {
  card: CardView;
  level: MasteryLevel;
  due: boolean;
  marks: ToneMarks;
  onRemove?: () => void;
  divider: boolean;
  testID: string;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]} testID={testID}>
      <View style={[styles.level, { backgroundColor: LEVEL_COLORS[level] }]} accessible accessibilityLabel={LEVEL_NAMES[level]} />
      <View style={styles.flex}>
        <CardIgbo card={card} marks={marks === "reveal" ? "hidden" : marks} variant="title" testID={`${testID}-igbo`} />
        <T variant="caption" numberOfLines={2}>
          {card.gloss}
        </T>
      </View>
      {due ? <Chip label="Due" tone="accent" testID={`${testID}-due`} /> : null}
      {onRemove ? <IconButton icon={X} accessibilityLabel={`Take ${card.spelling} out of this deck`} onPress={onRemove} testID={`${testID}-remove`} /> : null}
    </View>
  );
}

/** Name a deck (new or existing). */
export function DeckNameSheet({
  visible,
  onClose,
  onSave,
  initial = "",
  mode,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initial?: string;
  mode: "new" | "rename";
  testID: string;
}) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (visible) setName(initial);
  }, [visible, initial]);
  const clean = cleanDeckName(name);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID={testID}
      title={mode === "new" ? "A new deck" : "Rename this deck"}
      subtitle={mode === "new" ? "Name it for a person, a trip or a topic. Add words from the dictionary or your lessons." : undefined}
      footer={
        <>
          <Button label={mode === "new" ? "Make deck" : "Save"} onPress={() => clean && onSave(clean)} disabled={!clean || clean === initial} testID={`${testID}-save`} block />
          <Button label="Cancel" variant="ghost" onPress={onClose} testID={`${testID}-cancel`} block />
        </>
      }
    >
      <TextField
        label="Deck name"
        value={name}
        onChangeText={setName}
        placeholder="Words for Mum"
        maxLength={60}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => clean && onSave(clean)}
        testID={`${testID}-name`}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tileHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  well: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.ink06, alignItems: "center", justifyContent: "center" },
  wellMine: { backgroundColor: colors.accent12 },
  tileBar: { marginTop: space.sm, paddingLeft: 40 + space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, minHeight: 64 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  level: { width: 8, height: 8, borderRadius: radius.pill },
});
