// Friends: only by a code shared out of band (a message, in person), or
// through a shared Family Circle. Nobody can search for anyone. A teen and an
// adult can be friends only when they share a Family Circle; a code from an
// adult stranger simply doesn't work, with the same answer as a wrong code.
// Friend streaks count days you both practised.
import React, { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PersonRow, StateCard, useSafetySheet } from "@/components/feature/community";
import { Share2, Sprout, UserPlus, UserX } from "@/components/glyphs/icons";
import { Button, Card, Chip, Screen, ScreenHeader, Section, T, TextField, useToast } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { attempt, errorMessage, type AccountId, type FriendCode, type FriendsView, type SocialError } from "@/lib/social";
import { cleanCode, spacedCode, timeAgo, timeAgoInline, useAgeTier, useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

export default function FriendsScreen() {
  const router = useRouter();
  const back = useBack("/community");
  const toast = useToast();
  const social = useSocial();
  const teen = useAgeTier() !== "adult";
  const safety = useSafetySheet();
  const [view, setView] = useState<FriendsView | null>(null);
  const [error, setError] = useState<SocialError | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const client = social.client;

  const load = useCallback(async () => {
    const r = await attempt(client.friends());
    if (r.ok) {
      setView(r.value);
      setError(null);
    } else setError(r.error);
  }, [client]);

  useEffect(() => {
    void load();
  }, [load, social.rev]);

  const cleaned = cleanCode(code);
  const codeOk = /^[A-Z2-9]{7}$/.test(cleaned);

  const add = async () => {
    setBusy("add");
    const r = await attempt(client.requestFriend(cleaned as FriendCode));
    setBusy(null);
    if (!r.ok) {
      const e = r.error;
      return toast.show(
        e.code === "not-found" ? "That code didn't work. Check it with the person who gave it to you." : e.code === "already" ? "You're already friends." : e.code === "bad-request" ? "That's your own code." : e.code === "blocked" ? "You've blocked this person. Unblock them in Settings › Safety first." : errorMessage(e),
        { tone: "warning" }
      );
    }
    setCode("");
    social.bump();
    toast.show(r.value.status === "friends" ? "You're friends now." : "Request sent. They'll see it next time they open Okwu.", { tone: "success" });
  };

  const respond = async (id: AccountId, accept: boolean) => {
    setBusy(`r-${id}`);
    const r = await attempt(client.respondFriend(id, accept));
    setBusy(null);
    if (!r.ok) return toast.show(errorMessage(r.error), { tone: "warning" });
    social.bump();
  };

  const shareCode = async () => {
    if (!view) return;
    try {
      await Share.share({ message: `Learn Igbo with me on Okwu. My friend code is ${view.code}.` });
    } catch {
      toast.show(`Your code is ${spacedCode(view.code)}.`);
    }
  };

  const personMenu = (id: AccountId, name: string, isFriend: boolean) =>
    safety.open({
      title: name,
      what: `${name}'s name`,
      target: { kind: "account", id },
      person: { id, name },
      extras: isFriend
        ? [
            {
              label: `Remove ${name} as a friend`,
              icon: UserX,
              testID: "friends-remove",
              confirm: { title: `Remove ${name}?`, message: "Your friend streak ends. They aren't told, and they can be added again with a code.", confirmLabel: "Remove" },
              run: async () => {
                const r = await attempt(client.removeFriend(id));
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

  return (
    <Screen testID="friends" keyboard footer={view ? <Button label="Share your code" icon={Share2} onPress={() => void shareCode()} testID="friends-share" block /> : undefined}>
      <ScreenHeader eyebrow="Friends" title="Learn with friends" subtitle={teen ? "Friends your age by code, and family through your circle. Nobody can search for you." : "Only people you share your code with can add you. Nobody can search for you."} onBack={back} testID="friends-header" />

      {error && !view ? (
        <StateCard kind={error.kind === "api" ? "error" : "offline"} title={error.kind === "api" ? "Friends didn't load" : "You're offline"} body={error.kind === "api" ? errorMessage(error) : "Friends need a connection. Your lessons keep working."} action={{ label: "Try again", onPress: () => void load(), testID: "friends-retry" }} testID="friends-error" />
      ) : !view ? (
        <Card variant="sunk" testID="friends-loading">
          <T variant="body" tone="muted">
            Loading your friends…
          </T>
        </Card>
      ) : (
        <>
          <Card variant="ink" testID="friends-code">
            <T variant="label" tone="onInkMuted">
              Your friend code
            </T>
            <T variant="display" tone="onInk" numeric testID="friends-code-value">
              {spacedCode(view.code)}
            </T>
            <T variant="body" tone="onInkMuted">
              Share it yourself with people you know. It's never shown in your cohort or in clubs.
            </T>
          </Card>

          <Section title="Add a friend" testID="friends-add">
            <Card variant="flat" padding="md">
              <TextField label="Their friend code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={9} placeholder="7 letters and numbers" hint={teen ? "Adults can only be added through your Family Circle." : undefined} testID="friends-add-code" />
              <View style={styles.addAction}>
                <Button label="Send request" icon={UserPlus} variant="secondary" size="md" onPress={() => void add()} disabled={!codeOk} loading={busy === "add"} testID="friends-add-send" />
              </View>
            </Card>
          </Section>

          {view.incoming.length ? (
            <Section title="Requests" testID="friends-requests">
              <Card variant="flat" padding="md">
                {view.incoming.map((r, i) => (
                  <View key={r.from.id} style={[styles.request, i < view.incoming.length - 1 && styles.divider]}>
                    <PersonRow id={r.from.id} name={r.from.displayName} detail={`${r.via === "circle" ? "From your Family Circle" : "Used your code"} · ${timeAgo(r.at, new Date())}`} onMore={() => personMenu(r.from.id, r.from.displayName, false)} testID={`friends-request-${i}`} />
                    <View style={styles.requestActions}>
                      <Button label="Accept" size="sm" onPress={() => void respond(r.from.id, true)} loading={busy === `r-${r.from.id}`} testID={`friends-request-${i}-accept`} />
                      <Button label="Decline" size="sm" variant="ghost" onPress={() => void respond(r.from.id, false)} disabled={busy === `r-${r.from.id}`} testID={`friends-request-${i}-decline`} />
                    </View>
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          <Section title={`Friends · ${view.friends.length}`} testID="friends-list">
            {view.friends.length ? (
              <Card variant="flat" padding="md">
                {view.friends.map((f, i) => (
                  <PersonRow
                    key={f.profile.id}
                    id={f.profile.id}
                    name={f.profile.displayName}
                    online={f.online}
                    detail={f.streak ? "Days in a row, together" : `Friends since ${timeAgoInline(f.since, new Date())}`}
                    trailing={f.streak ? <Chip label={`${f.streak.days}`} tone="reward" icon={Sprout} testID={`friends-${i}-streak`} /> : undefined}
                    onMore={() => personMenu(f.profile.id, f.profile.displayName, true)}
                    divider={i < view.friends.length - 1}
                    testID={`friends-${i}`}
                  />
                ))}
              </Card>
            ) : (
              <StateCard icon={UserPlus} title="No friends yet" body="Share your code, or add someone with theirs. When you both practise on the same day, your friend streak grows." testID="friends-empty" />
            )}
            {view.outgoing.length ? <T variant="caption">{`Waiting for ${view.outgoing.map((p) => p.displayName).join(", ")} to accept.`}</T> : null}
          </Section>

          {view.blocked.length ? (
            <Button label={`${view.blocked.length} blocked · manage in Settings`} variant="ghost" size="sm" onPress={() => router.push("/settings/safety")} testID="friends-blocked" />
          ) : null}
        </>
      )}
      {safety.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addAction: { marginTop: space.sm },
  request: { paddingBottom: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong, marginBottom: space.xs },
  requestActions: { flexDirection: "row", gap: space.xs, marginLeft: 56 },
});
