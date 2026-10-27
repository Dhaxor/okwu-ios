// Delete account (App Store Guideline 5.1.1(v)): in the app, complete, and
// honest about what happens. The server deletes the account and its voice
// notes and revokes the Apple sign-in; then this phone forgets everything
// too and Okwu starts fresh. If the server can't be reached, nothing is
// deleted and the screen says so: we never pretend.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Info, Trash } from "@/components/glyphs/icons";
import { Button, Card, Screen, ScreenHeader, Section, T, useConfirm, useToast } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { blockNamesStore, cancelReminders, offerStore, usePlay, usePlus, useProfile, useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

const GONE: readonly string[] = [
  "Your account, your name and your friend code",
  "Your voice notes, from every Family Circle",
  "Your place in circles, friends, your cohort and your club",
  "Your progress, garden, settings and reminders on this phone",
  "The link to your Apple ID (we ask Apple to forget Okwu)",
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const back = useBack("/settings");
  const toast = useToast();
  const confirm = useConfirm();
  const social = useSocial();
  const plus = usePlus();
  const play = usePlay();
  const { reset } = useProfile();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    const ok = await confirm({
      title: "Delete your account?",
      message: "This can't be undone. Everything listed is deleted now, on our server and on this phone.",
      confirmLabel: "Delete everything",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const r = await social.deleteAccount();
    if (!r.ok) {
      setBusy(false);
      return toast.show(r.message ?? "Nothing was deleted. Please try again.", { tone: "warning", duration: 5000 });
    }
    await cancelReminders();
    await play.resetAll();
    await Promise.all([offerStore.clear(), blockNamesStore.clear()]);
    toast.show("Your account is deleted. Thank you for learning with Okwu.", { tone: "success", duration: 4000 });
    // The profile reset closes every screen behind onboarding; then start again from its first screen.
    await reset();
    setTimeout(() => router.replace("/onboarding"), 50);
  };

  return (
    <Screen testID="delete" footer={<Button label="Delete my account" variant="danger" onPress={() => void remove()} loading={busy} testID="delete-confirm" block />}>
      <ScreenHeader eyebrow="Account" title="Delete your account" subtitle="If you'd rather take a break, you can just stop. Nothing is lost while you're away." onBack={back} testID="delete-header" />
      <Section title="What's deleted" testID="delete-gone">
        <Card variant="flat" padding="md">
          {GONE.map((g) => (
            <View key={g} style={styles.item}>
              <Trash size={size.iconSm} color={colors.danger} strokeWidth={2} />
              <T variant="body" tone="secondary" style={styles.flex}>
                {g}
              </T>
            </View>
          ))}
        </Card>
      </Section>
      <Section title="Good to know" testID="delete-kept">
        <Card variant="sunk" padding="md">
          <View style={styles.item}>
            <Info size={size.iconSm} color={colors.ink80} strokeWidth={2} />
            <T variant="body" tone="secondary" style={styles.flex}>
              {plus.isPlus
                ? "Okwu Plus belongs to your Apple Account. Deleting Okwu doesn't cancel a subscription: cancel it in Settings › Apple Account › Subscriptions."
                : "If you ever buy Okwu Plus, it belongs to your Apple Account, not to Okwu."}
            </T>
          </View>
          <View style={styles.item}>
            <Info size={size.iconSm} color={colors.ink80} strokeWidth={2} />
            <T variant="body" tone="secondary" style={styles.flex}>
              Reports other people made keep only an anonymous reference, as safety law requires.
            </T>
          </View>
        </Card>
      </Section>
      <T variant="caption">{`Questions? Write to ${social.config.contact}.`}</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingVertical: space.xs },
  flex: { flex: 1 },
});
