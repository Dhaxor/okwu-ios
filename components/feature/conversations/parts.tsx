// Real-life conversations: the list card, the cast, the practice-mode
// options, cultural tips, the conversation thread (the lesson role-play's
// bubbles, grown up), the panel for your own line, and the calm ending.
// Built from components/ui, components/art and the theme only.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Nnenne } from "@/components/art";
import {
  Baby,
  Church,
  DoorOpen,
  Ear,
  HeartHandshake,
  Headphones,
  House,
  Mic,
  PartyPopper,
  Pause,
  Phone,
  Play,
  RotateCcw,
  ShoppingBasket,
  Signpost,
  Sparkles,
  Volume2,
  type IconComponent,
} from "@/components/glyphs/icons";
import { Button, Card, Chip, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { DRAFT_LINE_NOTICE, TIPS_PENDING_NOTICE, tipParts, tipPlain, type ConversationFile, type ConversationId, type ConversationLine, type CulturalTip, type PracticeMode, type PracticeSummary } from "@/lib/phrasebook";
import type { ClipKind } from "@/lib/phrasebook/hooks";

type Tint = "accent" | "success" | "reward" | "ink";
const TINT: Record<Tint, { ground: string; mark: string }> = {
  accent: { ground: colors.accent12, mark: colors.accent },
  success: { ground: colors.success12, mark: colors.success },
  reward: { ground: colors.reward12, mark: colors.rewardText },
  ink: { ground: colors.ink06, mark: colors.ink },
};

export const CONVERSATION_LOOK: Record<ConversationId, { icon: IconComponent; tint: Tint }> = {
  "partners-family": { icon: HeartHandshake, tint: "accent" },
  "calling-grandma": { icon: Phone, tint: "success" },
  "market-bargain": { icon: ShoppingBasket, tint: "reward" },
  "christmas-home": { icon: House, tint: "accent" },
  wedding: { icon: PartyPopper, tint: "reward" },
  church: { icon: Church, tint: "ink" },
  naming: { icon: Baby, tint: "success" },
  directions: { icon: Signpost, tint: "ink" },
  "welcoming-guests": { icon: DoorOpen, tint: "accent" },
};

export const MODE_COPY: Record<PracticeMode, { title: string; detail: string; icon: IconComponent; start: string }> = {
  listen: { title: "Listen through", detail: "Hear the whole conversation, line by line.", icon: Headphones, start: "Start listening" },
  role: { title: "Take a part", detail: "The others speak; on your lines, hear the native voice and say it with them.", icon: Mic, start: "Start your part" },
  recall: { title: "Say it before you hear it", detail: "See only the English of your lines. Say the Igbo from memory, then check.", icon: Sparkles, start: "Start recalling" },
};

export function ConversationIcon({ id, size: s = 44 }: { id: ConversationId; size?: number }) {
  const look = CONVERSATION_LOOK[id];
  const t = TINT[look.tint];
  return (
    <View style={[styles.badge, { width: s, height: s, backgroundColor: t.ground }]}>
      <look.icon size={s >= 56 ? size.icon + 6 : size.icon} color={t.mark} strokeWidth={2} />
    </View>
  );
}

export function ConversationCard({ conversation, practised, onPress, testID }: { conversation: ConversationFile; practised: number; onPress: () => void; testID: string }) {
  const drafts = conversation.lines.filter((l) => l.provenance === "draft-ai").length;
  return (
    <Card onPress={onPress} accessibilityLabel={`${conversation.title}. ${tipPlain(conversation.setting)}`} testID={testID} style={styles.card}>
      <View style={styles.cardHead}>
        <ConversationIcon id={conversation.id} />
        <View style={styles.flex}>
          <T variant="title">{conversation.title}</T>
          <T variant="caption" numeric>{`${conversation.lines.length} lines · ${conversation.roles.length} people`}</T>
        </View>
      </View>
      <TipText text={conversation.setting} numberOfLines={2} />
      {practised > 0 || drafts > 0 ? (
        <View style={styles.chips}>
          {practised > 0 ? <Chip label={practised === 1 ? "Practised once" : `Practised ${practised} times`} tone="success" testID={`${testID}-practised`} /> : null}
          {drafts > 0 ? <Chip label={drafts === 1 ? "1 line awaits a native rewrite" : `${drafts} lines await a native rewrite`} tone="reward" testID={`${testID}-drafts`} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Initials in a soft circle: the people of the scene. */
export function CastRow({ name, note, mine, testID }: { name: string; note: string; mine: boolean; testID: string }) {
  return (
    <View style={styles.castRow} testID={testID}>
      <View style={[styles.initial, mine ? styles.initialMine : styles.initialThem]}>
        <T variant="body" strong tone={mine ? "onInk" : "primary"}>
          {name.replace(/^(Your|Their|The|A)\s+/i, "").charAt(0).toUpperCase()}
        </T>
      </View>
      <View style={styles.flex}>
        <T variant="body" strong tone="primary">
          {name}
        </T>
        <T variant="caption">{note}</T>
      </View>
      {mine ? <Chip label="Your part" tone="accent" testID={`${testID}-mine`} /> : null}
    </View>
  );
}

export function ModeOption({ mode, selected, onPress, testID }: { mode: PracticeMode; selected: boolean; onPress: () => void; testID: string }) {
  const m = MODE_COPY[mode];
  return (
    <Press
      testID={testID}
      onPress={onPress}
      haptics="select"
      pressScale={0.98}
      accessibilityRole="radio"
      accessibilityLabel={`${m.title}. ${m.detail}`}
      accessibilityState={{ selected }}
      style={[styles.mode, selected ? styles.modeOn : styles.modeOff]}
    >
      <View style={[styles.modeIcon, selected && styles.modeIconOn]}>
        <m.icon size={size.icon} color={selected ? colors.onInk : colors.ink} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <T variant="body" strong tone="primary">
          {m.title}
        </T>
        <T variant="caption">{m.detail}</T>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Press>
  );
}

/** English with Igbo words marked `_like this_` (tips and conversation settings): the Igbo gets its own face. */
export function TipText({ text, variant = "body", strong, tone, numberOfLines }: { text: string; variant?: "body" | "caption"; strong?: boolean; tone?: "primary" | "secondary" | "muted"; numberOfLines?: number }) {
  return (
    <T variant={variant} strong={strong} tone={tone} numberOfLines={numberOfLines}>
      {tipParts(text).map((p, i) =>
        p.igbo ? (
          <T key={i} variant={variant} strong={strong} igbo tone={tone}>
            {p.text}
          </T>
        ) : (
          p.text
        )
      )}
    </T>
  );
}

export function TipCard({ tip, testID }: { tip: CulturalTip; testID: string }) {
  return (
    <Card variant="flat" padding="md" testID={testID} style={styles.tip}>
      <TipText text={tip.title} strong tone="primary" />
      <TipText text={tip.body} tone="secondary" />
    </Card>
  );
}

export function TipsPendingChip({ testID }: { testID: string }) {
  return <Chip label={TIPS_PENDING_NOTICE} tone="reward" testID={testID} />;
}

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

export interface BubbleProps {
  line: ConversationLine;
  who: string;
  mine: boolean;
  /** Which side the speaker sits on (the learner's usual part on the right, even when only listening). */
  right?: boolean;
  current: boolean;
  /** Show the Igbo (false: recall mode, before you reveal your line). */
  showIgbo: boolean;
  clip: ClipKind;
  playing: boolean;
  onPlay: () => void;
  testID: string;
}

export function Bubble({ line, who, mine, right = mine, current, showIgbo, clip, playing, onPlay, testID }: BubbleProps) {
  const canPlay = clip === "asset" || clip === "url";
  const draft = line.provenance === "draft-ai";
  return (
    <View style={[styles.row, right && styles.rowMine]} testID={testID}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : right ? styles.bubbleRight : styles.bubbleThem, current && (mine ? styles.currentMine : styles.currentThem)]}>
        <T variant="caption" strong tone={mine ? "accent" : "muted"}>
          {mine ? `${who} · your line` : who}
        </T>
        {showIgbo ? (
          <T variant="title" igbo testID={`${testID}-igbo`}>
            {line.igbo}
          </T>
        ) : (
          <View style={styles.hidden} testID={`${testID}-hidden`} accessible accessibilityLabel="The Igbo is hidden until you reveal it">
            <View style={[styles.redact, styles.redactLong]} />
            <View style={[styles.redact, styles.redactShort]} />
          </View>
        )}
        <T variant={showIgbo ? "caption" : "body"} tone={showIgbo ? "muted" : "primary"}>
          {line.en}
        </T>
        {draft ? <Chip label={DRAFT_LINE_NOTICE} tone="reward" testID={`${testID}-draft`} /> : null}
      </View>
      {showIgbo && canPlay ? (
        <Press
          testID={`${testID}-play`}
          onPress={onPlay}
          haptics="select"
          accessibilityRole="button"
          accessibilityLabel={playing ? "Playing" : `Play: ${line.en}`}
          style={[styles.play, playing ? styles.playOn : styles.playOff]}
        >
          {playing ? <Pause size={size.iconSm} color={colors.onInk} strokeWidth={2} /> : <Volume2 size={size.iconSm} color={colors.ink} strokeWidth={2} />}
        </Press>
      ) : null}
    </View>
  );
}

/** The panel under your current line: hear it, shadow it, and (on iPhone) record and replay yourself. */
export function YourLinePanel({
  recall,
  revealed,
  clip,
  nativePlaying,
  onHear,
  recorder,
  onRecord,
  onPlayMine,
  testID,
}: {
  recall: boolean;
  revealed: boolean;
  clip: ClipKind;
  nativePlaying: boolean;
  onHear: () => void;
  recorder: { supported: boolean; state: string; uri: string | null };
  onRecord: () => void;
  onPlayMine: () => void;
  testID: string;
}) {
  const canPlay = clip === "asset" || clip === "url";
  const recording = recorder.state === "recording";
  if (recall && !revealed) {
    return (
      <Card variant="ink" padding="md" testID={testID}>
        <View style={styles.panel}>
          <T variant="label" tone="onInkMuted">
            Your line
          </T>
          <T variant="title" tone="onInk">
            Say it in Igbo, out loud, before you hear it.
          </T>
          <T variant="body" tone="onInkMuted">
            Don't worry about getting it perfect. Then check the Igbo and hear the native voice.
          </T>
        </View>
      </Card>
    );
  }
  return (
    <Card padding="md" testID={testID}>
      <View style={styles.panel}>
        <T variant="label" tone="accent">
          {recall ? "Now hear it" : "Your line"}
        </T>
        <View style={styles.panelButtons}>
          {canPlay ? (
            <Button label={nativePlaying ? "Playing…" : "Hear it again"} icon={Ear} variant="secondary" size="md" onPress={onHear} testID={`${testID}-hear`} />
          ) : (
            <Chip label={clip === "pending" ? "Recording coming soon" : "No recording yet"} testID={`${testID}-no-audio`} />
          )}
          {recorder.supported ? (
            <Button
              label={recording ? "Stop" : recorder.state === "recorded" ? "Record again" : "Record yourself"}
              icon={recording ? undefined : recorder.state === "recorded" ? RotateCcw : Mic}
              variant={recording ? "danger" : "secondary"}
              size="md"
              onPress={onRecord}
              testID={`${testID}-record`}
            />
          ) : null}
          {recorder.supported && recorder.state === "recorded" && recorder.uri ? (
            <Button label="Play mine" icon={Play} variant="secondary" size="md" onPress={onPlayMine} testID={`${testID}-mine`} />
          ) : null}
        </View>
        <T variant="caption">
          {recorder.supported
            ? recorder.state === "denied"
              ? "Okwu needs the microphone to let you hear yourself. You can allow it in Settings, or just say it aloud."
              : "Your recording stays on this phone. Compare it with the native voice, then decide."
            : "Recording yourself works in the iPhone app. Here, say it aloud along with the voice."}
        </T>
        <T variant="body" tone="secondary">
          How did it go? Only you decide.
        </T>
      </View>
    </Card>
  );
}

/** The end of a run: one calm peak, what you said, and the lines to try again. Never a score. */
export function PracticeEnd({ summary, conversation, roleName, testID }: { summary: PracticeSummary; conversation: ConversationFile; roleName: string; testID: string }) {
  const title =
    summary.mode === "listen"
      ? "You heard the whole conversation"
      : summary.said === 0
        ? "That's the conversation"
        : summary.said === 1
          ? "You said 1 line aloud"
          : `You said ${summary.said} lines aloud`;
  const detail =
    summary.mode === "listen"
      ? "Next, take a part and say the lines yourself."
      : summary.again.length > 0
        ? "Only you decided how each line went. Nothing was scored."
        : `As ${roleName}, in Igbo. Only you decided how it went; nothing was scored.`;
  return (
    <View style={styles.end} testID={testID}>
      <View style={styles.peak}>
        <Nnenne size={112} mood="glad" />
        <T variant="display" center testID={`${testID}-title`}>
          {title}
        </T>
        <T variant="body" tone="muted" center>
          {detail}
        </T>
      </View>
      {summary.again.length > 0 ? (
        <Card variant="sunk" padding="md" testID={`${testID}-again`}>
          <View style={styles.panel}>
            <T variant="label">Try these again</T>
            {summary.again.map((l, i) => (
              <View key={i} style={styles.againRow}>
                <T variant="body" igbo tone="primary">
                  {l.igbo}
                </T>
                <T variant="caption">{l.en}</T>
              </View>
            ))}
            <T variant="caption">You marked these "not yet". Practise again whenever you like.</T>
          </View>
        </Card>
      ) : null}
    </View>
  );
}

/** Three steps, shown once on the list: how the role-plays work. */
export function HowItWorks({ testID }: { testID: string }) {
  const steps: { icon: IconComponent; title: string; detail: string }[] = [
    { icon: Headphones, title: "Listen", detail: "Hear native speakers play every part." },
    { icon: Mic, title: "Take a part", detail: "Say your lines with them, privately." },
    { icon: Sparkles, title: "Say it first", detail: "Recall your line from the English, then check." },
  ];
  return (
    <Card padding="md" testID={testID}>
      <View style={styles.steps}>
        {steps.map((s, i) => (
          <View key={s.title} style={styles.step} testID={`${testID}-${i}`}>
            <View style={styles.stepIcon}>
              <s.icon size={size.iconSm} color={colors.accent} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <T variant="body" strong tone="primary">
                {s.title}
              </T>
              <T variant="caption">{s.detail}</T>
            </View>
          </View>
        ))}
        <T variant="caption">Nothing you say is recorded unless you choose to, and nothing is ever scored.</T>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: { borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  card: { gap: space.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  castRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  initial: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  initialMine: { backgroundColor: colors.accent },
  initialThem: { backgroundColor: colors.surfaceSunk },
  mode: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  modeOff: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong },
  modeOn: { backgroundColor: colors.accent06, borderColor: colors.ink, borderWidth: 2, padding: space.md - 1 },
  modeIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink06 },
  modeIconOn: { backgroundColor: colors.ink },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.ink },
  tip: { gap: space.xxs },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  rowMine: { flexDirection: "row-reverse" },
  bubble: { flexShrink: 1, maxWidth: "84%", paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.lg, gap: space.xxs },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderBottomLeftRadius: radius.sm },
  bubbleMine: { backgroundColor: colors.accent06, borderWidth: 1, borderColor: colors.accent12, borderBottomRightRadius: radius.sm },
  bubbleRight: { backgroundColor: colors.surfaceSunk, borderWidth: 1, borderColor: colors.hairline, borderBottomRightRadius: radius.sm },
  currentThem: { borderColor: colors.hairlineStrong, borderWidth: 2, paddingVertical: space.sm - 1, paddingHorizontal: space.md - 1 },
  currentMine: { borderColor: colors.accent, borderWidth: 2, paddingVertical: space.sm - 1, paddingHorizontal: space.md - 1 },
  hidden: { paddingVertical: space.xs, gap: space.xs },
  redact: { height: space.md, borderRadius: radius.pill, backgroundColor: colors.accent12 },
  redactLong: { width: 176 },
  redactShort: { width: 112 },
  play: { width: size.tapMin, height: size.tapMin, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  playOff: { backgroundColor: colors.ink06, borderWidth: 1, borderColor: colors.hairline },
  playOn: { backgroundColor: colors.ink },
  panel: { gap: space.sm },
  panelButtons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  end: { gap: space.lg },
  peak: { alignItems: "center", gap: space.sm },
  againRow: { gap: space.xxs },
  steps: { gap: space.md },
  step: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  stepIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.accent12, alignItems: "center", justifyContent: "center" },
});
