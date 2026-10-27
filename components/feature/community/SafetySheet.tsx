// Report, block and mute: on every surface where one person can see what
// another made, names included (Apple Guideline 1.2). One sheet that moves
// between steps (iOS shows one root sheet at a time):
//   menu     Report this, Report <name>, Mute, Block, and any extras (delete, remove)
//   report   the fixed reasons (lib/social REPORT_REASONS), an optional note, "also block"
//   block    a confirm that says exactly what blocking does
//   confirm  a confirm for a destructive extra (remove from circle, delete)
//   done     thanks, the 24-hour promise, and crisis lines for "someone may be at risk"
//
//   const safety = useSafetySheet();
//   safety.open({ title: "Ifeoma", person: { id, name }, target: { kind: "account", id }, what: "Ifeoma's name" });
//   return <>{…}{safety.sheet}</>;
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ban, Flag, LifeBuoy, VolumeX, type IconComponent } from "@/components/glyphs/icons";
import { Button, Press, Row, Sheet, Switch, T, TextField, useToast } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { REPORT_REASONS, attempt, errorMessage, type AccountId, type ReportReason, type ReportTarget } from "@/lib/social";
import { rememberBlocked, useSocial } from "@/lib/state";

export interface SafetyExtra {
  label: string;
  icon: IconComponent;
  testID: string;
  /** Asks first, in the sheet, when set. */
  confirm?: { title: string; message: string; confirmLabel: string };
  /** Resolve true to close the sheet. */
  run: () => Promise<boolean>;
}

export interface SafetySubject {
  /** The sheet's heading: a name, "This message", "This voice note", "This club". */
  title: string;
  /** What is reported by "Report this …". */
  target: ReportTarget;
  /** "this message", "this voice note", "Ifeoma's name", "this club". */
  what: string;
  /** The person behind it: Block, Mute and "Report <name>" appear when set (and it isn't me). */
  person?: { id: AccountId; name: string } | null;
  /** The words being reported, quoted in the sheet. */
  excerpt?: string;
  extras?: SafetyExtra[];
  /** Open straight on the reasons. */
  startWith?: "report";
}

type Step = { kind: "menu" } | { kind: "report"; target: ReportTarget; what: string } | { kind: "block" } | { kind: "confirm"; extra: SafetyExtra } | { kind: "done"; reason: ReportReason; blocked: boolean };

const NOTE_MAX = 300;

