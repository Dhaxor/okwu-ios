// Settings: learning (track, home dialect, tone marks, audio speed, daily
// goal), the daily reminder (at most one kind note a day), Okwu Plus,
// the account (Sign in with Apple, sign out, delete), safety and help, and
// the documents. Permission for reminders is asked when they're turned on,
// never before.
import React from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { Bell, FileText, Info, Languages, LogOut, Mail, RotateCcw, Scale, ShieldCheck, Sparkles, Star, Trash } from "@/components/glyphs/icons";
import { Card, Chip, Row, Screen, ScreenHeader, Section, Segmented, Switch, T, useConfirm, useToast } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { REQUIRED_CONSENTS } from "@/lib/social";
import {
  CONSENT_TITLES,
  LEGAL_URLS,
  formatTime,
  purchaseMessage,
  reminderStatusCopy,
  resolveTrack,
  useContent,
  useDialectLabels,
  usePlus,
  useProfile,
  useReminderPermission,
  useSocial,
  type AudioSpeed,
  type ToneMarks,
} from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

const TONES = [
  { value: "shown", label: "Shown" },
  { value: "reveal", label: "Tap to see" },
  { value: "hidden", label: "Hidden" },
] as const;
const SPEEDS = [
  { value: "natural", label: "Natural" },
  { value: "slow", label: "Slower" },
] as const;
const GOALS = [
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
] as const;
const TRACKS = [
  { value: "new-learner", label: "New to Igbo" },
  { value: "heritage", label: "Heritage" },
] as const;
const TIMES = [
  { hour: 7, minute: 0 },
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 21, minute: 0 },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const back = useBack("/me");
  const toast = useToast();
  const confirm = useConfirm();
  const { profile, update } = useProfile();
  const { bundle } = useContent();
  const social = useSocial();
  const plus = usePlus();
  const permission = useReminderPermission();
  const dialects = useDialectLabels();
  const r = profile.reminder;
  const trackKind = (profile.track && bundle?.tracks[profile.track]?.kind) || (profile.heritage ? "heritage" : "new-learner");

  const setTrack = (kind: "new-learner" | "heritage") => {
    const id = bundle ? resolveTrack(bundle, kind) : null;
    update({ track: id ?? "", heritage: kind === "heritage" });
    toast.show(kind === "heritage" ? "Heritage track: more speaking, dots, tones and talking with elders." : "New-learner track: from the sounds up.");
  };

  const setReminder = async (enabled: boolean) => {
    if (enabled) {
      // The contextual moment: the learner just asked for reminders.
      const s = await permission.request();
      if (s === "denied") toast.show("Notifications are off for Okwu. You can turn them on in your phone's Settings.", { tone: "warning" });
    }
    update({ reminder: { ...r, enabled } });
  };

  const signOut = async () => {
    const ok = await confirm({
      title: "Sign out on this phone?",
      message: "Your lessons and progress stay on this phone. Your Family Circle, friends and cohort stay with your Apple account: sign in again any time to get them back.",
      confirmLabel: "Sign out",
    });
    if (!ok) return;
    await social.signOut();
    toast.show("Signed out. You're learning anonymously on this phone.");
  };

  const apple = async () => {
    const res = await social.signInWithApple(profile.ageBand);
    if (res.ok) toast.show("Signed in with Apple. Your account is saved.", { tone: "success" });
    else if (!res.cancelled && res.message) toast.show(res.message, { tone: "warning" });
  };

  const restore = async () => {
    const res = await plus.restore();
    const m = purchaseMessage("restore", res);
    if (m) toast.show(m.message, { tone: m.tone });
  };

  const open = (url: string) => void Linking.openURL(url).catch(() => toast.show("That page couldn't open. Please try again later."));
  const homeDialects = profile.dialects.length ? profile.dialects.map((d) => dialects[d] ?? d).join(", ") : "Standard Igbo only";

  return (
    <Screen testID="settings">
      <ScreenHeader title="Settings" onBack={back} testID="settings-header" />

      <Section title="Learning" testID="settings-learning">
        <Card variant="flat" padding="md">
          <Labeled label="Track" detail="Heritage adds dots, tones and how to speak with elders.">
            <Segmented<"new-learner" | "heritage"> options={TRACKS} value={trackKind} onChange={setTrack} testID="settings-track" accessibilityLabel="Track" />
          </Labeled>
          <Row title="Home dialect" detail={homeDialects} icon={Languages} onPress={() => router.push("/settings/dialect")} testID="settings-dialect" divider />
          <Labeled label="Tone marks" detail="Shown while you learn the sounds. Written Igbo usually leaves them out.">
            <Segmented<ToneMarks> options={TONES} value={profile.toneMarks} onChange={(v) => update({ toneMarks: v })} testID="settings-tones" accessibilityLabel="Tone marks" />
          </Labeled>
          <Labeled label="Audio speed" detail="Slower uses a slow recording when there is one.">
            <Segmented<AudioSpeed> options={SPEEDS} value={profile.audioSpeed} onChange={(v) => update({ audioSpeed: v })} testID="settings-speed" accessibilityLabel="Audio speed" />
          </Labeled>
          <Labeled label="Daily goal" last>
            <Segmented<"5" | "10" | "15"> options={GOALS} value={String(profile.dailyGoalMinutes) as "5" | "10" | "15"} onChange={(v) => update({ dailyGoalMinutes: Number(v) as 5 | 10 | 15 })} testID="settings-goal" accessibilityLabel="Daily goal" />
          </Labeled>
        </Card>
      </Section>

      <Section title="Reminder" testID="settings-reminder">
        <Card variant="flat" padding="md">
          <Row
            title="Daily reminder"
            detail={reminderStatusCopy(r.enabled, permission.status ?? "undetermined", r)}
            icon={Bell}
            testID="settings-reminder-row"
            trailing={<Switch value={r.enabled} onValueChange={(v) => void setReminder(v)} accessibilityLabel="Daily reminder" testID="settings-reminder-switch" />}
          />
          {r.enabled ? (
            <View style={styles.times}>
              {TIMES.map((t) => {
                const on = t.hour === r.hour && t.minute === r.minute;
                return <Chip key={`${t.hour}:${t.minute}`} label={formatTime(t)} selected={on} onPress={() => update({ reminder: { ...r, hour: t.hour, minute: t.minute } })} testID={`settings-time-${t.hour}-${t.minute}`} />;
              })}
            </View>
          ) : null}
          {r.enabled && permission.status === "denied" && Platform.OS !== "web" ? <Row title="Open phone Settings" detail="Allow notifications for Okwu" icon={Bell} onPress={() => void Linking.openSettings()} testID="settings-open-os" /> : null}
          <T variant="caption" style={styles.note}>
            Never more than one a day, and never on a day you've already practised. Under 18s get no streak nudges.
          </T>
        </Card>
      </Section>

      <Section title="Okwu Plus" testID="settings-plus">
        <Card variant="flat" padding="md">
          {plus.isPlus ? (
            <Row title="You have Okwu Plus" detail={plus.plan === "lifetime" ? "Lifetime. Thank you." : "Thank you for supporting Okwu."} icon={Star} testID="settings-plus-on" divider />
          ) : (
            <Row title="See Okwu Plus" detail="The whole path, every story, unlimited trainers" icon={Sparkles} onPress={() => router.push({ pathname: "/paywall", params: { from: "settings" } })} testID="settings-plus-see" divider />
          )}
          {plus.isPlus && plus.plan === "subscription" && Platform.OS === "ios" ? <Row title="Manage subscription" icon={Star} onPress={() => void plus.manageSubscriptions()} testID="settings-plus-manage" divider /> : null}
          <Row title="Restore purchases" detail="Bought Plus on another device? Bring it back here." icon={RotateCcw} onPress={() => void restore()} testID="settings-restore" />
        </Card>
      </Section>

      <Section title="Account" testID="settings-account">
        <Card variant="flat" padding="md">
          <T variant="body" tone="secondary" style={styles.accountLine} testID="settings-account-status">
            {profile.account === "apple" ? "Signed in with Apple. Your account comes with you to a new phone." : "Your progress is saved on this phone. Sign in with Apple to keep your account if you change phones."}
          </T>
          {profile.account !== "apple" ? (
            social.appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={radius.lg}
                style={styles.apple}
                onPress={() => void apple()}
                testID="settings-apple"
              />
            ) : (
              <T variant="caption" testID="settings-apple-web">
                Sign in with Apple works in the iPhone app.
              </T>
            )
          ) : (
            <Row title="Sign out" icon={LogOut} onPress={() => void signOut()} testID="settings-sign-out" divider />
          )}
          <Row title="Delete account" detail="Your account, voice notes and progress" icon={Trash} onPress={() => router.push("/settings/delete")} testID="settings-delete" />
        </Card>
      </Section>

      <Section title="Safety and help" testID="settings-safety">
        <Card variant="flat" padding="md">
          <Row title="How we keep Okwu safe" detail="Reports, blocking, and the people you blocked" icon={ShieldCheck} onPress={() => router.push("/settings/safety")} testID="settings-safety-row" divider />
          <Row title="Appeals" detail="If a moderator paused your account" icon={Scale} onPress={() => router.push("/settings/appeals")} testID="settings-appeals" divider />
          <Row title="Contact our safety team" detail={social.config.contact} icon={Mail} onPress={() => open(`mailto:${social.config.contact}`)} testID="settings-contact" />
        </Card>
      </Section>

      <Section title="About" testID="settings-about">
        <Card variant="flat" padding="md">
          {REQUIRED_CONSENTS.map((k) => (
            <Row key={k} title={CONSENT_TITLES[k]} icon={k === "community-rules" ? ShieldCheck : FileText} onPress={() => open(LEGAL_URLS[k])} testID={`settings-doc-${k}`} divider />
          ))}
          <Row title="Credits" detail="Dictionary data and recordings, fonts and more" icon={Info} onPress={() => router.push("/settings/credits")} testID="settings-credits" />
        </Card>
      </Section>
    </Screen>
  );
}

function Labeled({ label, detail, children, last = false }: { label: string; detail?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.labeled, !last && styles.divider]}>
      <T variant="body" tone="primary">
        {label}
      </T>
      {detail ? <T variant="caption">{detail}</T> : null}
      <View style={styles.control}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  labeled: { paddingVertical: space.sm, gap: space.xxs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  control: { marginTop: space.xs },
  times: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, paddingVertical: space.xs },
  note: { marginTop: space.xs },
  accountLine: { marginBottom: space.sm },
  apple: { height: 52, width: "100%", marginBottom: space.xs },
});
