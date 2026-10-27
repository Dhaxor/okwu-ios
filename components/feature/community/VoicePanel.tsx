// Voice notes: what stands in the way, said plainly, and the send sheet.
//
// The rules (server/src/circles.ts, mirrored in lib/state/community
// voiceState): everyone accepts the voice-note terms for themself (heard by
// the whole circle, kept 90 days). A teen also needs a parent or guardian in
// the circle to say yes from their own account; the guardian's details are
// never stored on the teen's account, only a reference. Who the teen may ask
// comes from the server (`canBeGuardian`: the adults in the circle, told to
// the teen only), and the server checks it again when they ask.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Check, Clock, HeartHandshake, Mic, Play, ShieldCheck, type IconComponent } from "@/components/glyphs/icons";
import { Button, Card, Chip, Press, Sheet, T, TextField } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { AccountId, CircleMember, PublicProfile } from "@/lib/social";
import { RELATION_LABELS, chatFeedback, formatDuration, type VoiceState } from "@/lib/state";
import { Avatar } from "./Avatar";

const CAPTION_MAX = 120;

export function VoiceGateCard({ state, retentionDays, picked, onPick, testID }: { state: VoiceState; retentionDays: number; picked: AccountId | null; onPick: (id: AccountId) => void; testID: string }) {
  switch (state.kind) {
    case "ready":
      return null;
    case "needs-own-consent":
      return (
        <GateCard icon={Mic} title="Before your first voice note" testID={testID}>
          <T variant="body" tone="secondary">
            {`Everyone in this circle hears every voice note. Notes are kept for ${retentionDays} days and then deleted, and you can delete your own at any time. Only audio: no photos or video.`}
          </T>
          {state.thenGuardian ? <T variant="caption">Because you're under 18, a parent or guardian in this circle will also need to say yes.</T> : null}
        </GateCard>
      );
    case "needs-guardian":
      return (
        <GateCard icon={ShieldCheck} title="Who should we ask?" tone="reward" testID={testID}>
          <T variant="body" tone="secondary">
            Before you send voice notes, a parent or guardian in this circle says yes from their own phone.
          </T>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {state.candidates.map((m: CircleMember) => (
              <GuardianChoice key={m.profile.id} member={m} selected={picked === m.profile.id} onPress={() => onPick(m.profile.id)} testID={`${testID}-pick-${m.profile.id}`} />
            ))}
          </View>
          <T variant="caption">Only the grown-ups in your circle are listed. You can still listen to every note while you wait.</T>
        </GateCard>
      );
    case "guardian-pending":
      return (
        <GateCard icon={Clock} title={`Waiting for ${state.guardian?.displayName ?? "your guardian"}`} tone="reward" testID={testID}>
          <T variant="body" tone="secondary">
            {`We've asked ${state.guardian?.displayName ?? "them"} to say yes to your voice notes. They'll see it next time they open this circle. You can still listen to every note.`}
          </T>
        </GateCard>
      );
    case "no-guardian-here":
      return (
        <GateCard icon={HeartHandshake} title="Ask a parent to join first" tone="reward" testID={testID}>
          <T variant="body" tone="secondary">
            A parent or guardian needs to be in this circle to say yes to your voice notes. Share the circle's invite code with them.
          </T>
        </GateCard>
      );
    case "muted":
      return (
        <GateCard icon={Clock} title="Voice notes are paused for you" testID={testID}>
          <T variant="body" tone="secondary">
            A moderator paused posting on your account for a while. You can see why, and appeal, in Settings › Appeals.
          </T>
        </GateCard>
      );
  }
}

/** One grown-up a teen can ask: their disc, name and how they're related, and a tick once chosen. */
function GuardianChoice({ member, selected, onPress, testID }: { member: CircleMember; selected: boolean; onPress: () => void; testID: string }) {
  const name = member.profile.displayName;
  const relation = member.relation ? RELATION_LABELS[member.relation] : member.role === "keeper" ? "Keeps the circle" : "Family";
  return (
    <Press
      testID={testID}
      onPress={onPress}
      pressScale={0.98}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Ask ${name}, ${relation}`}
      style={[styles.choice, selected ? styles.choiceOn : null]}
    >
      <Avatar id={member.profile.id} name={name} size={40} />
      <View style={styles.flex}>
        <T variant="body" strong tone="primary" numberOfLines={1}>
          {name}
        </T>
        <T variant="caption" numberOfLines={1}>
          {member.role === "keeper" && member.relation ? `${relation} · keeps the circle` : relation}
        </T>
      </View>
      <View style={[styles.radio, selected ? styles.radioOn : null]}>{selected ? <Check size={size.iconSm - 4} color={colors.onInk} strokeWidth={3} /> : null}</View>
    </Press>
  );
}

function GateCard({ icon: Icon, title, tone = "accent", children, testID }: { icon: IconComponent; title: string; tone?: "accent" | "reward"; children?: React.ReactNode; testID: string }) {
  return (
    <Card variant="flat" testID={testID}>
      <View style={styles.gateHead}>
        <View style={[styles.gateIcon, tone === "reward" ? styles.reward : styles.accent]}>
          <Icon size={size.icon} color={tone === "reward" ? colors.rewardText : colors.accent} strokeWidth={2} />
        </View>
        <T variant="title" style={styles.flex}>
          {title}
        </T>
      </View>
      <View style={styles.gateBody}>{children}</View>
    </Card>
  );
}

/** The adult's side of guardian consent, in the circle. */
export function ConsentRequestCard({ teen, onYes, onNo, busy, testID }: { teen: PublicProfile; onYes: () => void; onNo: () => void; busy: boolean; testID: string }) {
  return (
    <Card variant="flat" testID={testID}>
      <View style={styles.gateHead}>
        <View style={[styles.gateIcon, styles.reward]}>
          <ShieldCheck size={size.icon} color={colors.rewardText} strokeWidth={2} />
        </View>
        <T variant="title" style={styles.flex}>
          {`${teen.displayName} asked you to say yes`}
        </T>
      </View>
      <View style={styles.gateBody}>
        <T variant="body" tone="secondary">
          {`${teen.displayName} is under 18. Saying yes means you are their parent or guardian, and you're happy for them to send voice notes to this circle. Everyone in the circle hears every note. You can take it back at any time.`}
        </T>
        <View style={styles.actions}>
          <Button label="Say yes" onPress={onYes} loading={busy} testID={`${testID}-yes`} size="md" />
          <Button label="Not now" variant="ghost" onPress={onNo} disabled={busy} testID={`${testID}-no`} size="md" />
        </View>
      </View>
    </Card>
  );
}

export interface SendNoteSheetProps {
  visible: boolean;
  circleName: string;
  /** Answering a prompt: who it's mainly for to begin with, and their name for the subtitle. */
  replyTo?: { id: AccountId; name: string } | null;
  durationMs: number;
  /** A teen can read captions in this circle: the strict filter applies. */
  strict: boolean;
  people: { id: AccountId; name: string }[];
  busy: boolean;
  onListen: () => void;
  onSend: (input: { caption: string; to: AccountId | null }) => void;
  onDiscard: () => void;
  testID: string;
}

export function SendNoteSheet({ visible, circleName, replyTo, durationMs, strict, people, busy, onListen, onSend, onDiscard, testID }: SendNoteSheetProps) {
  const [caption, setCaption] = useState("");
  const [to, setTo] = useState<AccountId | null>(replyTo?.id ?? null);
  const feedback = useMemo(() => chatFeedback(caption, CAPTION_MAX, strict), [caption, strict]);
  const error = feedback.ok ? undefined : feedback.message;
  const hint = feedback.ok ? (feedback.hint ?? "Optional. Everyone in the circle sees it.") : undefined;
  return (
    <Sheet
      visible={visible}
      onClose={onDiscard}
      dismissible={!busy}
      testID={testID}
      title={`Send to ${circleName}`}
      subtitle={
        replyTo
          ? `Your answer to ${replyTo.name} is ${formatDuration(durationMs)} long. Everyone in the circle will hear it.`
          : `Your note is ${formatDuration(durationMs)} long. Everyone in the circle will hear it.`
      }
      scroll
      footer={
        <>
          <Button label="Send voice note" onPress={() => onSend({ caption: caption.trim(), to })} disabled={!!error} loading={busy} testID={`${testID}-send`} block />
          <Button label="Discard" variant="ghost" onPress={onDiscard} disabled={busy} testID={`${testID}-discard`} block />
        </>
      }
    >
      <View style={styles.sendBody}>
        <Button label="Listen back" icon={Play} variant="secondary" size="md" onPress={onListen} testID={`${testID}-listen`} />
        <TextField label="A caption (in English or Igbo)" value={caption} onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX + 20))} error={error} hint={hint} testID={`${testID}-caption`} />
        <View style={styles.toWrap}>
          <T variant="caption" strong tone="secondary">
            Mainly for
          </T>
          <View style={styles.chips}>
            <Chip label="Everyone" selected={to === null} onPress={() => setTo(null)} testID={`${testID}-to-all`} />
            {people.map((p) => (
              <Chip key={p.id} label={p.name} selected={to === p.id} onPress={() => setTo(p.id)} testID={`${testID}-to-${p.id}`} />
            ))}
          </View>
          <T variant="caption">The whole circle still hears it. This just marks who it's for.</T>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gateHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  gateIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  accent: { backgroundColor: colors.accent12 },
  reward: { backgroundColor: colors.reward12 },
  gateBody: { gap: space.sm, marginTop: space.md },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  choices: { gap: space.xs },
  choice: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 64, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface },
  choiceOn: { borderColor: colors.ink, borderWidth: 1.5, backgroundColor: colors.ink06 },
  radio: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink24, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  actions: { flexDirection: "row", gap: space.xs, marginTop: space.xs },
  sendBody: { gap: space.lg },
  toWrap: { gap: space.sm },
});
