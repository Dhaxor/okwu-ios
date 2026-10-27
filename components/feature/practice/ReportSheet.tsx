// "Report a problem": a small sheet on any Igbo content (a lesson word, a
// dictionary entry, a phrase, a conversation line, a name, a proverb, a tale
// line, a custom). Pick what looks wrong (spelling, tone, translation, audio,
// dialect, culture), add a note if you like, send. Reports are kept on this
// phone and queued for our reviewers (lib/state/reports.ts). Several things
// on screen are offered as chips (words) or, when any is a sentence, as a
// list of lines.
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Press, Sheet, T, TextField, useToast } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { graphemeCount } from "@/lib/igbo/text";
import { CATEGORY_LABELS, MAX_NOTE, REPORT_CATEGORIES, canSubmit, type ReportCategory, type ReportSubject } from "@/lib/state/reports";
import { useContentReports } from "@/lib/state/useReports";

/** One thing on screen that could be reported (lib/state/reports ReportSubject). */
export type ReportTarget = ReportSubject;

/** Targets longer than this (in letters) are sentences: offered as a list, not chips. */
const CHIP_MAX = 24;

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** One or more things on screen that could be reported (a tone pair shows several words). */
  targets: ReportTarget[];
  /** The question above several targets (default "Which word", or "Which line" for sentences). */
  pickLabel?: string;
  testID: string;
}

export function ReportSheet({ visible, onClose, targets, pickLabel, testID }: ReportSheetProps) {
  const toast = useToast();
  const { submit } = useContentReports();
  const [which, setWhich] = useState(0);
  const [picked, setPicked] = useState<ReportCategory[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setWhich(0);
    setPicked([]);
    setNote("");
  }, [visible]);

  const target = targets[which] ?? targets[0];
  const asList = targets.some((t) => graphemeCount(t.shown) > CHIP_MAX);
  const toggle = (c: ReportCategory) => setPicked((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const send = () => {
    if (!target || !canSubmit(picked)) return;
    submit({ target: target.target, shown: target.shown, categories: picked, note, source: target.source, version: target.version });
    onClose();
    toast.show("Thank you. Your report is saved for our reviewers.", { tone: "success" });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Report a problem"
      subtitle="A native reviewer reads every report. What looks wrong?"
      scroll
      testID={testID}
      footer={
        <>
          <Button label="Send report" onPress={send} disabled={!canSubmit(picked)} testID={`${testID}-send`} block />
          <Button label="Cancel" variant="ghost" onPress={onClose} testID={`${testID}-cancel`} block />
        </>
      }
    >
      <View style={styles.body}>
        {targets.length > 1 ? (
          <View style={styles.group}>
            <T variant="label">{pickLabel ?? (asList ? "Which line" : "Which word")}</T>
            {asList ? (
              <View style={styles.lines} accessibilityRole="radiogroup">
                {targets.map((t, i) => (
                  <LineOption key={`${t.target.id}-${i}`} subject={t} selected={i === which} onPress={() => setWhich(i)} testID={`${testID}-target-${i}`} />
                ))}
              </View>
            ) : (
              <>
                <View style={styles.chips}>
                  {targets.map((t, i) => (
                    <Chip key={`${t.target.id}-${i}`} label={t.shown} igbo selected={i === which} onPress={() => setWhich(i)} testID={`${testID}-target-${i}`} />
                  ))}
                </View>
                {target?.gloss ? (
                  <T variant="caption" testID={`${testID}-target-gloss`}>
                    {`“${target.gloss}”`}
                  </T>
                ) : null}
              </>
            )}
          </View>
        ) : target ? (
          <View style={styles.word} testID={`${testID}-word`}>
            <T variant="title" igbo>
              {target.shown}
            </T>
            {target.gloss ? (
              <T variant="body" tone="muted">
                {target.gloss}
              </T>
            ) : null}
          </View>
        ) : null}

        <View style={styles.group}>
          <T variant="label">What's wrong</T>
          <View style={styles.chips}>
            {REPORT_CATEGORIES.map((c) => (
              <Chip key={c} label={CATEGORY_LABELS[c].title} selected={picked.includes(c)} onPress={() => toggle(c)} testID={`${testID}-cat-${c}`} />
            ))}
          </View>
          <T variant="caption" testID={`${testID}-hint`}>
            {picked.length > 0 ? picked.map((c) => CATEGORY_LABELS[c].hint).join(". ") + "." : "Pick one or more."}
          </T>
        </View>

        <TextField
          label="Anything to add? (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="For example: in my family we say it with a low tone"
          multiline
          maxLength={MAX_NOTE * 2}
          testID={`${testID}-note`}
        />
      </View>
    </Sheet>
  );
}

/** One sentence to report: the Igbo, its English, a radio mark. */
function LineOption({ subject, selected, onPress, testID }: { subject: ReportTarget; selected: boolean; onPress: () => void; testID: string }) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      haptics="select"
      pressScale={1}
      accessibilityRole="radio"
      accessibilityLabel={subject.gloss ? `${subject.shown}. ${subject.gloss}` : subject.shown}
      accessibilityState={{ checked: selected, selected }}
      style={[styles.line, selected && styles.lineOn]}
    >
      <View style={[styles.ring, selected && styles.ringOn]}>{selected ? <View style={styles.ringDot} /> : null}</View>
      <View style={styles.lineText}>
        <T variant="body" tone="primary" igbo numberOfLines={3}>
          {subject.shown}
        </T>
        {subject.gloss ? (
          <T variant="caption" numberOfLines={2}>
            {subject.gloss}
          </T>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  word: { gap: space.xxs },
  lines: { gap: space.xs },
  line: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  lineOn: { borderColor: colors.ink, backgroundColor: colors.accent06 },
  lineText: { flex: 1, gap: space.xxs },
  ring: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: "center", justifyContent: "center" },
  ringOn: { borderColor: colors.ink },
  ringDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.ink },
});
