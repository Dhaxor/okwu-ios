// Otu clubs: small clubs of adult learners (18+), up to 30 people, one club
// at a time, with a filtered chat. Clubs can be found by name; people can't.
// Creating one needs an account a few days old with a clean record.
// Names and descriptions are user-made, so each card can be reported.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CLUB_BADGES, ClubCard, StateCard, useSafetySheet } from "@/components/feature/community";
import { Plus, Search, Users } from "@/components/glyphs/icons";
import { Button, Chip, Screen, ScreenHeader, Sheet, Switch, T, TextField, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { attempt, errorMessage, FILTER_MESSAGES, type ClubId, type ClubSummary, type SocialError } from "@/lib/social";
import { chatFeedback, nameFeedback, useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

export default function ClubsScreen() {
  const router = useRouter();
  const back = useBack("/community");
  const toast = useToast();
  const social = useSocial();
  const safety = useSafetySheet();
  const allowed = social.can("clubs");
  const [q, setQ] = useState("");
  const [clubs, setClubs] = useState<ClubSummary[] | null>(null);
  const [mine, setMine] = useState<ClubId | null>(null);
  const [error, setError] = useState<SocialError | null>(null);
  const [joining, setJoining] = useState<ClubId | null>(null);
  const [creating, setCreating] = useState(false);
  const client = social.client;

  const load = useCallback(async () => {
    if (!allowed) return;
    const [list, my] = await Promise.all([attempt(client.searchClubs(q.trim())), attempt(client.myClub())]);
    if (list.ok) {
      setClubs(list.value);
      setError(null);
    } else setError(list.error);
    if (my.ok) setMine(my.value?.club.id ?? null);
  }, [client, q, allowed]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q, social.rev]);

  const join = async (c: ClubSummary) => {
    if (mine) return toast.show("You can be in one club at a time. Leave yours first, from its chat.", { tone: "warning" });
    setJoining(c.id);
    const r = await attempt(client.joinClub({ id: c.id }));
    setJoining(null);
    if (!r.ok) return toast.show(r.error.code === "full" ? "That club is full." : r.error.code === "closed" ? "That club is invite only." : errorMessage(r.error), { tone: "warning" });
    social.bump();
    toast.show(`Welcome to ${c.name}.`, { tone: "success" });
    router.replace("/community/club");
  };

  if (!allowed) {
    return (
      <Screen testID="clubs">
        <ScreenHeader eyebrow="Clubs" title="Open clubs" onBack={back} testID="clubs-header" />
        <StateCard kind="locked" title="Open clubs are for members 18 and over" body="You have your Family Circle, friends and your cohort." testID="clubs-locked" />
      </Screen>
    );
  }

  return (
    <Screen testID="clubs" keyboard footer={!mine ? <Button label="Start a club" icon={Plus} onPress={() => setCreating(true)} testID="clubs-create" block /> : undefined}>
      <ScreenHeader eyebrow="Clubs · 18+" title="Find a club" subtitle="Small clubs of adult learners. Chat is filtered: no links, numbers or money talk." onBack={back} testID="clubs-header" />
      <TextField label="Search clubs by name" value={q} onChangeText={setQ} placeholder="Beginners, tones, Toronto…" autoCorrect={false} testID="clubs-search" />
      {error && !clubs ? (
        <StateCard kind={error.kind === "api" ? "error" : "offline"} title={error.kind === "api" ? "Clubs didn't load" : "You're offline"} body={errorMessage(error)} action={{ label: "Try again", onPress: () => void load(), testID: "clubs-retry" }} testID="clubs-error" />
      ) : !clubs ? (
        <T variant="body" tone="muted">
          Looking for clubs…
        </T>
      ) : clubs.length ? (
        <View style={styles.list}>
          {clubs.map((c) => (
            <ClubCard
              key={c.id}
              club={c}
              mine={mine === c.id}
              onOpen={() => router.push("/community/club")}
              onJoin={() => void join(c)}
              joining={joining === c.id}
              onMore={() => safety.open({ title: c.name, what: "this club", target: { kind: "club", id: c.id }, excerpt: c.description })}
              testID={`clubs-${c.id}`}
            />
          ))}
        </View>
      ) : (
        <StateCard icon={q ? Search : Users} title={q ? "No clubs by that name" : "No open clubs yet"} body={q ? "Try another word, or start your own." : "Start the first one."} testID="clubs-empty" />
      )}
      <CreateClubSheet visible={creating} onClose={() => setCreating(false)} onCreated={() => router.replace("/community/club")} />
      {safety.sheet}
    </Screen>
  );
}

function CreateClubSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const social = useSocial();
  const toast = useToast();
  const [name, setName] = useState("");
  const [descr, setDescr] = useState("");
  const [badge, setBadge] = useState("sprout");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const nameCheck = useMemo(() => nameFeedback(name, 24), [name]);
  const descrCheck = useMemo(() => chatFeedback(descr, 120), [descr]);
  const descrError = !descrCheck.ok ? descrCheck.message : descrCheck.masked ? FILTER_MESSAGES.contact : undefined;
  const ok = !!name.trim() && nameCheck.ok && !descrError;

  const create = async () => {
    setBusy(true);
    const r = await attempt(social.client.createClub({ name: name.trim(), badge, description: descr.trim(), open }));
    setBusy(false);
    if (!r.ok) {
      const e = r.error;
      return toast.show(
        e.code === "filtered" && e.reason ? FILTER_MESSAGES[e.reason] : e.code === "conflict" ? "A club already has that name." : e.code === "limit" ? "New accounts can join clubs; starting one opens after a few days." : e.code === "already" ? "Leave your club before starting one." : errorMessage(e),
        { tone: "warning" }
      );
    }
    social.bump();
    onClose();
    toast.show(`${r.value.club.name} is open.`, { tone: "success" });
    onCreated();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID="clubs-new"
      title="Start a club"
      subtitle="You'll be its owner: you can remove people and slow the chat down. Our moderators see every report."
      scroll
      footer={
        <>
          <Button label="Start the club" onPress={() => void create()} disabled={!ok} loading={busy} testID="clubs-new-submit" block />
          <Button label="Cancel" variant="ghost" onPress={onClose} testID="clubs-new-cancel" block />
        </>
      }
    >
      <View style={styles.form}>
        <TextField label="Club name" value={name} onChangeText={setName} maxLength={30} error={nameCheck.ok ? undefined : nameCheck.message} testID="clubs-new-name" />
        <TextField label="What it's about (optional)" value={descr} onChangeText={setDescr} multiline maxLength={140} error={descrError} hint="No links, numbers or other apps." testID="clubs-new-descr" />
        <View style={styles.badges}>
          {CLUB_BADGES.map((b) => (
            <Chip key={b.id} label={b.label} icon={b.icon} selected={badge === b.id} onPress={() => setBadge(b.id)} testID={`clubs-new-badge-${b.id}`} />
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <T variant="body" tone="primary">
              Anyone 18+ can join
            </T>
            <T variant="caption">Off: only people with the club's code.</T>
          </View>
          <Switch value={open} onValueChange={setOpen} accessibilityLabel="Anyone 18 and over can join" testID="clubs-new-open" />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  form: { gap: space.lg },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
});
