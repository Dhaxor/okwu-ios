// About my club: what it's for, who is in it (each name with report, block
// and mute; owners and officers can also remove someone), slow mode for the
// owner, the club's code, and leaving. Friend codes are never shown here.
import React, { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PersonRow, StateCard, useSafetySheet } from "@/components/feature/community";
import { Flag, LogOut, Share2, UserX } from "@/components/glyphs/icons";
import { Button, Card, Chip, Row, Screen, ScreenHeader, Section, Segmented, T, useConfirm, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { attempt, errorMessage, type AccountId, type ClubViewExt } from "@/lib/social";
import { useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

const SLOW = [
  { value: "0", label: "Off" },
  { value: "10", label: "10 s" },
  { value: "30", label: "30 s" },
  { value: "60", label: "1 min" },
] as const;
type Slow = (typeof SLOW)[number]["value"];

export default function ClubInfoScreen() {
  const router = useRouter();
  const back = useBack("/community");
  const toast = useToast();
  const confirm = useConfirm();
  const social = useSocial();
  const safety = useSafetySheet();
  const client = social.client;
  const me = social.account?.id ?? null;
  const [club, setClub] = useState<ClubViewExt | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const r = await attempt(client.myClub());
    if (r.ok) setClub(r.value);
    setFailed(!r.ok);
  }, [client]);

  useEffect(() => {
    void load();
  }, [load, social.rev]);

  const officer = club?.role === "owner" || club?.role === "officer";

  const leave = async () => {
    if (!club) return;
    const ok = await confirm({ title: `Leave ${club.club.name}?`, message: club.role === "owner" ? "Another member becomes the owner. You can join another club after." : "You can join again later if there's room.", confirmLabel: "Leave", destructive: true });
    if (!ok) return;
    const r = await attempt(client.leaveClub());
    if (!r.ok) return toast.show(errorMessage(r.error), { tone: "warning" });
    social.bump();
    toast.show("You left the club.");
    router.dismissTo("/community");
  };

  const setSlow = async (v: Slow) => {
    const r = await attempt(client.updateClub({ slowModeSeconds: Number(v) }));
    if (!r.ok) return toast.show(errorMessage(r.error), { tone: "warning" });
    setClub(r.value);
    toast.show(v === "0" ? "Slow mode is off." : "Slow mode is on.", { tone: "success" });
  };

  const memberMenu = (id: AccountId, name: string, role: string) =>
    safety.open({
      title: name,
      what: `${name}'s name`,
      target: { kind: "account", id },
      person: { id, name },
      extras:
        officer && role === "member"
          ? [
              {
                label: `Remove ${name} from the club`,
                icon: UserX,
                testID: "club-info-kick",
                confirm: { title: `Remove ${name}?`, message: "They can't rejoin this club for 7 days. Report them too if they broke the rules.", confirmLabel: "Remove" },
                run: async () => {
                  const r = await attempt(client.kick(id));
                  if (!r.ok) {
                    toast.show(errorMessage(r.error), { tone: "warning" });
                    return false;
                  }
                  social.bump();
                  return true;
                },
              },
            ]
          : [],
    });

  // Same answer as the club and the club list: a teen (or an unknown age) never sees a club's members.
  if (!social.can("club-chat")) {
    return (
      <Screen testID="club-info-screen">
        <ScreenHeader eyebrow="Clubs" title="Club" onBack={back} testID="club-info-header" />
        <StateCard kind="locked" title="Clubs are for members 18 and over" body="You have your Family Circle, friends and your cohort." testID="club-info-locked" />
      </Screen>
    );
  }

  return (
    <Screen testID="club-info-screen" footer={club ? <Button label="Leave this club" icon={LogOut} variant="secondary" onPress={() => void leave()} testID="club-info-leave" block /> : undefined}>
      <ScreenHeader eyebrow="Club · 18+" title={club?.club.name ?? "Your club"} subtitle={club?.club.description || undefined} onBack={back} testID="club-info-header" />
      {!club ? (
        failed ? (
          <StateCard kind="offline" title="This didn't load" action={{ label: "Try again", onPress: () => void load(), testID: "club-info-retry" }} testID="club-info-error" />
        ) : (
          <T variant="body" tone="muted">
            Loading…
          </T>
        )
      ) : (
        <>
          {club.role === "owner" ? (
            <Section title="Slow mode" testID="club-info-slow">
              <Segmented<Slow> options={SLOW} value={(SLOW.find((s) => Number(s.value) === club.slowModeSeconds)?.value ?? "0") as Slow} onChange={(v) => void setSlow(v)} testID="club-info-slow-mode" accessibilityLabel="Slow mode" />
              <T variant="caption">Everyone waits this long between messages. New accounts always wait 30 seconds.</T>
            </Section>
          ) : null}

          <Section title={`Members · ${club.members.length} of ${club.club.maxMembers}`} testID="club-info-members">
            <Card variant="flat" padding="md">
              {club.members.map((m, i) => (
                <PersonRow
                  key={m.profile.id}
                  id={m.profile.id}
                  name={m.profile.displayName}
                  me={m.profile.id === me}
                  trailing={m.role !== "member" ? <Chip label={m.role === "owner" ? "Owner" : "Officer"} testID={`club-info-member-${i}-role`} /> : undefined}
                  onMore={m.profile.id === me ? undefined : () => memberMenu(m.profile.id, m.profile.displayName, m.role)}
                  divider={i < club.members.length - 1}
                  testID={`club-info-member-${i}`}
                />
              ))}
            </Card>
          </Section>

          <Card variant="flat" padding="md" testID="club-info-actions">
            {club.inviteCode ? (
              <Row
                title={`Club code · ${club.inviteCode}`}
                detail="Share it with adults you know who'd like to join."
                icon={Share2}
                onPress={() => void Share.share({ message: `Join my Igbo learning club on Okwu with the code ${club.inviteCode}` }).catch(() => {})}
                testID="club-info-code"
                divider
              />
            ) : null}
            <Row title="Report this club" detail="Its name or description" icon={Flag} onPress={() => safety.open({ title: club.club.name, what: "this club", target: { kind: "club", id: club.club.id }, excerpt: club.club.description, startWith: "report" })} testID="club-info-report" />
          </Card>
          <View style={styles.pad} />
        </>
      )}
      {safety.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { height: space.xs },
});
