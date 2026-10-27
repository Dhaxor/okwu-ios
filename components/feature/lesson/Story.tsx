// Story card: a graded story (Akụkọ) under its real title. A dataset
// sequence is read line by line; a bilingual retelling sets each English
// paragraph with the recorded Igbo lines it carries. Every Igbo line plays,
// shows its tones (A0–A1) or reveals them on a tap (A2+), and has its own
// English toggle; one switch shows or hides the English for the whole
// story. Reading to the end collects the chapter; nothing is scheduled or
// scored. The questions about it come after (the session orders them).
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AkweteBand } from "@/components/art";
import { Languages, Volume2 } from "@/components/glyphs/icons";
import { Card, IconButton, Press, Switch, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { needsDraftTag, storyOf, storyParts, textNeedsDraftTag } from "@/lib/content";
import type { Item, StoryText } from "@/lib/content/types";
import type { ItemAudio, ToneMarks } from "@/lib/state";
import { ExerciseHeader, ItemText, PendingNotice } from "./parts";
import type { ExerciseViewProps } from "./types";

const KIND_LINE: Record<StoryText["kind"], string> = {
  "dataset-sequence": "Read it line by line, and play each line to hear it.",
  "bilingual-retelling": "The story is told in English. Read and play the Igbo lines as they come.",
};

function StoryLine({
  item,
  index,
  marks,
  audio,
  english,
  onToggle,
  quote,
  testID,
}: {
  item: Item;
  index: number;
  marks: ToneMarks;
  audio: ItemAudio;
  english: boolean;
  onToggle: () => void;
  /** Set inside an English retelling: a camwood bar marks the Igbo. */
  quote: boolean;
  testID: string;
}) {
  const key = `story-${index}`;
  const can = audio.availability(item) === "playing";
  return (
    <View style={[styles.line, quote && styles.quote]} testID={testID}>
      {quote ? <View style={styles.quoteBar} /> : null}
      <View style={styles.lineText}>
        <ItemText item={item} marks={marks} variant="title" testID={`${testID}-text`} />
        {english ? (
          <T variant="body" tone="muted" testID={`${testID}-en`}>
            {item.gloss.en}
          </T>
        ) : null}
        <Press
          testID={`${testID}-english`}
          onPress={onToggle}
          pressScale={1}
          haptics="select"
          accessibilityRole="button"
          accessibilityLabel={english ? `Hide the English for line ${index + 1}` : `Show the English for line ${index + 1}`}
          accessibilityState={{ expanded: english }}
          style={styles.toggle}
        >
          <Languages size={size.iconSm - 2} color={colors.accent} strokeWidth={2} />
          <T variant="caption" strong tone="accent">
            {english ? "Hide English" : "English"}
          </T>
        </Press>
        {!can ? <PendingNotice testID={`${testID}-pending`} /> : null}
      </View>
      {can ? (
        <IconButton
          icon={Volume2}
          variant={audio.playing && audio.current === key ? "ink" : "tinted"}
          accessibilityLabel={`Play line ${index + 1}`}
          onPress={() => audio.play(item, { key })}
          testID={`${testID}-play`}
          style={styles.play}
        />
      ) : null}
    </View>
  );
}

export function StoryView({ exercise, bundle, marks, audio, onMode, onSubmit, testID }: ExerciseViewProps) {
  const spec = exercise.spec.type === "story" ? exercise.spec : null;
  const story = spec ? storyOf(bundle, spec.story) : null;
  const lines = (spec?.items ?? []).map((id) => bundle.items[id]).filter((i): i is Item => !!i);
  const [open, setOpen] = useState<boolean[]>(() => lines.map(() => false));
  // The chapter decides: tones shown at A0–A1, tap to reveal from A2 (the learner can still hide them).
  const level = marks === "hidden" ? "hidden" : spec?.tones === "reveal" ? "reveal" : marks;

  useEffect(() => {
    onMode({ kind: "next", label: "I've read it", onPress: () => onSubmit({ type: "self", matched: true }) });
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec) return null;
  const all = lines.length > 0 && open.every(Boolean);
  const setAll = (v: boolean) => setOpen(lines.map(() => v));
  const toggle = (i: number) => setOpen((o) => o.map((x, j) => (j === i ? !x : x)));
  // A retelling sets its English paragraphs between the lines (only when the story's lines are the ones on screen).
  const retelling = !!story && story.kind === "bilingual-retelling" && story.lines.length === lines.length;
  const parts = story && retelling ? storyParts(story) : lines.map((_, index) => ({ kind: "line" as const, index }));
  const draft = lines.some(needsDraftTag) || (!!story && textNeedsDraftTag(story));

  return (
    <View style={styles.wrap}>
      <ExerciseHeader label={story ? "A story" : "Story"} title={story?.title ?? `Chapter ${spec.chapter}`} draft={draft} testID={`${testID}-header`} />
      {story ? (
        <T variant="body" tone="muted" style={styles.lead}>
          {KIND_LINE[story.kind]}
        </T>
      ) : null}
      <View style={styles.allRow}>
        <T variant="body" tone="primary" style={styles.flex}>
          Show all the English
        </T>
        <Switch value={all} onValueChange={setAll} accessibilityLabel="Show the English for the whole story" testID={`${testID}-english`} />
      </View>
      <Card padding="none" testID={`${testID}-card`}>
        <AkweteBand height={20} />
        <View style={[styles.page, retelling && styles.pageRetelling]}>
          {parts.map((p, i) => {
            if (p.kind === "text") {
              return (
                <T key={`p-${i}`} variant="body" tone="primary" style={styles.para} testID={`${testID}-para-${i}`}>
                  {p.text}
                </T>
              );
            }
            const item = lines[p.index];
            if (!item) return null;
            const next = parts[i + 1];
            return (
              <View key={`l-${p.index}`} style={!retelling && next ? styles.rule : undefined}>
                <StoryLine
                  item={item}
                  index={p.index}
                  marks={level}
                  audio={audio}
                  english={!!open[p.index]}
                  onToggle={() => toggle(p.index)}
                  quote={retelling}
                  testID={`${testID}-line-${p.index}`}
                />
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  lead: { marginTop: -space.xs },
  flex: { flex: 1 },
  allRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  page: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  pageRetelling: { paddingHorizontal: space.md, paddingVertical: space.lg, gap: space.md },
  para: { lineHeight: 28, paddingHorizontal: space.xs },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  quote: { alignItems: "stretch", paddingVertical: space.xs, paddingRight: space.xs, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
  quoteBar: { width: 3, marginLeft: space.sm, marginVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.accent },
  lineText: { flex: 1, gap: space.xxs, alignItems: "flex-start" },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.xxs, minHeight: size.tapMin, paddingRight: space.sm, marginVertical: -space.xs },
  play: { alignSelf: "center" },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
});
