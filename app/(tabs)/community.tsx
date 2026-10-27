// Community: learning with family and friends, safely. Everything is gated
// by useSocial().can(feature), which is the tier table in lib/social/rules
// AND the actively accepted terms (Apple 1.2); the server enforces the same.
//   - Family Circle (invite only) with relatives' voice notes and prompts
//   - friends by a code shared out of band, with friend streaks
//   - the cohort's weekly co-op quest with preset reactions
//   - open clubs with filtered chat: adults (18+) only
// There is no people search and no direct messages. Report, block and mute
// are on every surface where one person sees what another made.
import React, { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AgeGate, CircleCard, ClubCard, CohortSection, DevPanel, PersonRow, StateCard, TermsGate, useCommunity, useSafetySheet } from "@/components/feature/community";
import { HeartHandshake, Lock, Share2, ShieldCheck, Sprout, UserPlus, Users } from "@/components/glyphs/icons";
import { Button, Card, Chip, Row, Screen, ScreenHeader, Section, T, useToast } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { errorMessage } from "@/lib/social";
import { spacedCode, useAgeTier, useProfile, useSocial } from "@/lib/state";

export default function CommunityScreen() {
  const router = useRouter();
  const toast = useToast();
  const social = useSocial();
  const { update } = useProfile();
  const tier = useAgeTier();
  const teen = tier !== "adult";
  const data = useCommunity();
  const safety = useSafetySheet();
  const [agree, setAgree] = useState(false);
  const me = social.account?.id ?? null;
  const circle = data.circles?.[0] ?? null;

  const header = <ScreenHeader title="Learn together" subtitle="Practise privately first, then with family, then with others." testID="community-header" />;

  // ---- gates ----------------------------------------------------------------
  if (social.gate === "too-young") {
    return (
      <Screen testID="community" tabbed>
        {header}
        <StateCard kind="locked" title="Community isn't available" body="Okwu's community features are for people 13 and over." testID="community-too-young" />
      </Screen>
    );
  }
  if (social.gate === "no-age") {
    return (
      <Screen testID="community" tabbed>
        {header}
        <AgeGate onChoose={(ageBand) => update({ ageBand })} testID="community-age" />
      </Screen>
    );
  }
  if (social.gate === "needs-terms") {
    return (
      <Screen
        testID="community"
        tabbed
        footer={
          <Button
            label="Agree and continue"
            onPress={() => {
              social.acceptTerms();
              toast.show("Thank you. Your community is opening.", { tone: "success" });
            }}
            disabled={!agree}
            testID="community-terms-accept"
            block
          />
        }
      >
        {header}
        <TermsGate teen={teen} agree={agree} onAgree={setAgree} testID="community-terms" />
      </Screen>
    );
  }

  // ---- open, but no account yet --------------------------------------------
  if (!social.hasCreds) {
    const down = social.status === "offline" || social.status === "error";
    return (
      <Screen testID="community" tabbed>
        {header}
        {down ? (
          <StateCard
            kind={social.status === "offline" ? "offline" : "error"}
            title={social.status === "offline" ? "You're offline" : "Community didn't open"}
            body={social.status === "offline" ? "Family Circle, friends and your cohort need a connection. Your lessons keep working." : (social.lastError ?? "Something went wrong on our side.")}
            action={{ label: "Try again", onPress: () => void social.ensureAccount(), testID: "community-retry" }}
            testID="community-down"
          />
        ) : (
          <StateCard title="Setting up your community" body="This takes a moment. No email or password needed." icon={Users} testID="community-setting-up" />
        )}
        <DevPanel testID="community-dev" />
      </Screen>
    );
  }

  // ---- open ------------------------------------------------------------------
  const notes = circle ? (data.notes[circle.id] ?? []) : [];
  const forMe = notes.filter((n) => n.to === me).length;
  const latest = notes[0];
  const latestLine = latest ? `${latest.from === me ? "You" : (latest.author?.displayName ?? "Someone")}: ${latest.caption ?? "a voice note"}` : null;
  const friends = data.friends;
  const footer = social.can("family-circle") ? (
    circle ? (
      <Button label="Open your Family Circle" icon={HeartHandshake} onPress={() => router.push({ pathname: "/community/circle/[id]", params: { id: circle.id } })} testID="community-open-circle" block />
    ) : (
      <Button label="Start your Family Circle" icon={HeartHandshake} onPress={() => router.push({ pathname: "/community/circle/new", params: { mode: "create" } })} testID="community-start-circle" block />
    )
  ) : undefined;

  const shareCode = async () => {
    if (!friends) return;
    try {
      await Share.share({ message: `Learn Igbo with me on Okwu. My friend code is ${friends.code}.` });
    } catch {
      toast.show(`Your code is ${spacedCode(friends.code)}. Share it with people you know.`);
    }
  };

  return (
    <Screen testID="community" tabbed footer={footer}>
      {header}

      {data.error ? (
        <StateCard
          kind={data.error.kind === "api" ? "error" : "offline"}
          title={data.error.kind === "api" ? "Some of this didn't load" : "You're offline"}
          body={data.error.kind === "api" ? errorMessage(data.error) : "Showing what we saw last. Your lessons keep working."}
          action={{ label: "Try again", onPress: data.reload, testID: "community-reload" }}
          testID="community-offline"
        />
      ) : null}

      {social.can("family-circle") ? (
        <Section
          title="Family Circle"
          testID="community-family"
          action={circle ? <Button label="Join or start another" variant="ghost" size="sm" onPress={() => router.push("/community/circle/new")} testID="community-circle-more" /> : undefined}
        >
          {data.loading && !data.circles ? (
            <Card variant="sunk" testID="community-family-loading">
              <T variant="body" tone="muted">
                Opening your circle…
              </T>
            </Card>
          ) : data.circles && data.circles.length ? (
            data.circles.map((c) => (
              <CircleCard
                key={c.id}
                circle={c}
                me={me}
                forMe={(data.notes[c.id] ?? []).filter((n) => n.to === me).length}
                latest={c.id === circle?.id ? latestLine : null}
                onPress={() => router.push({ pathname: "/community/circle/[id]", params: { id: c.id } })}
                testID={`community-circle-${c.id}`}
              />
            ))
          ) : (
            <StateCard
              icon={HeartHandshake}
              title="Start your Family Circle"
              body="Invite parents, grandparents, aunties and cousins. They record words and greetings for you. Only people you invite can join."
              action={{ label: "Start a circle", onPress: () => router.push({ pathname: "/community/circle/new", params: { mode: "create" } }), testID: "community-circle-create" }}
              secondary={{ label: "I have an invite code", onPress: () => router.push({ pathname: "/community/circle/new", params: { mode: "join" } }), testID: "community-circle-join" }}
              testID="community-circle-empty"
            />
          )}
          {forMe === 0 && circle && notes.length === 0 ? <T variant="caption">No voice notes yet. Ask someone to record a greeting for you.</T> : null}
        </Section>
      ) : null}

      {social.can("cohorts") ? (
        <Section title="Your cohort" testID="community-cohort">
          {data.cohort ? (
            <CohortSection cohort={data.cohort} onSafety={safety.open} testID="community-cohort-card" />
          ) : (
            <StateCard icon={Sprout} title="Your cohort is forming" body="You'll join learners who started the same week as you." testID="community-cohort-empty" />
          )}
        </Section>
      ) : null}

      {social.can("friends-by-code") ? (
        <Section
          title="Friends"
          testID="community-friends"
          action={<Button label="See all" variant="ghost" size="sm" onPress={() => router.push("/community/friends")} testID="community-friends-all" />}
        >
          <Card variant="flat" padding="md" testID="community-friends-card">
            {friends ? (
              <>
                <View style={styles.codeRow}>
                  <View style={styles.flex}>
                    <T variant="caption">Your friend code</T>
                    <T variant="title" numeric testID="community-friend-code">
                      {spacedCode(friends.code)}
                    </T>
                  </View>
                  <Button label="Share" icon={Share2} variant="secondary" size="sm" onPress={() => void shareCode()} testID="community-share-code" />
                </View>
                {friends.incoming.length ? (
                  <Row
                    title={friends.incoming.length === 1 ? `${friends.incoming[0]!.from.displayName} wants to be friends` : `${friends.incoming.length} friend requests`}
                    detail={friends.incoming[0]!.via === "circle" ? "From your Family Circle" : "They used your code"}
                    icon={UserPlus}
                    onPress={() => router.push("/community/friends")}
                    testID="community-friend-requests"
                  />
                ) : null}
                {friends.friends.length ? (
                  friends.friends.slice(0, 3).map((f, i, all) => (
                    <PersonRow
                      key={f.profile.id}
                      id={f.profile.id}
                      name={f.profile.displayName}
                      online={f.online}
                      detail={f.streak ? "Days in a row, together" : "No shared streak yet"}
                      trailing={f.streak ? <Chip label={`${f.streak.days}`} tone="reward" icon={Sprout} testID={`community-friend-${i}-streak`} /> : undefined}
                      onMore={() => safety.open({ title: f.profile.displayName, what: `${f.profile.displayName}'s name`, target: { kind: "account", id: f.profile.id }, person: { id: f.profile.id, name: f.profile.displayName } })}
                      divider={i < all.length - 1}
                      testID={`community-friend-${i}`}
                    />
                  ))
                ) : (
                  <T variant="caption" style={styles.top}>
                    {teen ? "Share your code with friends your age, or with family in your circle. Nobody can find you by searching." : "Share your code with people you know. Nobody can find you by searching."}
                  </T>
                )}
              </>
            ) : (
              <T variant="body" tone="muted">
                Loading your friends…
              </T>
            )}
          </Card>
        </Section>
      ) : null}

      <Section title="Clubs" testID="community-clubs">
        {social.can("clubs") ? (
          data.club ? (
            <ClubCard
              club={data.club.club}
              mine
              onOpen={() => router.push("/community/club")}
              onMore={() => safety.open({ title: data.club!.club.name, what: "this club", target: { kind: "club", id: data.club!.club.id }, excerpt: data.club!.club.description })}
              testID="community-my-club"
            />
          ) : (
            <StateCard
              icon={Users}
              title="Find a club"
              body="Small clubs of adult learners, up to 30 people, with a filtered chat. Join one at a time."
              action={{ label: "Browse clubs", onPress: () => router.push("/community/clubs"), testID: "community-browse-clubs" }}
              testID="community-clubs-empty"
            />
          )
        ) : (
          <StateCard
            kind="locked"
            icon={Lock}
            title={tier === "adult" ? "Clubs are resting" : "Open clubs are for members 18 and over"}
            body={tier === "adult" ? "Clubs are paused for a while. Your circle, friends and cohort work as usual." : "You have your Family Circle, friends and your cohort. Clubs open when you're 18."}
            testID="community-clubs-locked"
          />
        )}
      </Section>

      <Card variant="flat" padding="md" testID="community-safety">
        <Row title="How we keep Okwu safe" detail="Report, block and mute everywhere. No search, no private messages." icon={ShieldCheck} onPress={() => router.push("/settings/safety")} testID="community-safety-row" />
      </Card>

      <DevPanel testID="community-dev" />
      {safety.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingBottom: space.sm, marginBottom: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  top: { marginTop: space.sm },
});
