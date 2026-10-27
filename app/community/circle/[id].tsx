// A Family Circle: this week's family challenge, relatives' voice notes and
// prompts, who is in it, and the keeper's tools. Invite only. Every note is
// heard by the whole circle, so no adult can speak to a teen out of the
// family's sight. A teen sends voice notes only after a parent or guardian
// here says yes from their own phone (the server says which members can).
// Report, block and mute are on every note and every name.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ConsentRequestCard, FamilyChallengeCard, PersonRow, SendNoteSheet, StateCard, VoiceGateCard, VoiceNoteCard, useSafetySheet } from "@/components/feature/community";
import { Ellipsis, LogOut, Mic, RefreshCw, Share2, ShieldOff, Square, Trash, UserX } from "@/components/glyphs/icons";
import { Button, Card, Chip, IconButton, ProgressBar, Screen, ScreenHeader, Section, T, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { attempt, errorMessage, type AccountId, type CircleView, type SocialError, type VoiceNoteView } from "@/lib/social";
import {
  PROMPT_IDEAS,
  RELATION_LABELS,
  consentRequestsForMe,
  consentsIGave,
  formatDuration,
  timeAgoInline,
  useAgeTier,
  useNotePlayer,
  useNoteRecorder,
  useSocial,
  voiceState,
} from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

export default function CircleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const back = useBack("/community");
  const toast = useToast();
  const social = useSocial();
  const tier = useAgeTier();
  const safety = useSafetySheet();
  const rec = useNoteRecorder({ simulate: !!social.mock });
  const player = useNotePlayer();
  const [circle, setCircle] = useState<CircleView | null>(null);
  const [notes, setNotes] = useState<VoiceNoteView[]>([]);
  const [error, setError] = useState<SocialError | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<AccountId | null>(null);
  /** The prompt being answered ("Say it back"). */
  const [replyTo, setReplyTo] = useState<VoiceNoteView | null>(null);
  const me = social.account?.id ?? null;
  const client = social.client;
  // Off until the server has voice storage: listening still works, recording waits.
  const voiceOn = social.config.flags.voiceNotes !== false;

  const load = useCallback(async () => {
    const r = await attempt(client.myCircles());
    if (!r.ok) return setError(r.error);
    const c = r.value.find((x) => x.id === id) ?? null;
    setMissing(!c);
    setCircle(c);
    setError(null);
    if (c) {
      const n = await attempt(client.voiceNotes(c.id));
      if (n.ok) setNotes(n.value);
    }
  }, [client, id]);

  useEffect(() => {
    void load();
  }, [load, social.rev]);

  // Live: a new note, a guardian request or the family finishing the challenge refreshes the circle.
  const live = useRef({ load, toast });
  live.current = { load, toast };
  useEffect(() => {
    if (!social.hasCreds) return;
    const conn = client.connectLobby({
      onMessage: (m) => {
        const here = (m.t === "voice_note" && m.note.circle === id) || ((m.t === "family_challenge" || m.t === "guardian_request") && m.circle === id);
        if (!here) return;
        if (m.t === "family_challenge" && m.completed) live.current.toast.show("Your family finished this week's challenge together.", { tone: "success" });
        void live.current.load();
      },
    });
    return () => conn.close();
  }, [client, id, social.hasCreds]);

  const vs = useMemo(() => (circle ? voiceState(circle, me, tier) : null), [circle, me, tier]);
  const asks = circle ? consentRequestsForMe(circle, me) : [];
  const given = circle ? consentsIGave(circle, me) : [];
  const keeper = circle?.myRole === "keeper";
  const relationOf = (who: string) => {
    const m = circle?.members.find((x) => x.profile.id === who);
    return m?.relation ? RELATION_LABELS[m.relation] : undefined;
  };
  const forMe = notes.filter((n) => n.to === me);
  const others = notes.filter((n) => n.to !== me);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    const r = await attempt(fn());
    setBusy(null);
    if (!r.ok) {
      toast.show(r.error.code === "forbidden-age" ? "Choose an adult in your circle." : errorMessage(r.error), { tone: "warning" });
      return false;
    }
    if (ok) toast.show(ok, { tone: "success" });
    social.bump();
    return true;
  };

  const play = async (note: VoiceNoteView) => {
    const r = await player.toggle(note.id, () => client.audioSource(note));
    if (r === "unavailable") toast.show("That note couldn't play. Please try again in a moment.", { tone: "warning" });
  };

  const send = async (input: { caption: string; to: AccountId | null }) => {
    if (!circle || !rec.uri) return;
    const answering = replyTo && input.to === replyTo.from ? replyTo.id : undefined;
    const ok = await run(
      "send",
      () => client.sendVoiceNote(circle.id, { to: input.to, ...(input.caption ? { caption: input.caption } : {}), ...(answering ? { replyTo: answering } : {}), audio: { uri: rec.uri!, durationMs: rec.durationMs } }),
      answering ? "Sent. Your answer counts for the family." : "Sent to your circle."
    );
    if (ok) {
      rec.reset();
      setReplyTo(null);
    }
  };

  /** "Say it back": record an answer to a prompt. */
  const canRecord = vs?.kind === "ready" && voiceOn && rec.supported && rec.state !== "recording";
  const reply = (n: VoiceNoteView) => {
    setReplyTo(n);
    void rec.start();
  };

  const noteMenu = (n: VoiceNoteView) => {
    const mine = n.from === me;
    const name = n.author?.displayName ?? "Someone";
    safety.open({
      title: mine ? "Your voice note" : `${name}'s voice note`,
      what: "this voice note",
      target: { kind: "voice-note", id: n.id, circle: n.circle },
      person: mine || !n.author ? null : { id: n.from, name },
      excerpt: n.caption,
      extras:
        mine || keeper
          ? [
              {
                label: "Delete this note",
                icon: Trash,
                testID: "circle-note-delete",
                confirm: { title: "Delete this note?", message: mine ? "It's removed for everyone in the circle." : `As the keeper you can remove ${name}'s note for everyone.`, confirmLabel: "Delete" },
                run: async () => run("delete", () => client.deleteVoiceNote(n.circle, n.id), "Deleted."),
              },
            ]
          : [],
    });
  };

  const memberMenu = (pid: AccountId, name: string) =>
    safety.open({
      title: name,
      what: `${name}'s name`,
      target: { kind: "account", id: pid },
      person: { id: pid, name },
      extras: [
        ...(given.some((g) => g.id === pid)
          ? [
              {
                label: "Take back voice-note consent",
                icon: ShieldOff,
                testID: "circle-member-revoke",
                confirm: { title: "Take back your yes?", message: `${name} won't be able to send voice notes until a parent or guardian says yes again.`, confirmLabel: "Take it back" },
                run: async () => run("revoke", () => client.revokeGuardian(circle!.id, pid), "Done."),
              },
            ]
          : []),
        ...(keeper
          ? [
              {
                label: `Remove ${name} from the circle`,
                icon: UserX,
                testID: "circle-member-remove",
                confirm: { title: `Remove ${name}?`, message: `${name} leaves ${circle?.name ?? "the circle"} and can only come back with a new invite code. Their notes stay until they're deleted or expire.`, confirmLabel: "Remove" },
                run: async () => run("remove", () => client.removeFromCircle(circle!.id, pid), `${name} was removed.`),
              },
            ]
          : []),
      ],
    });

  const circleMenu = () => {
    if (!circle) return;
    const keeperM = circle.members.find((m) => m.role === "keeper");
    safety.open({
      title: circle.name,
      what: "this circle's name",
      target: { kind: "account", id: keeperM?.profile.id ?? (me as AccountId) },
      person: keeperM && keeperM.profile.id !== me ? { id: keeperM.profile.id, name: keeperM.profile.displayName } : null,
      extras: [
        {
          label: "Leave this circle",
          icon: LogOut,
          testID: "circle-leave",
          confirm: { title: `Leave ${circle.name}?`, message: keeper ? "Someone else becomes the keeper. You can only come back with a new invite code." : "You can only come back with a new invite code.", confirmLabel: "Leave" },
          run: async () => {
            const ok = await run("leave", () => client.leaveCircle(circle.id), "You left the circle.");
            if (ok) back();
            return ok;
          },
        },
      ],
    });
  };

  const shareInvite = async () => {
    if (!circle?.invite) return;
    try {
      await Share.share({ message: `Join our Family Circle "${circle.name}" on Okwu with this invite code: ${circle.invite.code}` });
    } catch {
      toast.show(`The invite code is ${circle.invite.code}`);
    }
  };

  // ---- the footer: one primary action -------------------------------------
  let footer: React.ReactNode = null;
  if (circle && vs) {
    if (vs.kind === "ready") {
      if (!voiceOn) footer = <T variant="caption" center>Sending voice notes opens soon. You can listen to every note here, and lessons count for the family challenge.</T>;
      else if (!rec.supported) footer = <T variant="caption" center>Recording works in the iPhone app. You can listen to every note here.</T>;
      else if (rec.state === "recording")
        footer = (
          <>
            <ProgressBar value={rec.elapsedMs / rec.maxMs} accessibilityLabel={`Recording, ${formatDuration(rec.elapsedMs)} of ${formatDuration(rec.maxMs)}`} testID="circle-rec-progress" />
            <Button label={`Stop · ${formatDuration(rec.elapsedMs)}`} icon={Square} variant="danger" onPress={() => void rec.stop()} testID="circle-rec-stop" block />
          </>
        );
      else
        footer = (
          <>
            {rec.state === "denied" ? <T variant="caption" center>Okwu needs the microphone. Turn it on in your phone's Settings.</T> : null}
            <Button
              label="Record a voice note"
              icon={Mic}
              onPress={() => {
                setReplyTo(null);
                void rec.start();
              }}
              testID="circle-rec-start"
              block
            />
          </>
        );
    } else if (vs.kind === "needs-own-consent") {
      footer = <Button label="I agree to voice notes" onPress={() => void run("consent", () => social.acceptVoiceNotes().then((r) => (r.ok ? undefined : Promise.reject(r.error))), "Thank you.")} loading={busy === "consent"} testID="circle-voice-agree" block />;
    } else if (vs.kind === "needs-guardian") {
      const who = vs.candidates.find((m) => m.profile.id === picked)?.profile.displayName;
      footer = <Button label={who ? `Ask ${who} to say yes` : "Choose who to ask"} disabled={!who} loading={busy === "ask"} onPress={() => picked && void run("ask", () => client.requestGuardian(circle.id, picked), `We've asked ${who}.`)} testID="circle-guardian-ask" block />;
    } else if (vs.kind === "guardian-pending" && vs.guardian) {
      const g = vs.guardian;
      footer = <Button label="Cancel the request" variant="ghost" loading={busy === "cancel"} onPress={() => void run("cancel", () => client.revokeGuardian(circle.id, g.id))} testID="circle-guardian-cancel" block />;
    } else if (vs.kind === "no-guardian-here" && keeper) {
      footer = <Button label="Share the invite code" icon={Share2} onPress={() => void shareInvite()} testID="circle-share-invite" block />;
    }
  }

  return (
    <Screen testID="circle" footer={footer ?? undefined}>
      <ScreenHeader
        eyebrow="Family Circle"
        title={circle?.name ?? "Family Circle"}
        subtitle={circle ? `${circle.members.length} of ${circle.maxMembers} people · invite only · everyone hears every note` : undefined}
        onBack={back}
        trailing={circle ? <IconButton icon={Ellipsis} variant="tinted" accessibilityLabel="Circle options: report, leave" onPress={circleMenu} testID="circle-menu" /> : null}
        testID="circle-header"
      />

      {error && !circle ? (
        <StateCard kind={error.kind === "api" ? "error" : "offline"} title={error.kind === "api" ? "This circle didn't open" : "You're offline"} body={error.kind === "api" ? errorMessage(error) : "Voice notes need a connection. Your lessons keep working."} action={{ label: "Try again", onPress: () => void load(), testID: "circle-retry" }} testID="circle-error" />
      ) : missing ? (
        <StateCard kind="locked" title="This circle isn't available" body="You may have left it, or the keeper removed you. Ask a relative for a new invite code." action={{ label: "Back to Community", onPress: back, testID: "circle-missing-back" }} testID="circle-missing" />
      ) : !circle ? (
        <Card variant="sunk" testID="circle-loading">
          <T variant="body" tone="muted">
            Opening your circle…
          </T>
        </Card>
      ) : (
        <>
          {asks.map((t) => (
            <ConsentRequestCard
              key={t.id}
              teen={t}
              busy={busy === `grant-${t.id}`}
              onYes={() => void run(`grant-${t.id}`, () => client.grantGuardian(circle.id, t.id, social.config.versions["voice-notes"]), `${t.displayName} can send voice notes now.`)}
              onNo={() => void run(`deny-${t.id}`, () => client.revokeGuardian(circle.id, t.id), "Okay. You can say yes later if they ask again.")}
              testID={`circle-consent-${t.id}`}
            />
          ))}

          {vs && vs.kind !== "ready" ? <VoiceGateCard state={vs} retentionDays={social.config.voiceRetentionDays} picked={picked} onPick={setPicked} testID="circle-voice-gate" /> : null}

          {circle.challenge ? <FamilyChallengeCard challenge={circle.challenge} me={me} testID="circle-challenge" /> : null}

          {forMe.length ? (
            <Section title="Prompts for you" testID="circle-prompts">
              <T variant="caption">Listen, then say it back in a voice note of your own.</T>
              {forMe.map((n) => (
                <VoiceNoteCard
                  key={n.id}
                  note={n}
                  relation={relationOf(n.from)}
                  mine={n.from === me}
                  forMe
                  playing={player.current === n.id && player.playing}
                  progress={player.current === n.id ? player.progress : 0}
                  onPlay={() => void play(n)}
                  onMore={() => noteMenu(n)}
                  onReply={canRecord && n.from !== me && n.author ? () => reply(n) : undefined}
                  testID={`circle-note-${n.id}`}
                />
              ))}
            </Section>
          ) : null}

          <Section title="Voice notes" testID="circle-notes">
            {others.length ? (
              others.map((n) => (
                <VoiceNoteCard key={n.id} note={n} relation={relationOf(n.from)} mine={n.from === me} forMe={false} playing={player.current === n.id && player.playing} progress={player.current === n.id ? player.progress : 0} onPlay={() => void play(n)} onMore={() => noteMenu(n)} testID={`circle-note-${n.id}`} />
              ))
            ) : (
              <StateCard icon={Mic} title="No voice notes yet" body="Ask someone to record a greeting for you, or record the first one yourself." testID="circle-notes-empty" />
            )}
          </Section>

          <Card variant="sunk" padding="md" testID="circle-ideas">
            <T variant="body" strong tone="primary">
              Ideas for the family to record
            </T>
            <View style={styles.ideas}>
              {PROMPT_IDEAS.map((p) => (
                <T key={p} variant="caption" tone="secondary">{`·  ${p}`}</T>
              ))}
            </View>
          </Card>

          <Section title="People" testID="circle-people">
            <Card variant="flat" padding="md">
              {circle.members.map((m, i) => (
                <PersonRow
                  key={m.profile.id}
                  id={m.profile.id}
                  name={m.profile.displayName}
                  me={m.profile.id === me}
                  detail={[m.relation ? RELATION_LABELS[m.relation] : null, `joined ${timeAgoInline(m.joinedAt, new Date())}`].filter(Boolean).join(" · ")}
                  trailing={m.role === "keeper" ? <Chip label="Keeper" tone="neutral" testID={`circle-member-${i}-keeper`} /> : undefined}
                  onMore={m.profile.id === me ? undefined : () => memberMenu(m.profile.id, m.profile.displayName)}
                  divider={i < circle.members.length - 1}
                  testID={`circle-member-${i}`}
                />
              ))}
            </Card>
            {given.length ? (
              <T variant="caption">{`You said yes to voice notes from ${given.map((g) => g.displayName).join(", ")}. To take it back, open their "…" menu.`}</T>
            ) : null}
          </Section>

          {keeper && circle.invite ? (
            <Section title="Invite family" testID="circle-invite">
              <Card variant="flat" padding="md">
                <T variant="caption">Share this code with relatives yourself. It works for 7 days.</T>
                <T variant="title" numeric style={styles.code} testID="circle-invite-code">
                  {circle.invite.code}
                </T>
                <View style={styles.inviteActions}>
                  <Button label="Share invite" icon={Share2} variant="secondary" size="md" onPress={() => void shareInvite()} testID="circle-invite-share" />
                  <Button label="New code" icon={RefreshCw} variant="ghost" size="md" loading={busy === "rotate"} onPress={() => void run("rotate", () => client.rotateInvite(circle.id), "The old code no longer works.")} testID="circle-invite-rotate" />
                </View>
              </Card>
            </Section>
          ) : null}
        </>
      )}

      {circle && rec.state === "recorded" ? (
        <SendNoteSheet
          visible
          circleName={circle.name}
          replyTo={replyTo?.author ? { id: replyTo.from, name: replyTo.author.displayName } : null}
          durationMs={rec.durationMs}
          strict={circle.hasTeen}
          people={circle.members.filter((m) => m.profile.id !== me).map((m) => ({ id: m.profile.id, name: m.profile.displayName }))}
          busy={busy === "send"}
          onListen={() => rec.uri && void player.toggle("take", async () => ({ uri: rec.uri!.startsWith("mock:") ? "" : rec.uri!, headers: {} })).then((r) => r === "unavailable" && toast.show("Playback works in the iPhone app."))}
          onSend={(i) => void send(i)}
          onDiscard={() => {
            rec.reset();
            setReplyTo(null);
          }}
          testID="circle-send"
        />
      ) : null}
      {safety.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ideas: { gap: space.xxs, marginTop: space.xs },
  code: { marginTop: space.xs, letterSpacing: 2 },
  inviteActions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
});
