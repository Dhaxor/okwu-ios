// One voice note in a Family Circle: who recorded it and how they're
// related, a caption, and a play button with a calm progress line. A note
// addressed to the learner is a "prompt" and says so. Every note is heard by
// the whole circle (`to` is a hint, never a private channel). "…" opens
// report, block and mute (and delete, for its author or the circle keeper).
// A prompt can be answered ("Say it back"); the answer counts towards a
// voice-reply family challenge.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ellipsis, Mic, Pause, Play } from "@/components/glyphs/icons";
import { Button, Chip, IconButton, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { VoiceNoteView } from "@/lib/social";
import { formatDuration, timeAgo } from "@/lib/state";
import { Avatar } from "./Avatar";

export interface VoiceNoteCardProps {
  note: VoiceNoteView;
  /** "Parent", "Cousin" … from the circle. */
  relation?: string;
  mine: boolean;
  forMe: boolean;
  playing: boolean;
  /** 0..1 while playing. */
  progress: number;
  onPlay: () => void;
  onMore: () => void;
  /** Record an answer to this prompt (shown when the learner can send voice notes). */
  onReply?: () => void;
  testID: string;
}

export function VoiceNoteCard({ note, relation, mine, forMe, playing, progress, onPlay, onMore, onReply, testID }: VoiceNoteCardProps) {
  const name = note.author?.displayName ?? "Someone who left";
  const when = timeAgo(note.createdAt, new Date());
  return (
    <View style={[styles.card, forMe && styles.forMe]} testID={testID}>
      <View style={styles.head}>
        <Avatar id={note.from} name={name} size={32} me={mine} />
        <View style={styles.headText}>
          <T variant="body" strong tone="primary" numberOfLines={1}>
            {mine ? "You" : name}
          </T>
          <T variant="caption" numberOfLines={1}>
            {[relation, when].filter(Boolean).join(" · ")}
          </T>
        </View>
        {forMe ? <Chip label="For you" tone="accent" testID={`${testID}-for-you`} /> : null}
        <IconButton icon={Ellipsis} accessibilityLabel={mine ? "More: delete this note" : `More for ${name}'s note: report, block or mute`} onPress={onMore} testID={`${testID}-more`} />
      </View>
      {note.caption ? (
        <T variant="body" tone="secondary" style={styles.caption}>
          {note.caption}
        </T>
      ) : null}
      <Press
        testID={`${testID}-play`}
        onPress={onPlay}
        onLongPress={onMore}
        pressScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? "Pause" : "Play"} ${mine ? "your" : `${name}'s`} voice note, ${formatDuration(note.durationMs)}`}
        style={styles.player}
      >
        <View style={styles.playDisc}>{playing ? <Pause size={size.iconSm} color={colors.onInk} strokeWidth={2.25} /> : <Play size={size.iconSm} color={colors.onInk} strokeWidth={2.25} />}</View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round((playing ? progress : 0) * 100)}%` }]} />
        </View>
        <T variant="caption" numeric tone="secondary">
          {formatDuration(note.durationMs)}
        </T>
      </Press>
      {onReply ? (
        <View style={styles.reply}>
          <Button label="Say it back" icon={Mic} variant="secondary" size="sm" onPress={onReply} testID={`${testID}-reply`} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.hairline, padding: space.md, gap: space.sm },
  forMe: { borderColor: colors.accent, borderWidth: 1.5 },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  headText: { flex: 1 },
  caption: { marginTop: space.xxs },
  player: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48, paddingVertical: space.xxs },
  playDisc: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  track: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  reply: { flexDirection: "row" },
});
