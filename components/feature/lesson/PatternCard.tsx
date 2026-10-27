// The lesson's pattern card: its grammar or usage note in plain English,
// with Igbo examples to hear (each with its tones at the learner's level,
// its meaning and its recording) and, sometimes, a word on culture. Shown
// at the lesson start and re-opened from the lesson's top bar.
import React from "react";
import { StyleSheet, View } from "react-native";
import { AkweteBand } from "@/components/art";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { BookOpen, Volume2 } from "@/components/glyphs/icons";
import { Card, IconButton, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { needsDraftTag, textNeedsDraftTag } from "@/lib/content";
import type { ContentBundle, Item, LessonNote } from "@/lib/content/types";
import type { ItemAudio, ToneMarks } from "@/lib/state";
import { ItemText, PendingNotice } from "./parts";

export interface PatternCardProps {
  note: LessonNote;
  bundle: ContentBundle;
  marks: ToneMarks;
  audio: ItemAudio;
  /** Without the card and its woven band (inside a sheet). */
  bare?: boolean;
  testID: string;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function Example({ item, marks, audio, last, testID }: { item: Item; marks: ToneMarks; audio: ItemAudio; last: boolean; testID: string }) {
  const key = `note-${item.id}`;
  const can = audio.availability(item) === "playing";
  return (
    <View style={[styles.example, !last && styles.rule]} testID={testID}>
      <View style={styles.exampleText}>
        <ItemText item={item} marks={marks} variant="title" testID={`${testID}-text`} />
        <T variant="body" tone="muted">
          {cap(item.gloss.en)}
        </T>
        {!can ? <PendingNotice testID={`${testID}-pending`} /> : null}
      </View>
      {can ? (
        <IconButton
          icon={Volume2}
          variant={audio.playing && audio.current === key ? "ink" : "tinted"}
          accessibilityLabel={`Play ${item.spelling}`}
          onPress={() => audio.play(item, { key })}
          testID={`${testID}-play`}
        />
      ) : null}
    </View>
  );
}

export function PatternCard({ note, bundle, marks, audio, bare = false, testID }: PatternCardProps) {
  const examples = note.examples.map((id) => bundle.items[id]).filter((i): i is Item => !!i);
  const draft = textNeedsDraftTag(note) || examples.some(needsDraftTag);
  const body = (
    <View style={[styles.inner, bare && styles.innerBare]}>
      <View style={styles.head}>
        <View style={styles.eyebrow}>
          <BookOpen size={size.iconSm} color={colors.accent} strokeWidth={2} />
          <T variant="label" tone="accent">
            {note.pattern ? "The pattern" : "Good to know"}
          </T>
        </View>
        <T variant="title" accessibilityRole="header">
          {note.pattern ?? note.title}
        </T>
      </View>
      {note.body ? (
        <T variant="body" tone="secondary">
          {note.body}
        </T>
      ) : null}
      {examples.length > 0 ? (
        <View style={styles.examples} testID={`${testID}-examples`}>
          {examples.map((item, i) => (
            <Example key={item.id} item={item} marks={marks} audio={audio} last={i === examples.length - 1} testID={`${testID}-example-${i}`} />
          ))}
        </View>
      ) : null}
      {note.culture ? (
        <View style={styles.culture} testID={`${testID}-culture`}>
          <View style={styles.cultureBar} />
          <View style={styles.cultureText}>
            <T variant="label" tone="reward">
              Culture
            </T>
            <T variant="body" tone="secondary">
              {note.culture}
            </T>
          </View>
        </View>
      ) : null}
      {draft ? <DraftTag testID={`${testID}-draft`} /> : null}
    </View>
  );
  if (bare) return <View testID={testID}>{body}</View>;
  return (
    <Card padding="none" testID={testID}>
      <AkweteBand height={16} />
      {body}
    </Card>
  );
}

const styles = StyleSheet.create({
  inner: { padding: space.lg, gap: space.md },
  innerBare: { padding: 0 },
  head: { gap: space.xs },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  examples: { borderRadius: radius.lg, backgroundColor: colors.surfaceSunk, paddingHorizontal: space.md },
  example: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  exampleText: { flex: 1, gap: space.xxs },
  culture: { flexDirection: "row", gap: space.sm },
  cultureBar: { width: 3, borderRadius: radius.pill, backgroundColor: colors.reward },
  cultureText: { flex: 1, gap: space.xxs },
});
