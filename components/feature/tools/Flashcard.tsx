// The flashcard and the self-rating bar.
//   front: Igbo (at the Settings tone level) / English / a recording to hear
//   back:  the Igbo with its pitch line, the meaning, the words it is told
//          apart from (tone pairs), and its review state
// Turning the card is a calm quarter-turn (a fade under Reduce Motion, the
// end state in screenshots). Rating is the learner's own: Again is "not
// yet" (it comes back soon), never wrong; the buttons say when each brings
// the card back, from the one FSRS scheduler.
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { PitchLine } from "@/components/art";
import { PlayButton } from "@/components/feature/lesson/parts";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { NOT_REVIEWED } from "@/components/feature/practice";
import { Card, Chip, Press, T, calm, useMotion } from "@/components/ui";
import { colors, motion, radius, shadow, space } from "@/constants/theme";
import type { Rating } from "@/lib/learning";
import type { ToneMarks } from "@/lib/state";
import { RATINGS, type CardView, type StudyFace } from "@/lib/tools";
import { CardIgbo, PlayCard, type CardAudio } from "./ToolsParts";

const PROMPT: Record<StudyFace, { label: string; ask: string }> = {
  "ig-en": { label: "Igbo", ask: "What does it mean?" },
  "en-ig": { label: "English", ask: "How do you say it in Igbo?" },
  audio: { label: "Listen", ask: "What did you hear?" },
};

export function Flashcard({ card, face, flipped, marks, audio, testID }: { card: CardView; face: StudyFace; flipped: boolean; marks: ToneMarks; audio: CardAudio; testID: string }) {
  const policy = useMotion();
  const turn = useSharedValue(policy.still ? 1 : 0);

  useEffect(() => {
    turn.value = 0;
    turn.value = policy.still ? 1 : withTiming(1, { duration: motion.enter, easing: calm });
  }, [flipped, card.ref, policy.still, turn]);

  const moves = policy.moves;
  const look = useAnimatedStyle(() =>
    moves ? { opacity: 0.2 + 0.8 * turn.value, transform: [{ perspective: 1200 }, { rotateY: `${(1 - turn.value) * 70}deg` }, { scale: 0.98 + 0.02 * turn.value }] } : { opacity: turn.value }
  );

  const playing = audio.playing && audio.current === card.ref;
  const tags =
    card.draft || card.unreviewed ? (
      <View style={styles.tags}>
        {card.draft ? <DraftTag testID={`${testID}-draft`} /> : null}
        {card.unreviewed ? <Chip label={NOT_REVIEWED} tone="reward" testID={`${testID}-unreviewed`} /> : null}
      </View>
    ) : null;

  const front = (
    <View style={styles.face}>
      <T variant="label" tone="accent" center>
        {PROMPT[face].label}
      </T>
      {face === "audio" ? (
        <PlayButton onPress={() => audio.play(card)} playing={playing} label="Tap to hear it again" testID={`${testID}-hear`} />
      ) : face === "en-ig" ? (
        <T variant="display" center accessibilityRole="header" testID={`${testID}-prompt`}>
          {card.gloss.charAt(0).toUpperCase() + card.gloss.slice(1)}
        </T>
      ) : (
        <View style={styles.igboRow}>
          <CardIgbo card={card} marks={marks} center testID={`${testID}-prompt`} />
          <PlayCard card={card} audio={audio} testID={`${testID}-play`} />
        </View>
      )}
      <T variant="body" tone="muted" center>
        {PROMPT[face].ask}
      </T>
      <T variant="caption" tone="faint" center>
        Say it to yourself, then show the answer.
      </T>
    </View>
  );

  const back = (
    <View style={styles.face}>
      <View style={styles.igboRow}>
        <CardIgbo card={card} marks={marks} center testID={`${testID}-answer-igbo`} />
        <PlayCard card={card} audio={audio} testID={`${testID}-answer-play`} />
      </View>
      {card.pitch && marks !== "hidden" ? (
        <View style={styles.pitch}>
          <PitchLine tones={card.pitch.tones} syllables={card.pitch.syllables} height={56} accessibilityLabel={`Tones: ${card.pitch.label}`} testID={`${testID}-pitch`} />
          <T variant="caption" center>
            {card.pitch.label.charAt(0).toUpperCase() + card.pitch.label.slice(1)}
          </T>
        </View>
      ) : null}
      <View style={styles.meaning}>
        <T variant="title" center tone="primary" testID={`${testID}-answer-gloss`}>
          {card.gloss.charAt(0).toUpperCase() + card.gloss.slice(1)}
        </T>
      </View>
      {card.partners.length > 0 ? (
        <View style={styles.partners} testID={`${testID}-partners`}>
          <T variant="caption" center>
            Told apart only by tone from
          </T>
          <View style={styles.partnerRow}>
            {card.partners.map((p, i) => (
              <View key={i} style={styles.partner}>
                <T variant="body" igbo tone="primary">
                  {p.marked}
                </T>
                <T variant="caption">{p.gloss}</T>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  // The card fills the space between the top bar and the footer; the footer's button turns it.
  return (
    <Animated.View style={[styles.fill, look]}>
      <Card padding="lg" style={styles.card} testID={flipped ? `${testID}-back` : `${testID}-front`}>
        {flipped ? back : front}
        {tags}
      </Card>
    </Animated.View>
  );
}

const TONE: Record<Rating, { bg: string; fg: "primary" | "onInk" | "reward" | "success" }> = {
  1: { bg: colors.reward12, fg: "reward" },
  2: { bg: colors.surfaceSunk, fg: "primary" },
  3: { bg: colors.ink, fg: "onInk" },
  4: { bg: colors.success12, fg: "success" },
};

/** Again · Hard · Good · Easy, each with when it brings the card back. Good is the ink seal. */
export function RatingBar({ preview, onRate, testID }: { preview: Record<Rating, string>; onRate: (r: Rating) => void; testID: string }) {
  return (
    <View style={styles.rating} testID={testID}>
      {RATINGS.map((r) => (
        <Press
          key={r.rating}
          testID={`${testID}-${r.rating}`}
          onPress={() => onRate(r.rating)}
          haptics={r.rating === 1 ? "select" : "tap"}
          accessibilityLabel={`${r.label}: ${r.hint}. Back in ${preview[r.rating]}`}
          style={[styles.rate, { backgroundColor: TONE[r.rating].bg }, r.rating === 3 && styles.rateMain]}
        >
          <T variant="body" strong tone={TONE[r.rating].fg} center numberOfLines={1}>
            {r.label}
          </T>
          <T variant="caption" tone={r.rating === 3 ? "onInkMuted" : "muted"} center numeric numberOfLines={1}>
            {preview[r.rating]}
          </T>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
  card: { flexGrow: 1, minHeight: 280, justifyContent: "center" },
  face: { alignItems: "center", gap: space.md },
  igboRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, flexWrap: "wrap" },
  pitch: { alignSelf: "stretch", gap: space.xxs, paddingHorizontal: space.md },
  meaning: { paddingTop: space.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, alignSelf: "stretch" },
  partners: { alignSelf: "stretch", gap: space.xs, padding: space.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
  partnerRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: space.lg, rowGap: space.xs },
  partner: { alignItems: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.xs, marginTop: space.lg },
  rating: { flexDirection: "row", gap: space.xs },
  rate: { flex: 1, minHeight: 56, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", paddingVertical: space.xs, paddingHorizontal: space.xxs },
  rateMain: { boxShadow: shadow.inkButton },
});
