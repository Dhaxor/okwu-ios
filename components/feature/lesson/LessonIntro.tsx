// The lesson's opening card: where it sits on the path, how long it takes
// (the planned session's own estimate), the pattern note with examples to
// hear, the story it reads, and what the learner will be able to do. One
// primary action, in the thumb zone: start.
import React from "react";
import { StyleSheet, View } from "react-native";
import { AkweteBand } from "@/components/art";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { ArrowRight, BookOpen, Check, Clock, Sparkles, X } from "@/components/glyphs/icons";
import { Button, Card, Chip, IconButton, Screen, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { storyOf, textNeedsDraftTag } from "@/lib/content";
import type { ContentBundle, Lesson, StoryText } from "@/lib/content/types";
import type { ItemAudio, ToneMarks } from "@/lib/state";
import { PatternCard } from "./PatternCard";

export interface LessonIntroProps {
  bundle: ContentBundle;
  lesson: Lesson;
  /** "Unit 3 · Lesson 2". */
  eyebrow: string;
  /** The planned session's estimate. */
  minutes: number;
  /** Items this session introduces for the first time. */
  newWords: number;
  marks: ToneMarks;
  audio: ItemAudio;
  onStart: () => void;
  onClose: () => void;
  testID: string;
}

/** The objectives as the learner reads them ("Pattern: " is the card's job). */
export function objectivesOf(lesson: Pick<Lesson, "objectives">): string[] {
  return lesson.objectives.map((o) => o.replace(/^pattern:\s*/i, "")).map((o) => (o ? o[0]!.toUpperCase() + o.slice(1) : o)).filter(Boolean);
}

const STORY_KIND: Record<StoryText["kind"], (n: number) => string> = {
  "dataset-sequence": (n) => `${n} Igbo lines, each recorded by a native speaker, read as one scene.`,
  "bilingual-retelling": (n) => `Told in English, with ${n} Igbo lines recorded by native speakers.`,
};

export function LessonIntro({ bundle, lesson, eyebrow, minutes, newWords, marks, audio, onStart, onClose, testID }: LessonIntroProps) {
  const storyEx = lesson.exercises.find((e) => e.type === "story");
  const story = storyEx?.type === "story" ? storyOf(bundle, storyEx.story) : null;
  const objectives = objectivesOf(lesson);
  return (
    <Screen
      testID={testID}
      footer={<Button label={story ? "Start reading" : "Start lesson"} icon={ArrowRight} iconPosition="trailing" onPress={onStart} testID={`${testID}-start`} block />}
    >
      <View style={styles.bar}>
        <IconButton icon={X} accessibilityLabel="Close" onPress={onClose} testID={`${testID}-close`} />
      </View>

      <View style={styles.head}>
        <T variant="label" tone="accent">
          {eyebrow}
        </T>
        <T variant="display" accessibilityRole="header">
          {lesson.title}
        </T>
        <View style={styles.chips}>
          <Chip label={`About ${minutes} min`} icon={Clock} testID={`${testID}-minutes`} />
          {newWords > 0 ? (
            <Chip label={`${newWords} new ${newWords === 1 ? "word" : "words"}`} icon={Sparkles} tone="accent" testID={`${testID}-new`} />
          ) : story ? (
            <Chip label="A story" icon={BookOpen} tone="accent" testID={`${testID}-story-chip`} />
          ) : (
            <Chip label="Review" tone="accent" testID={`${testID}-review-chip`} />
          )}
        </View>
      </View>

      {lesson.note ? <PatternCard note={lesson.note} bundle={bundle} marks={marks} audio={audio} testID={`${testID}-pattern`} /> : null}

      {story ? (
        <Card padding="none" testID={`${testID}-story`}>
          <AkweteBand height={16} />
          <View style={styles.story}>
            <T variant="label" tone="accent">
              A story
            </T>
            <T variant="title">{story.title}</T>
            <T variant="body" tone="secondary">
              {STORY_KIND[story.kind](story.lines.length)}
            </T>
            <T variant="caption">Read it first. The questions come after.</T>
            {textNeedsDraftTag(story) ? <DraftTag testID={`${testID}-story-draft`} /> : null}
          </View>
        </Card>
      ) : null}

      {objectives.length > 0 ? (
        <View style={styles.goals} testID={`${testID}-objectives`}>
          <T variant="label">In this lesson</T>
          {objectives.map((o, i) => (
            <View key={i} style={styles.goal}>
              <View style={styles.tick}>
                <Check size={size.iconSm - 4} color={colors.accent} strokeWidth={3} />
              </View>
              <T variant="body" tone="primary" style={styles.flex}>
                {o}
              </T>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", marginBottom: -space.md },
  head: { gap: space.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
  story: { padding: space.lg, gap: space.xs },
  goals: { gap: space.sm },
  goal: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  tick: { width: 24, height: 24, marginTop: 0, borderRadius: radius.pill, backgroundColor: colors.accent12, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
});
