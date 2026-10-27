// The end of a practice session: one calm peak and an honest summary.
//   ReviewEnd       daily review: words kept fresh, minutes, XP
//   TrainerResults  tone trainer: heard right the first time, per tone pattern
//   SpokenEnd       say it: how many words were said aloud (never a score)
import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Nnenne, PitchLine } from "@/components/art";
import { RewardBloom } from "@/components/art/game/CollectionArt";
import { Card, Chip, ProgressBar, T } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import type { TrainerResults } from "@/lib/state/practice";
import type { SessionSummary } from "../lesson/LessonPlayer";

function Stat({ value, label, testID }: { value: string; label: string; testID: string }) {
  return (
    <Card variant="sunk" padding="md" style={styles.stat} testID={testID}>
      <T variant="title" numeric strong tone="primary" center>
        {value}
      </T>
      <T variant="caption" center>
        {label}
      </T>
    </Card>
  );
}

function Peak({ label, title, detail, testID }: { label: string; title: string; detail?: string; testID: string }) {
  // Smaller on SE-class phones, so the summary under it stays in view.
  const { height } = useWindowDimensions();
  const small = height < 760;
  return (
    <View style={styles.peak} testID={testID}>
      <RewardBloom size={small ? 128 : 176}>
        <Nnenne size={small ? 76 : 104} ground="ochre" mood="glad" />
      </RewardBloom>
      <View style={styles.copy}>
        <T variant="label" tone="accent" center>
          {label}
        </T>
        <T variant="display" center accessibilityRole="header">
          {title}
        </T>
        {detail ? (
          <T variant="body" tone="muted" center>
            {detail}
          </T>
        ) : null}
      </View>
    </View>
  );
}

export function ReviewEnd({ summary, reviewed, testID }: { summary: SessionSummary; reviewed: number; testID: string }) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Peak label="Review done" title={summary.peak?.title ?? "Every word kept fresh"} detail={summary.peak?.detail ?? "Each one comes back just before you'd forget it."} testID={`${testID}-peak`} />
      <View style={styles.stats}>
        <Stat value={String(reviewed)} label={reviewed === 1 ? "word" : "words"} testID={`${testID}-words`} />
        <Stat value={String(summary.minutes)} label={summary.minutes === 1 ? "minute" : "minutes"} testID={`${testID}-minutes`} />
        {/* Same-day repeats earn no XP (the farming cap); a "+0" tile would read as nothing earned. */}
        {summary.xp > 0 ? <Stat value={`+${summary.xp}`} label="XP" testID={`${testID}-xp`} /> : null}
      </View>
    </View>
  );
}

export function TrainerResultsView({ results, testID }: { results: TrainerResults; testID: string }) {
  const { correct, total } = results;
  const title = total === 0 ? "Nothing heard this time" : correct === total ? "Every tone heard" : `${correct} of ${total} heard right`;
  const detail =
    total === 0
      ? "Come back when you can listen: it takes about five minutes."
      : results.rightOnRetry > 0
        ? `On the first try. ${results.rightOnRetry} more came right the second time. The tones you missed come back sooner.`
        : "On the first try. The tones you missed come back sooner.";
  return (
    <View style={styles.wrap} testID={testID}>
      <Peak label="Tone trainer" title={title} detail={detail} testID={`${testID}-peak`} />
      {results.patterns.length > 0 ? (
        <Card padding="md" testID={`${testID}-patterns`}>
          <T variant="label" style={styles.cardLabel}>
            By tone pattern
          </T>
          {results.patterns.map((p, i) => (
            <View key={p.pattern} style={[styles.pattern, i > 0 && styles.patternRule]} testID={`${testID}-pattern-${p.pattern}`}>
              <View style={styles.patternHead}>
                <View style={styles.pitch}>
                  <PitchLine tones={p.tones} height={28} accessibilityLabel={`Tones: ${p.label}`} />
                </View>
                <View style={styles.flex}>
                  <T variant="body" tone="primary">
                    {p.label.charAt(0).toUpperCase() + p.label.slice(1)}
                  </T>
                  <T variant="caption" igbo numberOfLines={1}>
                    {p.words.join("  ·  ")}
                  </T>
                </View>
                <T variant="body" strong numeric tone="primary" testID={`${testID}-pattern-${p.pattern}-count`}>
                  {`${p.correct} of ${p.total}`}
                </T>
              </View>
              <ProgressBar value={p.correct / p.total} steps={p.total <= 12 ? p.total : undefined} tone="reward" accessibilityLabel={`${p.label}: ${p.correct} of ${p.total} heard right`} />
            </View>
          ))}
        </Card>
      ) : null}
      <T variant="caption" center testID={`${testID}-note`}>
        This counts what you heard, not how you speak. Your speaking is never scored.
      </T>
    </View>
  );
}

export function SpokenEnd({ said, notYet, summary, testID }: { said: number; /** Words the learner marked "not yet", as shown (tone-marked). */ notYet: string[]; summary: SessionSummary; testID: string }) {
  const detail = said === 0 ? "Come back when you can speak aloud." : "Only you decided how it went. Nothing was scored.";
  return (
    <View style={styles.wrap} testID={testID}>
      <Peak label="Say it" title={said === 1 ? "You said 1 word aloud" : `You said ${said} words aloud`} detail={detail} testID={`${testID}-peak`} />
      <View style={styles.stats}>
        <Stat value={String(summary.minutes)} label={summary.minutes === 1 ? "minute" : "minutes"} testID={`${testID}-minutes`} />
        {summary.xp > 0 ? <Stat value={`+${summary.xp}`} label="XP" testID={`${testID}-xp`} /> : null}
      </View>
      {notYet.length > 0 ? (
        <Card variant="sunk" padding="md" testID={`${testID}-again`}>
          <T variant="label" style={styles.cardLabel}>
            Coming back sooner
          </T>
          <View style={styles.chips}>
            {notYet.map((w, i) => (
              <Chip key={`${w}-${i}`} label={w} igbo testID={`${testID}-again-${i}`} />
            ))}
          </View>
          <T variant="caption" style={styles.after}>
            You marked these "not yet". They come back in your reviews soon, so you can try again.
          </T>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, alignItems: "stretch" },
  peak: { alignItems: "center", gap: space.md },
  copy: { gap: space.xs, alignItems: "center" },
  stats: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, gap: space.xxs },
  flex: { flex: 1 },
  cardLabel: { marginBottom: space.xs },
  pattern: { gap: space.sm, paddingVertical: space.sm },
  patternRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  patternHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pitch: { width: 64 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  after: { marginTop: space.sm },
});