export function useSafetySheet() {
  const [subject, setSubject] = useState<SafetySubject | null>(null);
  const [visible, setVisible] = useState(false);
  const open = useCallback((s: SafetySubject) => {
    setSubject(s);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);
  const sheet = subject ? <SafetySheet subject={subject} visible={visible} onClose={close} /> : null;
  return { open, close, sheet };
}

export function SafetySheet({ subject, visible, onClose }: { subject: SafetySubject; visible: boolean; onClose: () => void }) {
  const social = useSocial();
  const toast = useToast();
  const me = social.account?.id ?? null;
  const person = subject.person && subject.person.id !== me ? subject.person : null;
  const first: Step = subject.startWith === "report" ? { kind: "report", target: subject.target, what: subject.what } : { kind: "menu" };
  const [step, setStep] = useState<Step>(first);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(first);
    setReason(null);
    setNote("");
    setAlsoBlock(false);
    setBusy(false);
    // Reset on each opening only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, subject]);

  const fail = (e: Parameters<typeof errorMessage>[0]) => toast.show(errorMessage(e), { tone: e.kind === "api" ? "error" : "warning" });

  const sendReport = async () => {
    if (step.kind !== "report" || !reason) return;
    setBusy(true);
    const r = await attempt(social.client.report({ target: step.target, reason, ...(note.trim() ? { note: note.trim().slice(0, NOTE_MAX) } : {}) }));
    if (!r.ok) {
      setBusy(false);
      return fail(r.error);
    }
    let blocked = false;
    if (alsoBlock && person) {
      const b = await attempt(social.client.block(person.id));
      blocked = b.ok;
      if (b.ok) void rememberBlocked(person.id, person.name);
    }
    setBusy(false);
    social.bump();
    setStep({ kind: "done", reason, blocked });
  };

  const block = async () => {
    if (!person) return;
    setBusy(true);
    const r = await attempt(social.client.block(person.id));
    setBusy(false);
    if (!r.ok) return fail(r.error);
    void rememberBlocked(person.id, person.name);
    social.bump();
    onClose();
    toast.show(`${person.name} is blocked. You can unblock in Settings › Safety.`, { tone: "success" });
  };

  const mute = async () => {
    if (!person) return;
    setBusy(true);
    const r = await attempt(social.client.mute(person.id));
    setBusy(false);
    if (!r.ok) return fail(r.error);
    social.bump();
    onClose();
    toast.show(`Muted. You won't see ${person.name}'s notes, messages or reactions. They aren't told.`, { tone: "success" });
  };

  const runExtra = async (extra: SafetyExtra) => {
    setBusy(true);
    const done = await extra.run().catch(() => false);
    setBusy(false);
    if (done) onClose();
  };

  // ---- the steps ----
  let title = subject.title;
  let subtitle: string | undefined;
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (step.kind === "menu") {
    subtitle = subject.excerpt ? undefined : "Nobody is told who reported or blocked them.";
    body = (
      <View>
        {subject.excerpt ? <Quote text={subject.excerpt} /> : null}
        <Row title={`Report ${subject.what}`} icon={Flag} onPress={() => setStep({ kind: "report", target: subject.target, what: subject.what })} testID="safety-report" divider />
        {person && subject.target.kind !== "account" ? (
          <Row title={`Report ${person.name}'s name`} icon={Flag} onPress={() => setStep({ kind: "report", target: { kind: "account", id: person.id }, what: `${person.name}'s name` })} testID="safety-report-person" divider />
        ) : null}
        {person ? <Row title={`Mute ${person.name}`} detail="Hide what they post. They aren't told." icon={VolumeX} onPress={() => void mute()} testID="safety-mute" divider /> : null}
        {person ? <Row title={`Block ${person.name}`} detail="They can't reach you anywhere on Okwu." icon={Ban} onPress={() => setStep({ kind: "block" })} testID="safety-block" divider={!!subject.extras?.length} /> : null}
        {(subject.extras ?? []).map((x, i, all) => (
          <Row key={x.testID} title={x.label} icon={x.icon} onPress={() => (x.confirm ? setStep({ kind: "confirm", extra: x }) : void runExtra(x))} testID={x.testID} divider={i < all.length - 1} />
        ))}
      </View>
    );
    footer = <Button label="Cancel" variant="ghost" onPress={onClose} testID="safety-cancel" block />;
  } else if (step.kind === "report") {
    title = `Report ${step.what}`;
    subtitle = "What's wrong? A moderator looks at every report within 24 hours. Nobody is told who reported.";
    body = (
      <View style={styles.reasons}>
        {subject.excerpt && step.target.kind !== "account" ? <Quote text={subject.excerpt} /> : null}
        <View accessibilityRole="radiogroup" accessibilityLabel="Reasons" style={styles.reasonList}>
          {REPORT_REASONS.map((r) => (
            <ReasonOption key={r.id} label={r.label} selected={reason === r.id} onPress={() => setReason(r.id)} testID={`safety-reason-${r.id}`} />
          ))}
        </View>
        <TextField label="Anything else we should know? (optional)" value={note} onChangeText={(t) => setNote(t.slice(0, NOTE_MAX))} multiline testID="safety-note" hint="Only the moderators read this." />
        {person ? (
          <View style={styles.switchRow}>
            <T variant="body" tone="primary" style={styles.flex}>
              {`Also block ${person.name}`}
            </T>
            <Switch value={alsoBlock} onValueChange={setAlsoBlock} accessibilityLabel={`Also block ${person.name}`} testID="safety-also-block" />
          </View>
        ) : null}
      </View>
    );
    footer = (
      <>
        <Button label="Send report" onPress={() => void sendReport()} disabled={!reason} loading={busy} testID="safety-send" block />
        <Button label="Back" variant="ghost" onPress={() => (subject.startWith === "report" ? onClose() : setStep({ kind: "menu" }))} testID="safety-back" block />
      </>
    );
  } else if (step.kind === "block" && person) {
    title = `Block ${person.name}?`;
    subtitle = `${person.name} won't be able to send you friend requests, and you won't see their voice notes, messages or reactions anywhere on Okwu. If you're friends, that ends. They aren't told.`;
    footer = (
      <>
        <Button label={`Block ${person.name}`} variant="danger" onPress={() => void block()} loading={busy} testID="safety-block-confirm" block />
        <Button label="Back" variant="ghost" onPress={() => setStep({ kind: "menu" })} testID="safety-block-back" block />
      </>
    );
  } else if (step.kind === "confirm") {
    const c = step.extra.confirm!;
    title = c.title;
    subtitle = c.message;
    footer = (
      <>
        <Button label={c.confirmLabel} variant="danger" onPress={() => void runExtra(step.extra)} loading={busy} testID={`${step.extra.testID}-confirm`} block />
        <Button label="Back" variant="ghost" onPress={() => setStep({ kind: "menu" })} testID={`${step.extra.testID}-back`} block />
      </>
    );
  } else if (step.kind === "done") {
    title = "Thank you for telling us";
    subtitle = step.blocked && person ? `A moderator will look within 24 hours. ${person.name} is blocked, so you won't see them again.` : "A moderator will look within 24 hours. You can also block or mute them at any time.";
    body = step.reason === "self-harm" ? <CrisisLines /> : null;
    footer = <Button label="Done" onPress={onClose} testID="safety-done" block />;
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="safety" title={title} subtitle={subtitle} footer={footer} scroll={step.kind === "report"}>
      {body}
    </Sheet>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <View style={styles.quote} testID="safety-quote">
      <T variant="body" tone="secondary" numberOfLines={4}>
        {`“${text}”`}
      </T>
    </View>
  );
}

function ReasonOption({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  return (
    <Press testID={testID} onPress={onPress} haptics="select" pressScale={1} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, selected }} style={[styles.reason, selected && styles.reasonOn]}>
      <View style={[styles.ring, selected && styles.ringOn]}>{selected ? <View style={styles.ringDot} /> : null}</View>
      <T variant="body" tone="primary" style={styles.flex}>
        {label}
      </T>
    </Press>
  );
}

/** Shown when someone reports that a person may be at risk (docs/MODERATION.md §5). */
export function CrisisLines() {
  return (
    <View style={styles.crisis} testID="safety-crisis">
      <View style={styles.crisisHead}>
        <LifeBuoy size={size.icon} color={colors.accent} strokeWidth={2} />
        <T variant="body" strong tone="primary">
          If someone is in danger right now
        </T>
      </View>
      <T variant="caption" tone="secondary">
        Call your local emergency number: 999 in the UK, 911 in the US, 112 in Nigeria.
      </T>
      <T variant="caption" tone="secondary">
        To talk to someone: call or text 988 in the US, or call Samaritans on 116 123 in the UK. If you're under 18, tell an adult you trust too.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  reasons: { gap: space.md },
  reasonList: { gap: space.xs },
  reason: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface },
  reasonOn: { borderColor: colors.ink, backgroundColor: colors.accent06 },
  ring: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.hairlineStrong, alignItems: "center", justifyContent: "center" },
  ringOn: { borderColor: colors.ink },
  ringDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.ink },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.hairlineStrong, paddingLeft: space.sm, marginBottom: space.sm },
  crisis: { gap: space.xs, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.accent06, borderWidth: 1, borderColor: colors.accent12 },
  crisisHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
