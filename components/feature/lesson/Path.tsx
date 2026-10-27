// The Learn tab's path pieces: a unit framed by the Obodo place it
// restores, its lessons (done, next, open, locked), and the word of the day.
import React from "react";
import { StyleSheet, View } from "react-native";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { Check, ChevronRight, Lock, Volume2 } from "@/components/glyphs/icons";
import { Card, Chip, IconButton, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { PLACE_NAMES_EN, type GameLabels } from "@/lib/game";
import type { ObodoStage } from "@/lib/game/types";
import { needsDraftTag } from "@/lib/content";
import type { Item } from "@/lib/content/types";
import type { ItemAudio, PathLesson, PathUnit, ToneMarks } from "@/lib/state";
import { ItemPitch, ItemText, PendingNotice } from "./parts";

const STAGE: Record<ObodoStage, string> = { 0: "Not begun yet", 1: "Waking up", 2: "Coming back to life", 3: "Whole again" };
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function PlaceBadge({ unit, stage, labels }: { unit: PathUnit; stage: ObodoStage; labels: GameLabels }) {
  if (!unit.place) return null;
  const igbo = labels.places?.[unit.place];
  return (
    <View style={styles.place} accessible accessibilityLabel={`Restores your ${PLACE_NAMES_EN[unit.place]}: ${STAGE[stage]}`}>
      <View style={styles.placeBeads}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.placeBead, i <= stage && styles.placeBeadOn]} />
        ))}
      </View>
      <T variant="caption" strong tone="secondary">
        Restores your{" "}
        <T variant="caption" strong igbo={!!igbo} tone="secondary">
          {igbo ?? PLACE_NAMES_EN[unit.place]}
        </T>
        <T variant="caption" tone="muted">{` · ${STAGE[stage]}`}</T>
      </T>
    </View>
  );
}

