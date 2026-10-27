// Me: who you are on Okwu, what you've done (XP, the market-day chain, words
// learned, your hometown restored), Okwu Plus, and the way into Settings.
// Values are bigger than their labels; nothing here counts down.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Constants from "expo-constants";
import { Nnenne } from "@/components/art";
import { IzuChain } from "@/components/feature/game";
import { Avatar } from "@/components/feature/community";
import { useToolsGlance } from "@/components/feature/tools";
import { BookOpen, ChartColumn, Download, GalleryVerticalEnd, Info, Layers, Pencil, RotateCcw, Settings, ShieldCheck, Sparkles, Star } from "@/components/glyphs/icons";
import { Button, Card, IconButton, ProgressBar, Row, Screen, Section, Sheet, Switch, T, TextField, useConfirm, useToast } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { seenItems } from "@/lib/learning";
import { FILTER_MESSAGES, attempt, errorMessage } from "@/lib/social";
import { nameFeedback, offerStore, useContent, useDialectLabels, useGame, useLearning, usePlay, usePlus, useProfile, useSocial } from "@/lib/state";

/** Settings' index route. Typed as Href: Expo's incremental route typegen sometimes lists it as "/settings/index". */
const SETTINGS = "/settings" as Href;

export default function MeScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile, reset } = useProfile();
  const play = usePlay();
  const game = useGame();
  const learning = useLearning();
  const { bundle } = useContent();
  const social = useSocial();
  const plus = usePlus();
  const dialects = useDialectLabels();
  const [editing, setEditing] = useState(false);
  const tools = useToolsGlance();

  const name = social.account?.displayName ?? "Learner";
  const track = profile.track ? (bundle?.tracks[profile.track]?.title ?? (profile.heritage ? "Heritage" : "New to Igbo")) : profile.heritage ? "Heritage" : "New to Igbo";
  const home = profile.dialects.length ? profile.dialects.map((d) => dialects[d] ?? d).join(", ") : "Standard Igbo";
  const words = useMemo(() => seenItems(learning.progress).size, [learning.progress]);
  const view = game.view;
  const obodo = view?.obodo;
  const obodoStages = obodo ? obodo.places.reduce((n, p) => n + p.stage, 0) : 0;
  const obodoMax = obodo ? obodo.places.length * 3 : 21;

  const resetOnboarding = async () => {
    const ok = await confirm({
      title: "Start over?",
      message: "This clears the local profile, progress and garden, and shows onboarding again. Development builds only.",
      confirmLabel: "Start over",
      destructive: true,
    });
    if (ok) {
      await play.resetAll();
      await offerStore.clear();
      await reset();
      setTimeout(() => router.replace("/onboarding"), 50);
    }
  };

  return (
    <Screen testID="me" tabbed>
      <View style={styles.profile}>
        <Avatar id={social.account?.id ?? "me"} name={name} size={48} me />
        <View style={styles.flex}>
          <T variant="display" accessibilityRole="header" numberOfLines={1}>
            {name}
          </T>
          <T variant="caption" numberOfLines={2}>{`${track} · ${home}`}</T>
        </View>
        {social.account ? <IconButton icon={Pencil} variant="tinted" accessibilityLabel="Change your name" onPress={() => setEditing(true)} testID="me-edit-name" /> : null}
      </View>

      {plus.isPlus ? (
        <Card variant="flat" padding="md" testID="me-plus">
          <Row title="Okwu Plus" detail="Thank you. Every unit, story and trainer is open." icon={Star} onPress={() => router.push({ pathname: "/paywall", params: { from: "me" } })} testID="me-plus-row" />
        </Card>
      ) : (
        <Card variant="ink" testID="me-plus" onPress={() => router.push({ pathname: "/paywall", params: { from: "me" } })} accessibilityLabel="Okwu Plus: open the whole path. See plans.">
          <View style={styles.plusRow}>
            <View style={styles.flex}>
              <T variant="label" tone="onInkMuted">
                Okwu Plus
              </T>
              <T variant="title" tone="onInk">
                Open the whole path
              </T>
              <T variant="body" tone="onInkMuted">
                Every unit, every story, unlimited trainers. What's free stays free.
              </T>
            </View>
            <View style={styles.plusMark}>
              <Sparkles size={22} color={colors.rewardLight} strokeWidth={2} />
            </View>
          </View>
        </Card>
      )}

      <Section title="Your progress" testID="me-progress">
        <View style={styles.grid}>
          <Stat value={view ? view.xp.total.toLocaleString() : "–"} label="XP" detail={view && view.xp.today ? `+${view.xp.today} today` : "Earned by learning and speaking"} testID="me-stat-xp" />
          <Stat value={String(words)} label={words === 1 ? "word met" : "words met"} detail="Words and phrases you've practised" testID="me-stat-words" />
        </View>
        {view ? (
          <Card variant="flat" padding="md" testID="me-izu">
            <View style={styles.statHead}>
              <View style={styles.flex}>
                <T variant="title" numeric>{`${view.izu.length} ${view.izu.length === 1 ? "market week" : "market weeks"}`}</T>
                <T variant="caption">{`Practise 3 of 4 market days to keep the chain · longest ${view.izu.longest}`}</T>
              </View>
            </View>
            <View style={styles.izu}>
              <IzuChain view={view.izu} labels={game.labels} compact testID="me-izu-chain" />
            </View>
          </Card>
        ) : null}
        <Card variant="flat" padding="md" testID="me-obodo">
          <T variant="title" numeric>{obodo ? `${obodo.restored} of ${obodo.places.length} places restored` : "Your hometown"}</T>
          <T variant="caption" style={styles.obodoLine}>
            Each unit you learn rebuilds a place in your hometown: home, market, farm, stream and more.
          </T>
          <ProgressBar value={obodoMax ? obodoStages / obodoMax : 0} tone="success" accessibilityLabel={`Hometown ${Math.round((obodoMax ? obodoStages / obodoMax : 0) * 100)}% restored`} testID="me-obodo-bar" />
        </Card>
      </Section>

      <Section title="Your tools" testID="me-tools">
        <Card variant="flat" padding="md">
          <Row title="Flashcards" detail={tools.flashcards} icon={GalleryVerticalEnd} onPress={() => router.push("/tools/flashcards")} testID="me-tools-flashcards" divider />
          <Row title="Offline packs" detail={tools.offline} icon={Download} onPress={() => router.push("/tools/offline")} testID="me-tools-offline" divider />
          <Row title="Progress report" detail={tools.report} icon={ChartColumn} onPress={() => router.push("/tools/report")} testID="me-tools-report" />
        </Card>
      </Section>

      <Card variant="flat" padding="md" testID="me-nnenne">
        <View style={styles.nnenne}>
          <Nnenne size={56} ground="ochre" />
          <T variant="body" tone="secondary" style={styles.flex}>
            Nnenne is proud of every attempt. Come back tomorrow and she will have a new word for you.
          </T>
        </View>
      </Card>

      <Section title="More" testID="me-settings">
        <Card variant="flat" padding="md">
          <Row title="Settings" detail="Learning, reminders, account and Okwu Plus" icon={Settings} onPress={() => router.push(SETTINGS)} testID="me-open-settings" divider />
          <Row title="Safety and help" detail="Report, block, appeals and our contact" icon={ShieldCheck} onPress={() => router.push("/settings/safety")} testID="me-safety" divider />
          <Row title="About and credits" detail="Who made the words and recordings" icon={Info} onPress={() => router.push("/settings/credits")} testID="me-credits" />
        </Card>
      </Section>

      {__DEV__ ? (
        <Section title="Developer">
          <Card variant="flat" padding="md">
            <Row title="Kitchen sink" detail="Every primitive and motif" icon={Layers} testID="me-dev-sink" onPress={() => router.push("/dev/kitchen-sink")} divider />
            <Row title="Igbo type test" detail="Letters, tone marks and stacking" icon={Sparkles} testID="me-dev-type" onPress={() => router.push("/dev/type")} divider />
            <Row title="Every exercise type" detail="A showcase lesson from the draft bundle" icon={BookOpen} testID="me-dev-showcase" onPress={() => router.push("/lesson/showcase")} divider />
            {plus.setPlusForTesting ? (
              <Row title="Plus (test)" detail="Turn the entitlement on or off" icon={Star} testID="me-dev-plus" divider trailing={<Switch value={plus.isPlus} onValueChange={(v) => plus.setPlusForTesting?.(v)} accessibilityLabel="Plus for testing" testID="me-dev-plus-switch" />} />
            ) : null}
            <Row title="Reset onboarding" icon={RotateCcw} testID="me-dev-reset" onPress={resetOnboarding} />
          </Card>
        </Section>
      ) : null}

      <T variant="caption" center>
        Okwu {Constants.expoConfig?.version ?? ""}
      </T>
      <NameSheet visible={editing} current={name} onClose={() => setEditing(false)} onSaved={() => toast.show("Name saved.", { tone: "success" })} />
    </Screen>
  );
}

