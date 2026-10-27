// Appeals: if a moderator muted or paused this account, it says why and
// until when, and the person can appeal once. A person reviews every appeal,
// usually within 7 days (docs/MODERATION.md §6).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StateCard } from "@/components/feature/community";
import { Scale, ShieldCheck } from "@/components/glyphs/icons";
import { Button, Card, Chip, Screen, ScreenHeader, Section, Sheet, T, TextField, useToast } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { attempt, errorMessage, FILTER_MESSAGES, type AppealView, type Sanction } from "@/lib/social";
import { timeAgoInline, untilCopy, useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

const APPEAL_MAX = 500;

export default function AppealsScreen() {
  const back = useBack("/settings/safety");
  const toast = useToast();
  const social = useSocial();
  const [appeals, setAppeals] = useState<AppealView[] | null>(null);
  const [writing, setWriting] = useState<Sanction | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const standing = social.account?.standing ?? null;
  const active = useMemo(() => (standing?.sanctions ?? []).filter((s) => Date.parse(s.until) > Date.now()), [standing]);
  const past = useMemo(() => (standing?.sanctions ?? []).filter((s) => Date.parse(s.until) <= Date.now()), [standing]);

  const load = useCallback(async () => {
    await social.refresh();
    const r = await attempt(social.client.appeals());
    setAppeals(r.ok ? r.value : []);
  }, [social]);

  useEffect(() => {
    void load();
    // Load once on open; refresh() changes `social`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social.rev]);

  const send = async () => {
    if (!writing) return;
    setBusy(true);
    const r = await attempt(social.client.appeal(writing.id, text.trim()));
    setBusy(false);
    if (!r.ok) return toast.show(r.error.code === "filtered" && r.error.reason ? FILTER_MESSAGES[r.error.reason] : errorMessage(r.error), { tone: "warning" });
    setWriting(null);
    setText("");
    toast.show("Appeal sent. A person will review it, usually within 7 days.", { tone: "success" });
    void load();
  };

  return (
    <Screen testID="appeals">
      <ScreenHeader eyebrow="Safety and help" title="Appeals" subtitle="If a moderator muted or paused your account, you'll see why here, and you can ask a person to look again." onBack={back} testID="appeals-header" />

      {!social.hasCreds ? (
        <StateCard icon={ShieldCheck} title="Nothing to appeal" body="You don't have a community account on this phone yet." testID="appeals-none" />
      ) : active.length === 0 ? (
        <StateCard icon={ShieldCheck} title="Your account is in good standing" body="Nothing is paused or muted. Thank you for keeping Okwu kind." testID="appeals-clear" />
      ) : (
        <Section title="Now" testID="appeals-active">
          {active.map((s) => (
            <Card key={s.id} variant="flat" testID={`appeals-sanction-${s.id}`}>
              <View style={styles.head}>
                <T variant="title" style={styles.flex}>
                  {s.kind === "mute" ? "You can't post for now" : "Your account is paused"}
                </T>
                <Chip label={untilCopy(s.until, now)} tone="reward" testID={`appeals-sanction-${s.id}-until`} />
              </View>
              <T variant="body" tone="secondary" style={styles.reason}>{`Why: ${s.reason}`}</T>
              <T variant="caption">{s.kind === "mute" ? "You can still learn, listen to voice notes and read your club. You can't post, send notes or change your name." : "You can still learn. Community is read-only until then."}</T>
              <View style={styles.actions}>
                {s.appeal === null ? (
                  <Button label="Appeal this" icon={Scale} variant="secondary" size="md" onPress={() => setWriting(s)} testID={`appeals-sanction-${s.id}-appeal`} />
                ) : (
                  <Chip label={s.appeal === "open" ? "Appeal sent · waiting for review" : s.appeal === "upheld" ? "Appeal upheld" : "Appeal reviewed: kept"} tone={s.appeal === "upheld" ? "success" : "neutral"} testID={`appeals-sanction-${s.id}-status`} />
                )}
              </View>
            </Card>
          ))}
        </Section>
      )}

      {appeals && appeals.length ? (
        <Section title="Your appeals" testID="appeals-list">
          <Card variant="flat" padding="md">
            {appeals.map((a, i) => (
              <View key={a.id} style={[styles.appeal, i < appeals.length - 1 && styles.divider]}>
                <T variant="body" tone="primary" numberOfLines={3}>{`“${a.text}”`}</T>
                <T variant="caption">{`${a.status === "open" ? "Waiting for review" : a.status === "upheld" ? "Upheld: the restriction was lifted" : "Reviewed: the restriction stays"} · sent ${timeAgoInline(a.createdAt, now)}`}</T>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {past.length ? <T variant="caption">{`${past.length} earlier ${past.length === 1 ? "restriction has" : "restrictions have"} ended.`}</T> : null}

      {social.mock && active.length === 0 ? <Button label="Development: simulate a 24-hour mute" variant="ghost" size="sm" onPress={() => social.mock?.addSanction()} testID="appeals-dev-mute" /> : null}

      <Sheet
        visible={!!writing}
        onClose={() => setWriting(null)}
        testID="appeals-write"
        title="Ask us to look again"
        subtitle="Tell us what happened, in your own words. A person reads every appeal. You can appeal each restriction once."
        footer={
          <>
            <Button label="Send appeal" onPress={() => void send()} disabled={text.trim().length < 10} loading={busy} testID="appeals-write-send" block />
            <Button label="Cancel" variant="ghost" onPress={() => setWriting(null)} testID="appeals-write-cancel" block />
          </>
        }
      >
        <TextField label="Your appeal" value={text} onChangeText={(t) => setText(t.slice(0, APPEAL_MAX))} multiline hint={`${text.length} of ${APPEAL_MAX}`} testID="appeals-write-text" />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  reason: { marginTop: space.sm, marginBottom: space.xs },
  actions: { flexDirection: "row", marginTop: space.md },
  appeal: { paddingVertical: space.sm, gap: space.xxs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
});
