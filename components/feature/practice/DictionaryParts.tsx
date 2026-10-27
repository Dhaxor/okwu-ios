// Pieces of the dictionary screens: a result row, the word-of-the-day card,
// a small play control that says "coming soon" honestly, regional forms,
// example sentences and the source line every dictionary screen carries.
import React from "react";
import { StyleSheet, View } from "react-native";
import { PitchLine } from "@/components/art";
import { ChevronRight, Info, Volume2 } from "@/components/glyphs/icons";
import { Card, Chip, IconButton, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { DictionaryEntry, DictionaryHit, WordExample } from "@/lib/content";
import { matchNote, pitchOf, type VariantLine } from "@/lib/state/dictionary";
import type { DictionaryAudio } from "@/lib/state/useDictionary";

/** The line every dictionary screen shows: whose data it is, and that we have not reviewed it yet. */
export const DICTIONARY_SOURCE = "Dictionary data: Nkọwa okwu (Igbo API), CC BY 4.0, used with permission. Not yet reviewed by Okwu.";
export const NOT_REVIEWED = "Not yet reviewed by Okwu";

export function SourceNote({ testID }: { testID: string }) {
  return (
    <View style={styles.source} testID={testID}>
      <Info size={size.iconSm} color={colors.ink68} strokeWidth={2} />
      <T variant="caption" style={styles.flex}>
        {DICTIONARY_SOURCE}
      </T>
    </View>
  );
}

/** Play a dataset recording, or say plainly that it is not here yet. */
export function ClipButton({ id, audio, label, playKey, testID }: { id: string | null; audio: DictionaryAudio; label: string; playKey: string; testID: string }) {
  const kind = audio.availability(id);
  if (kind === "none") return null;
  if (kind === "pending") {
    return (
      <View style={styles.soon} testID={`${testID}-soon`} accessible accessibilityLabel="Recording coming soon">
        <T variant="caption" tone="faint" center>
          Coming soon
        </T>
      </View>
    );
  }
  return (
    <IconButton
      icon={Volume2}
      variant={audio.playing && audio.current === playKey ? "ink" : "tinted"}
      accessibilityLabel={label}
      onPress={() => audio.play(id, playKey)}
      testID={testID}
    />
  );
}

export function headwordOf(e: Pick<DictionaryEntry, "toned" | "spelling">): string {
  return e.toned ?? e.spelling;
}

export function ResultRow({ hit, labels, onPress, divider, testID }: { hit: DictionaryHit; labels: Record<string, string>; onPress: () => void; divider: boolean; testID: string }) {
  const e = hit.entry;
  const note = matchNote(hit, labels);
  return (
    <Press testID={testID} onPress={onPress} pressScale={1} haptics="select" accessibilityLabel={`${e.spelling}: ${e.gloss}`} style={[styles.result, divider && styles.divider]}>
      <View style={styles.flex}>
        <View style={styles.resultHead}>
          <T variant="title" igbo numberOfLines={1}>
            {headwordOf(e)}
          </T>
          {e.pos ? (
            <T variant="caption" tone="faint">
              {e.name ? "name" : e.pos}
            </T>
          ) : null}
        </View>
        <T variant="body" numberOfLines={2}>
          {e.gloss}
        </T>
        {note ? (
          <T variant="caption" tone="accent" testID={`${testID}-note`}>
            {note}
          </T>
        ) : null}
      </View>
      <ChevronRight size={size.iconSm} color={colors.ink48} strokeWidth={2} />
    </Press>
  );
}

export function DictWordCard({ entry, audio, onOpen, eyebrow, testID }: { entry: DictionaryEntry; audio: DictionaryAudio; onOpen: () => void; eyebrow?: string; testID: string }) {
  const pitch = pitchOf(entry.toned);
  return (
    <Card testID={testID}>
      <View style={styles.wordRow}>
        <Press testID={`${testID}-open`} onPress={onOpen} pressScale={1} haptics="select" accessibilityLabel={`Open ${entry.spelling}: ${entry.gloss}`} style={styles.flex}>
          {eyebrow ? (
            <T variant="label" tone="accent">
              {eyebrow}
            </T>
          ) : null}
          <T variant="display" igbo>
            {headwordOf(entry)}
          </T>
          <T variant="body" tone="muted" numberOfLines={2}>
            {entry.gloss.charAt(0).toUpperCase() + entry.gloss.slice(1)}
          </T>
        </Press>
        <ClipButton id={entry.audio} audio={audio} label={`Play ${entry.spelling}`} playKey={`wotd-${entry.id}`} testID={`${testID}-play`} />
      </View>
      {pitch ? <PitchLine tones={pitch.tones} syllables={pitch.syllables} height={48} accessibilityLabel={`Tones: ${pitch.label}`} testID={`${testID}-pitch`} /> : null}
    </Card>
  );
}

export function VariantRow({ line, audio, divider, testID }: { line: VariantLine; audio: DictionaryAudio; divider: boolean; testID: string }) {
  return (
    <View style={[styles.line, divider && styles.divider]} testID={testID}>
      <View style={styles.flex}>
        <T variant="title" igbo>
          {line.spelling}
        </T>
        <T variant="caption">
          {"in "}
          <T variant="caption" igbo tone="secondary">
            {line.where}
          </T>
        </T>
      </View>
      <ClipButton id={line.audio} audio={audio} label={`Play ${line.spelling}, as said in ${line.where}`} playKey={`variant-${testID}`} testID={`${testID}-play`} />
    </View>
  );
}

export function ExampleRow({ example, audio, divider, testID }: { example: WordExample; audio: DictionaryAudio; divider: boolean; testID: string }) {
  return (
    <View style={[styles.line, divider && styles.divider]} testID={testID}>
      <View style={styles.flex}>
        <T variant="body" igbo tone="primary">
          {example.igbo}
        </T>
        <T variant="caption">{example.en}</T>
      </View>
      <ClipButton id={example.audio} audio={audio} label={`Play the sentence: ${example.en}`} playKey={`example-${testID}`} testID={`${testID}-play`} />
    </View>
  );
}

export function TagRow({ wordClass, testID }: { wordClass: string | null; testID: string }) {
  return (
    <View style={styles.tags}>
      {wordClass ? <Chip label={wordClass} testID={`${testID}-class`} /> : null}
      <Chip label={NOT_REVIEWED} tone="reward" testID={`${testID}-unreviewed`} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  source: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
  soon: { minWidth: size.tapMin, minHeight: size.tapMin, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxs },
  result: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, minHeight: 64 },
  resultHead: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  wordRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, marginBottom: space.sm },
  line: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