function LessonRow({ lesson, last, showDraft, onOpen, testID }: { lesson: PathLesson; last: boolean; showDraft: boolean; onOpen: () => void; testID: string }) {
  const locked = lesson.status === "locked";
  const body = (
    <>
      <View style={[styles.dot, lesson.status === "done" && styles.dotDone, lesson.status === "next" && styles.dotNext]}>
        {lesson.status === "done" ? (
          <Check size={size.iconSm - 4} color={colors.onInk} strokeWidth={3} />
        ) : locked ? (
          <Lock size={size.iconSm - 4} color={colors.ink48} strokeWidth={2} />
        ) : (
          <T variant="caption" strong numeric tone={lesson.status === "next" ? "onInk" : "secondary"}>
            {String(lesson.number)}
          </T>
        )}
      </View>
      <View style={styles.lessonText}>
        <T variant="body" tone={locked ? "faint" : "primary"} strong={lesson.status === "next"}>
          {lesson.title}
        </T>
        <T variant="caption" tone={locked ? "faint" : "muted"}>
          {lesson.status === "done" ? "Done · practise again any time" : lesson.status === "next" ? `Next · about ${lesson.estMinutes} min` : locked ? "Opens with this unit" : `About ${lesson.estMinutes} min`}
        </T>
        {showDraft && lesson.draft && !locked ? (
          <View style={styles.rowDraft}>
            <DraftTag testID={`${testID}-draft`} />
          </View>
        ) : null}
      </View>
      {!locked ? <ChevronRight size={size.iconSm} color={colors.ink48} strokeWidth={2} /> : null}
    </>
  );
  const look = [styles.lesson, !last && styles.lessonRule];
  if (locked) {
    return (
      <View style={look} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Press testID={testID} onPress={onOpen} pressScale={1} haptics="select" accessibilityLabel={`Lesson ${lesson.number}: ${lesson.title}. ${lesson.status === "done" ? "Done" : lesson.status === "next" ? "Next" : "Open"}`} style={look}>
      {body}
    </Press>
  );
}

export function UnitCard({
  unit,
  previous,
  stage,
  labels,
  onOpenLesson,
  plus = false,
  testID,
}: {
  unit: PathUnit;
  previous: PathUnit | null;
  stage: ObodoStage;
  labels: GameLabels;
  onOpenLesson: (lesson: PathLesson) => void;
  /** The unit is in Okwu Plus and the learner doesn't have it: a quiet tag (opening a lesson shows the paywall). */
  plus?: boolean;
  testID: string;
}) {
  const locked = unit.status === "locked";
  // One tag for the unit when every lesson in it is a draft; otherwise on each draft lesson.
  const allDraft = unit.lessons.length > 0 && unit.lessons.every((l) => l.draft);
  return (
    <Card variant={locked ? "sunk" : "flat"} padding="md" testID={testID}>
      <View style={styles.unitHead}>
        <View style={styles.unitTitle}>
          <T variant="label" tone={locked ? "faint" : unit.status === "done" ? "success" : "accent"}>
            {`Unit ${unit.number}${unit.status === "done" ? " · Complete" : ""}`}
          </T>
          <T variant="title" tone={locked ? "muted" : "primary"}>
            {unit.title}
          </T>
          <T variant="caption" tone={locked ? "faint" : "muted"}>
            {unit.theme}
          </T>
        </View>
        {plus ? <Chip label="Okwu Plus" tone="reward" testID={`${testID}-plus`} /> : locked ? <Lock size={size.icon} color={colors.ink48} strokeWidth={2} /> : null}
      </View>
      {!locked ? <PlaceBadge unit={unit} stage={stage} labels={labels} /> : null}
      {!locked && allDraft ? (
        <View style={styles.unitDraft}>
          <DraftTag testID={`${testID}-draft`} />
        </View>
      ) : null}
      {locked ? (
        <T variant="caption" tone="muted" style={styles.lockNote}>
          {previous ? `Opens when you finish ${previous.title}.` : "Opens soon."}
        </T>
      ) : unit.lessons.length === 0 ? (
        <T variant="caption" tone="muted" style={styles.lockNote}>
          Lessons for this unit are being recorded.
        </T>
      ) : (
        <View style={styles.lessons}>
          {unit.lessons.map((l, i) => (
            <LessonRow key={l.id} lesson={l} last={i === unit.lessons.length - 1} showDraft={!allDraft} onOpen={() => onOpenLesson(l)} testID={`${testID}-lesson-${l.number}`} />
          ))}
        </View>
      )}
    </Card>
  );
}

export function WordOfTheDayCard({ item, marks, audio, testID }: { item: Item; marks: ToneMarks; audio: ItemAudio; testID: string }) {
  const can = audio.availability(item) === "playing";
  return (
    <Card testID={testID}>
      <View style={styles.wordRow}>
        <View style={styles.wordText}>
          <ItemText item={item} marks={marks} testID={`${testID}-text`} />
          <T variant="body" tone="muted">
            {cap(item.gloss.en)}
          </T>
        </View>
        {can ? (
          <IconButton
            icon={Volume2}
            variant={audio.playing && audio.current === item.id ? "ink" : "tinted"}
            accessibilityLabel={`Play ${item.spelling}`}
            onPress={() => audio.play(item)}
            testID={`${testID}-play`}
          />
        ) : null}
      </View>
      <ItemPitch item={item} height={56} testID={`${testID}-pitch`} />
      {!can || needsDraftTag(item) ? (
        <View style={styles.wordTags}>
          {!can ? <PendingNotice testID={`${testID}-pending`} /> : null}
          {needsDraftTag(item) ? <DraftTag testID={`${testID}-draft`} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

/** A quiet placeholder while the bundle and the saved progress load. */
export function PathSkeleton({ testID }: { testID: string }) {
  return (
    <View style={styles.skeleton} testID={testID} accessible accessibilityLabel="Opening your lessons">
      <View style={[styles.ghost, styles.ghostHero]} />
      <View style={[styles.ghost, styles.ghostCard]} />
      <View style={[styles.ghost, styles.ghostCard]} />
    </View>
  );
}

const styles = StyleSheet.create({
  place: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.sm },
  placeBeads: { flexDirection: "row", gap: space.xxs },
  placeBead: { width: 6, height: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.rewardText },
  placeBeadOn: { backgroundColor: colors.rewardText },
  unitHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  unitTitle: { flex: 1, gap: space.xxs },
  lockNote: { marginTop: space.sm },
  unitDraft: { marginTop: space.xs },
  lessons: { marginTop: space.sm },
  lesson: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  lessonRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  lessonText: { flex: 1 },
  rowDraft: { marginTop: space.xxs },
  dot: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSunk },
  dotDone: { backgroundColor: colors.success },
  dotNext: { backgroundColor: colors.accent },
  wordRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: space.sm, gap: space.md },
  wordText: { flex: 1, gap: space.xxs },
  wordTags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  skeleton: { gap: space.lg },
  ghost: { borderRadius: radius.xl, backgroundColor: colors.surfaceSunk },
  ghostHero: { height: 224 },
  ghostCard: { height: 160 },
});
