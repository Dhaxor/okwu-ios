// The club chat (18+), live over the lobby socket. The shared filter gives
// instant feedback as you type (contact details will show as ***; money,
// grooming and abuse are refused) and the server decides. Slow mode shows
// before you hit it. Hold any line for report, block or mute; owners and
// officers can also remove a line.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChatBubble, Composer, StateCard, badgeIcon, useSafetySheet } from "@/components/feature/community";
import { Clock, Info, Trash } from "@/components/glyphs/icons";
import { Chip, IconButton, Screen, ScreenHeader, T, useToast } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { FILTER_MESSAGES, LIMITS, attempt, errorMessage, type ClubMessage, type ClubViewExt, type SocialError } from "@/lib/social";
import { slowModeCopy, untilCopy, useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

export default function ClubChatScreen() {
  const router = useRouter();
  const back = useBack("/community");
  const toast = useToast();
  const social = useSocial();
  const safety = useSafetySheet();
  const client = social.client;
  const me = social.account?.id ?? null;
  const [club, setClub] = useState<ClubViewExt | null>(null);
  const [none, setNone] = useState(false);
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [error, setError] = useState<SocialError | null>(null);
  const [live, setLive] = useState<"connecting" | "open" | "closed">("connecting");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const load = useCallback(async () => {
    const r = await attempt(client.myClub());
    if (!r.ok) return setError(r.error);
    setError(null);
    setClub(r.value);
    setNone(!r.value);
    if (r.value) {
      const m = await attempt(client.clubMessages());
      if (m.ok) setMessages(m.value);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load, social.rev]);

  // The live socket: new lines arrive here (blocked people's never do).
  useEffect(() => {
    if (!club) return;
    const conn = client.connectLobby({
      onState: setLive,
      onMessage: (msg) => {
        if (msg.t === "club_msg" && msg.message.club === club.club.id) setMessages((prev) => (prev.some((m) => m.id === msg.message.id) ? prev : [...prev, msg.message]));
      },
    });
    return () => conn.close();
  }, [client, club?.club.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  // Slow-mode countdown.
  const waitSeconds = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const t = setTimeout(() => setTick((n) => n + 1), 1000);
    return () => clearTimeout(t);
  }, [waitSeconds, tick]);

  const mutedUntil = social.account?.standing.mutedUntil ?? club?.mutedUntil ?? null;
  const muted = mutedUntil && Date.parse(mutedUntil) > Date.now() ? mutedUntil : null;
  const gapMs = Math.max(LIMITS.clubMessageMinGapMs, (club?.slowModeSeconds ?? 0) * 1000);
  const roleOf = useMemo(() => new Map((club?.members ?? []).map((m) => [m.profile.id as string, m.role])), [club]);
  const officer = club?.role === "owner" || club?.role === "officer";

  const send = async () => {
    const line = text.trim();
    if (!line) return;
    setSending(true);
    const r = await attempt(client.sendClubMessage(line));
    setSending(false);
    if (!r.ok) {
      const e = r.error;
      if (e.code === "slow-down") setWaitUntil(Date.now() + (e.retryAfterMs ?? gapMs));
      return toast.show(e.code === "filtered" && e.reason ? FILTER_MESSAGES[e.reason] : errorMessage(e), { tone: "warning" });
    }
    setText("");
    setWaitUntil(Date.now() + gapMs);
    setMessages((prev) => (prev.some((m) => m.id === r.value.id) ? prev : [...prev, r.value]));
    if (r.value.text !== line) toast.show("Contact details were hidden as ***.");
  };

  const lineMenu = (m: ClubMessage) => {
    const mine = m.author.id === me;
    safety.open({
      title: mine ? "Your message" : `${m.author.displayName}'s message`,
      what: "this message",
      target: { kind: "club-message", id: m.id, club: m.club },
      person: mine ? null : { id: m.author.id, name: m.author.displayName },
      excerpt: m.text,
      extras:
        mine || officer
          ? [
              {
                label: mine ? "Delete my message" : "Remove this message",
                icon: Trash,
                testID: "club-line-delete",
                confirm: { title: mine ? "Delete your message?" : "Remove this message?", message: "It's removed for everyone in the club.", confirmLabel: mine ? "Delete" : "Remove" },
                run: async () => {
                  const r = await attempt(client.deleteClubMessage(m.id));
                  if (!r.ok) {
                    toast.show(errorMessage(r.error), { tone: "warning" });
                    return false;
                  }
                  setMessages((prev) => prev.filter((x) => x.id !== m.id));
                  return true;
                },
              },
            ]
          : [],
    });
  };

  if (!social.can("club-chat")) {
    return (
      <Screen testID="club">
        <ScreenHeader eyebrow="Clubs" title="Club chat" onBack={back} testID="club-header" />
        <StateCard kind="locked" title="Club chat is for members 18 and over" testID="club-locked" />
      </Screen>
    );
  }

  const Badge = club ? badgeIcon(club.club.badge) : null;
  const slow = club ? slowModeCopy(club.slowModeSeconds) : null;
  const footer = club ? (
    <Composer
      value={text}
      onChange={setText}
      onSend={() => void send()}
      sending={sending}
      waitSeconds={waitSeconds}
      disabledReason={muted ? `You can't post ${untilCopy(muted, new Date())}. See why, and appeal, in Settings › Appeals.` : null}
      testID="club-compose"
    />
  ) : undefined;

  return (
    <Screen testID="club" scroll={false} keyboard footer={footer}>
      <ScreenHeader
        eyebrow="Club · 18+"
        title={club?.club.name ?? "Your club"}
        onBack={back}
        trailing={club ? <IconButton icon={Info} variant="tinted" accessibilityLabel="Club info, members and leaving" onPress={() => router.push("/community/club-info")} testID="club-info" /> : null}
        testID="club-header"
      />
      {error && !club ? (
        <StateCard kind={error.kind === "api" ? "error" : "offline"} title={error.kind === "api" ? "The chat didn't open" : "You're offline"} body={error.kind === "api" ? errorMessage(error) : "The chat comes back when you're connected."} action={{ label: "Try again", onPress: () => void load(), testID: "club-retry" }} testID="club-error" />
      ) : none ? (
        <StateCard title="You're not in a club" body="Join one to chat with other adult learners." action={{ label: "Find a club", onPress: () => router.replace("/community/clubs"), testID: "club-find" }} testID="club-none" />
      ) : club ? (
        <>
          <View style={styles.status}>
            {Badge ? (
              <View style={styles.badge}>
                <Badge size={size.iconSm} color={colors.accent} strokeWidth={2} />
              </View>
            ) : null}
            <T variant="caption" numeric style={styles.flex} numberOfLines={1}>{`${club.club.memberCount} members · ${live === "open" ? "live" : live === "connecting" ? "connecting…" : "reconnecting…"}`}</T>
            {slow ? <Chip label={slow} icon={Clock} tone="reward" testID="club-slow" /> : null}
          </View>
          <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.lines} keyboardShouldPersistTaps="handled" testID="club-lines">
            <T variant="caption" center style={styles.rules}>
              Be kind. No phone numbers, links or other apps, and no talk about money. Hold any message to report it.
            </T>
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} mine={m.author.id === me} role={roleOf.get(m.author.id) === "member" ? null : (roleOf.get(m.author.id) as "owner" | "officer" | undefined) ?? null} onMore={() => lineMenu(m)} testID={`club-line-${m.id}`} />
            ))}
            {messages.length === 0 ? <T variant="body" tone="muted" center>No messages yet. Say hello.</T> : null}
          </ScrollView>
        </>
      ) : (
        <T variant="body" tone="muted">
          Opening the chat…
        </T>
      )}
      {safety.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: space.xs, flexWrap: "wrap" },
  badge: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.accent12, alignItems: "center", justifyContent: "center" },
  lines: { gap: space.sm, paddingBottom: space.md },
  rules: { marginBottom: space.sm },
});