function Stat({ value, label, detail, testID }: { value: string; label: string; detail: string; testID: string }) {
  return (
    <Card variant="flat" padding="md" style={styles.stat} testID={testID}>
      <T variant="display" numeric>
        {value}
      </T>
      <T variant="body" strong tone="primary">
        {label}
      </T>
      <T variant="caption">{detail}</T>
    </Card>
  );
}

/** The display name others see (never a real name required): filtered like every name. */
function NameSheet({ visible, current, onClose, onSaved }: { visible: boolean; current: string; onClose: () => void; onSaved: () => void }) {
  const social = useSocial();
  const toast = useToast();
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const check = nameFeedback(value);
  const save = async () => {
    setBusy(true);
    const r = await attempt(social.client.updateMe({ displayName: value.trim() }));
    setBusy(false);
    if (!r.ok) return toast.show(r.error.code === "filtered" && r.error.reason ? FILTER_MESSAGES[r.error.reason] : errorMessage(r.error), { tone: "warning" });
    void social.refresh();
    onClose();
    onSaved();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID="me-name"
      title="Your name on Okwu"
      subtitle="Family, friends, your cohort and clubs see it. A first name or a nickname is plenty."
      footer={
        <>
          <Button label="Save" onPress={() => void save()} disabled={!check.ok || !value.trim() || value.trim() === current} loading={busy} testID="me-name-save" block />
          <Button label="Cancel" variant="ghost" onPress={onClose} testID="me-name-cancel" block />
        </>
      }
    >
      <TextField label="Name" value={value} onChangeText={setValue} maxLength={24} error={check.ok ? undefined : check.message} testID="me-name-field" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  plusRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  plusMark: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.onInk12, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, gap: space.xxs },
  statHead: { flexDirection: "row", alignItems: "center" },
  izu: { marginTop: space.md },
  obodoLine: { marginVertical: space.xs },
  nnenne: { flexDirection: "row", alignItems: "center", gap: space.md },
});
