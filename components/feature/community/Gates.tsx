// What stands before Community opens. Apple Guideline 1.2 asks for terms the
// person actively accepts: the switch starts off and the button waits for
// it. Age decides what opens (teens: Family Circle, friends by code and
// cohorts; 18+: open clubs too), and is asked here only when onboarding
// didn't record it.
import React, { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { FileText, HeartHandshake, ShieldCheck, Sprout, UserPlus } from "@/components/glyphs/icons";
import { Button, Card, Row, Segmented, Switch, T, useToast } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { REQUIRED_CONSENTS } from "@/lib/social";
import { CONSENT_TITLES, LEGAL_URLS, type AgeBand } from "@/lib/state";

/** The screen's footer holds the "Agree and continue" button; it waits for `agree`. */
export function TermsGate({ teen, agree, onAgree, testID }: { teen: boolean; agree: boolean; onAgree: (v: boolean) => void; testID: string }) {
  const toast = useToast();
  const setAgree = onAgree;
  return (
    <View style={styles.gap} testID={testID}>
      <Card variant="ink" testID={`${testID}-intro`}>
        <T variant="label" tone="onInkMuted">
          {teen ? "For 13 and over" : "For 18 and over"}
        </T>
        <T variant="title" tone="onInk" style={styles.introTitle}>
          Practise with the people who matter
        </T>
        <View style={styles.points}>
          <Point icon={HeartHandshake} text="A Family Circle, invite only, where relatives record words for you" />
          <Point icon={UserPlus} text={teen ? "Friends, only with a code you share yourself" : "Friends by a code you share, and friend streaks"} />
          <Point icon={Sprout} text="A cohort of learners who started when you did, with kind preset reactions" />
        </View>
      </Card>

      <Card variant="flat" padding="md" testID={`${testID}-docs`}>
        <T variant="body" strong tone="primary">
          First, our community documents
        </T>
        <T variant="caption">They explain what we keep, how we keep everyone safe, and what's not allowed. Please read them; it takes a few minutes.</T>
        <View style={styles.docs}>
          {REQUIRED_CONSENTS.map((k, i) => (
            <Row
              key={k}
              title={CONSENT_TITLES[k]}
              icon={k === "community-rules" ? ShieldCheck : FileText}
              onPress={() => void Linking.openURL(LEGAL_URLS[k]).catch(() => toast.show("That page couldn't open. Please try again later."))}
              divider={i < REQUIRED_CONSENTS.length - 1}
              testID={`${testID}-doc-${k}`}
            />
          ))}
        </View>
        <View style={styles.agree}>
          <T variant="body" tone="primary" style={styles.flex}>
            I have read and agree to the Terms of Use, Privacy Policy and Community Rules
          </T>
          <Switch value={agree} onValueChange={setAgree} accessibilityLabel="I agree to the Terms of Use, Privacy Policy and Community Rules" testID={`${testID}-agree`} />
        </View>
        {teen ? (
          <T variant="caption" style={styles.teen}>
            For 13 to 17: friends join only with a code you share, adults only through your Family Circle, and a parent or guardian says yes before you send voice notes.
          </T>
        ) : null}
      </Card>
    </View>
  );
}

function Point({ icon: Icon, text }: { icon: typeof HeartHandshake; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Icon size={size.iconSm} color={colors.onInk} strokeWidth={2} />
      </View>
      <T variant="body" tone="onInkMuted" style={styles.flex}>
        {text}
      </T>
    </View>
  );
}

const AGES = [
  { value: "13-17", label: "13 to 17" },
  { value: "18+", label: "18 or over" },
] as const;

/** Age wasn't recorded in onboarding (an older install): ask once, neutrally. */
export function AgeGate({ onChoose, testID }: { onChoose: (band: AgeBand) => void; testID: string }) {
  const [age, setAge] = useState<"13-17" | "18+" | null>(null);
  return (
    <Card variant="flat" testID={testID}>
      <T variant="title">How old are you?</T>
      <T variant="body" tone="muted" style={styles.ageLead}>
        This decides which community features you see. We don't ask for your birthday, and Okwu is for people 13 and over.
      </T>
      <Segmented<"13-17" | "18+"> options={AGES} value={age} onChange={setAge} testID={`${testID}-band`} accessibilityLabel="How old are you?" />
      <View style={styles.ageAction}>
        <Button label="Continue" onPress={() => age && onChoose(age)} disabled={!age} testID={`${testID}-continue`} size="md" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  introTitle: { marginTop: space.xxs },
  points: { gap: space.sm, marginTop: space.md },
  point: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  pointIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.onInk12, alignItems: "center", justifyContent: "center" },
  docs: { marginTop: space.sm },
  agree: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  flex: { flex: 1 },
  teen: { marginTop: space.md },
  ageLead: { marginTop: space.xs, marginBottom: space.md },
  ageAction: { marginTop: space.md },
});
