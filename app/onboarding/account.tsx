// Save your progress: after the first lesson, never before. Anonymous by
// default (progress lives on this phone, no email, no password); Sign in
// with Apple is optional. The age question is neutral; under-13s are
// refused kindly. Community features need the terms actively accepted
// (Apple Guideline 1.2): an unticked switch, never a pre-ticked one.
import React, { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { ShieldCheck } from "@/components/glyphs/icons";
import { Button, Card, Row, Screen, ScreenHeader, Section, Segmented, Switch, T, useToast } from "@/components/ui";
import { radius, space } from "@/constants/theme";
import { REQUIRED_CONSENTS } from "@/lib/social";
import { CONSENT_TITLES, EMPTY_PROFILE, LEGAL_URLS, termsAccepted, usePlay, useProfile, useSocial, type AgeBand } from "@/lib/state";

const AGES = [
  { value: "under-13", label: "Under 13" },
  { value: "13-17", label: "13 to 17" },
  { value: "18+", label: "18 or over" },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, update, set } = useProfile();
  const social = useSocial();
  const play = usePlay();
  const already = termsAccepted(profile.consents, social.config);
  const [agree, setAgree] = useState(already);
  const [busy, setBusy] = useState(false);
  // The answer is kept on this screen until Continue: a slip of the finger never locks anyone out.
  const [age, setAge] = useState<AgeBand | null>(profile.ageBand);

  const refuse = async () => {
    // Nothing about an under-13 is kept beyond the answer itself, so the refusal sticks.
    await play.resetAll();
    // The onboarding stack then holds only the refusal screen (app/onboarding/_layout.tsx).
    set(() => ({ ...EMPTY_PROFILE, ageBand: "under-13" }));
  };

  const next = async () => {
    if (!age) return;
    if (age === "under-13") return refuse();
    update({ ageBand: age });
    if (agree && !already) social.acceptTerms();
    router.push("/onboarding/reminder");
  };

  const apple = async () => {
    if (!age) {
      toast.show("Choose your age first.");
      return;
    }
    if (age === "under-13") return refuse();
    update({ ageBand: age });
    setBusy(true);
    const r = await social.signInWithApple(age);
    setBusy(false);
    if (r.ok) {
      toast.show("Signed in with Apple. Your progress is saved.", { tone: "success" });
      if (agree && !already) social.acceptTerms();
      router.push("/onboarding/reminder");
    } else if (!r.cancelled && r.message) toast.show(r.message, { tone: "warning" });
  };

  return (
    <Screen testID="account" footer={<Button label="Continue" onPress={() => void next()} disabled={!age} loading={busy} testID="account-continue" block />}>
      <ScreenHeader eyebrow="Save your progress" title="A few last things" subtitle="Your progress stays on this phone. No email, no password." onBack={() => router.back()} testID="account-header" />

      <Section title="How old are you?" testID="account-age">
        <Segmented<AgeBand> options={AGES} value={age} onChange={setAge} testID="account-age-band" accessibilityLabel="How old are you?" />
        <T variant="caption">This decides which community features you see. We don't ask for your birthday.</T>
      </Section>

      <Section title="Learn with family and friends" testID="account-community">
        <Card variant="flat" padding="md">
          <T variant="body" tone="secondary">
            Family Circle, friends and cohorts need you to agree to our documents first. You can do this later, too.
          </T>
          <View style={styles.docs}>
            {REQUIRED_CONSENTS.map((k, i) => (
              <Row
                key={k}
                title={CONSENT_TITLES[k]}
                icon={ShieldCheck}
                onPress={() => void Linking.openURL(LEGAL_URLS[k]).catch(() => toast.show("That page couldn't open. Please try again later."))}
                divider={i < REQUIRED_CONSENTS.length - 1}
                testID={`account-doc-${k}`}
              />
            ))}
          </View>
          <View style={styles.agree}>
            <T variant="body" tone="primary" style={styles.flex}>
              I have read and agree to the Terms of Use, Privacy Policy and Community Rules
            </T>
            <Switch value={agree} onValueChange={setAgree} disabled={already || age === "under-13"} accessibilityLabel="I agree to the Terms of Use, Privacy Policy and Community Rules" testID="account-agree" />
          </View>
          {age === "13-17" ? (
            <T variant="caption" style={styles.teen}>
              For 13 to 17: friends join only with a code you share, adults only through your Family Circle, and a parent or guardian says yes before you send voice notes.
            </T>
          ) : null}
        </Card>
      </Section>

      {social.appleAvailable ? (
        <Section title="Keep your account if you change phones">
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.lg}
            style={styles.apple}
            onPress={() => void apple()}
            testID="account-apple"
          />
          <T variant="caption">Optional. Okwu asks Apple for no name and no email.</T>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  docs: { marginTop: space.sm },
  agree: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  flex: { flex: 1 },
  teen: { marginTop: space.md },
  apple: { height: 56, width: "100%" },
});
