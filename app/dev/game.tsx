// Game gallery (owner B): every game component in several states, each
// built from real GameEngine states on fixed dates. Development builds only.
// Igbo shown here are draft samples (market days and motif names from
// lib/content/draftSamples; crop names from the plan brief; one proverb and
// two names copied from docs/research/language): a DraftTag marks them.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PlantArt } from "@/components/art/game";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { AchievementList, ChainKeptMoment, CollectionCard, IzuChain, LessonCompleteMoment, ObodoMap, QuestCard, UbiGarden } from "@/components/feature/game";
import { Card, Screen, ScreenHeader, Section, T, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { MARKET_DAYS, MOTIF_NAMES } from "@/lib/content/draftSamples";
import { courseMapFrom, createGameEngine, effectCopy, emptyGameState, peakOf, xpOf, zoneCalendar, type GameLabels } from "@/lib/game";
import { lessonDone, metItem, spoke } from "@/lib/game/testkit";
import type { CohortQuest, GameState, GameView, ObodoPlace } from "@/lib/game/types";

const CAL = zoneCalendar("Africa/Lagos");
const at = (day: string, h = 10, m = 0) => CAL.at(day, h, m);

/** A small course: four lessons per place. */
const COURSE = courseMapFrom(
  (["home", "market", "farm", "stream", "village-square", "wedding", "homecoming"] as ObodoPlace[]).map((place, u) => ({
    id: `u${u + 1}`,
    obodoPlace: place,
    lessons: [1, 2, 3, 4].map((l) => `u${u + 1}l${l}`),
  }))
);
const engine = createGameEngine({ calendar: CAL, anchor: null, course: COURSE });

const LABELS: GameLabels = {
  marketDays: { eke: MARKET_DAYS[0], orie: MARKET_DAYS[1], afo: MARKET_DAYS[2], nkwo: MARKET_DAYS[3] },
  crops: { yam: "ji", cocoyam: "ede", "pumpkin-leaf": "ugu", maize: "ọka" },
};

let seq = 0;
function practise(s: GameState, day: string, lessons = 1, hour = 9): GameState {
  for (let i = 0; i < lessons; i++) {
    const id = `x${++seq}`;
    s = engine.apply(s, metItem(`${id}-w`), at(day, hour)).state;
    s = engine.apply(s, spoke(`${id}-w`), at(day, hour)).state;
    s = engine.apply(s, lessonDone(id), at(day, hour)).state;
  }
  return s;
}
function practiseDays(s: GameState, days: string[], lessons = 1) {
  for (const d of days) s = practise(s, d, lessons);
  return s;
}
const view = (s: GameState, day: string, h = 10): GameView => engine.view(s, at(day, h));

function izuStates() {
  const fresh = view(emptyGameState("2026-10-01"), "2026-10-01");
  // Four izu kept, then two days into the fifth.
  let s = practiseDays(emptyGameState("2026-09-15"), ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-19", "2026-09-20", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-26", "2026-09-28", "2026-09-29", "2026-09-30"]);
  const keptChain = s;
  s = practiseDays(s, ["2026-10-01", "2026-10-02"]);
  const twoOfThree = view(s, "2026-10-03");
  const kept = view(practise(s, "2026-10-03"), "2026-10-04");
  // The izu of Oct 1-4 passes unpractised: a repair window opens; one lesson done.
  let r = engine.tick(keptChain, at("2026-10-05", 8)).state;
  r = practise(r, "2026-10-05");
  const repair = view(r, "2026-10-05", 14);
  // Rested: away too long; the Homecoming revival is offered.
  const rested = engine.tick(keptChain, at("2026-10-20", 9)).state;
  const revival = view(rested, "2026-10-20");
  return { fresh: fresh.izu, twoOfThree: twoOfThree.izu, kept: kept.izu, repair: repair.izu, revival: revival.izu, keptState: kept };
}

function gardens() {
  const empty = view(emptyGameState("2026-06-01"), "2026-06-01").garden;
  const young = view(practise(emptyGameState("2026-06-01"), "2026-06-01", 4), "2026-06-01").garden;
  let m = emptyGameState("2026-06-01");
  m = practiseDays(m, ["2026-06-01", "2026-06-02", "2026-06-03"], 3);
  m = engine.harvest(m, at("2026-06-03", 20)).state;
  m = practiseDays(m, ["2026-06-04", "2026-06-05"], 3);
  const mixed = view(m, "2026-06-05", 20).garden;
  const resting = view(m, "2026-06-12").garden;
  let f = emptyGameState("2026-09-01");
  f = practiseDays(f, ["2026-09-01", "2026-09-02"], 4);
  const festival = view(f, "2026-09-02", 20).garden;
  return { empty, young, mixed, resting, festival };
}

function obodos() {
  let s = emptyGameState("2026-10-01");
  const done = (ids: string[]) => {
    for (const id of ids) s = engine.apply(s, lessonDone(id), at("2026-10-01")).state;
  };
  done(["u1l1", "u1l2", "u1l3", "u1l4", "u2l1", "u2l2", "u2l3", "u3l1"]);
  const early = view(s, "2026-10-01").obodo;
  done(COURSE ? Object.keys(COURSE.lessons) : []);
  const whole = view(s, "2026-10-01").obodo;
  return { early, whole };
}

function quests() {
  const base: GameState = emptyGameState("2026-10-19");
  const q: CohortQuest = { week: "2026-W43", questId: "speak-together", metric: "speaking", target: 180, members: 6, mine: 26, mineSynced: 20, syncedTotal: 112, syncedAt: null, milestones: [25, 50], completedAt: null };
  const going = view({ ...base, cohort: q }, "2026-10-23").quest!;
  const done = view({ ...base, cohort: { ...q, questId: "lessons-together", metric: "lessons", target: 30, mine: 7, mineSynced: 7, syncedTotal: 31, completedAt: "2026-10-22T18:00:00.000Z" } }, "2026-10-23").quest!;
  return { going, done };
}

function moment() {
  let s = practiseDays(emptyGameState("2026-10-01"), ["2026-10-01", "2026-10-02"]);
  const r = engine.apply(s, lessonDone("final", ["n1", "n2", "n3"]), at("2026-10-04", 9));
  s = r.state;
  const v = view(s, "2026-10-04", 9);
  const peak = peakOf(r.effects);
  return { xp: xpOf(r.effects).total, peak: peak ? effectCopy(peak, LABELS) : null, izu: v.izu, achievements: v.achievements };
}

export default function GameGallery() {
  const router = useRouter();
  const toast = useToast();
  const izu = useMemo(izuStates, []);
  const garden = useMemo(gardens, []);
  const obodo = useMemo(obodos, []);
  const quest = useMemo(quests, []);
  const lesson = useMemo(moment, []);
  const [harvested, setHarvested] = useState(false);

  return (
    <Screen testID="game-gallery">
      <ScreenHeader eyebrow="Okwu game layer" title="Game gallery" subtitle="Izu, Ubi, Obodo, collections, quests and moments, from real engine states." onBack={() => router.back()} testID="gg-header" />
      <DraftTag testID="gg-draft" />

      <Section title="Izu chain" testID="gg-izu">
        <IzuChain view={izu.fresh} labels={LABELS} title={MOTIF_NAMES.chain} titleIgbo testID="gg-izu-fresh" />
        <IzuChain view={izu.twoOfThree} labels={LABELS} title={MOTIF_NAMES.chain} titleIgbo testID="gg-izu-two" />
        <IzuChain view={izu.kept} labels={LABELS} title={MOTIF_NAMES.chain} titleIgbo testID="gg-izu-kept" />
        <IzuChain view={izu.repair} labels={LABELS} title={MOTIF_NAMES.chain} titleIgbo testID="gg-izu-repair" />
        <IzuChain view={izu.revival} labels={LABELS} title={MOTIF_NAMES.chain} titleIgbo onRevive={() => toast.show("Welcome home", { tone: "success" })} testID="gg-izu-revival" />
        <Card variant="flat" padding="md">
          <T variant="label">Compact (headers)</T>
          <View style={styles.compactRow}>
            <IzuChain view={izu.twoOfThree} labels={LABELS} compact testID="gg-izu-compact" />
          </View>
        </Card>
      </Section>

      <Section title="Ubi garden" testID="gg-ubi">
        <UbiGarden view={garden.mixed} labels={LABELS} title={MOTIF_NAMES.garden} titleIgbo onHarvest={() => setHarvested(true)} testID="gg-ubi-mixed" />
        {harvested ? <T variant="caption">Harvest pressed.</T> : null}
        <UbiGarden view={garden.festival} labels={LABELS} title={MOTIF_NAMES.garden} titleIgbo onHarvest={() => {}} testID="gg-ubi-festival" />
        <UbiGarden view={garden.young} labels={LABELS} title={MOTIF_NAMES.garden} titleIgbo testID="gg-ubi-young" />
        <UbiGarden view={garden.resting} labels={LABELS} title={MOTIF_NAMES.garden} titleIgbo onHarvest={() => {}} testID="gg-ubi-resting" />
        <UbiGarden view={garden.empty} labels={LABELS} title={MOTIF_NAMES.garden} titleIgbo testID="gg-ubi-empty" />
        <Card padding="md" testID="gg-crops">
          <T variant="label">Crops, seed to harvest</T>
          {(["yam", "cocoyam", "pumpkin-leaf", "maize"] as const).map((k) => (
            <View key={k} style={styles.cropRow}>
              {([0, 1, 2, 3, 4] as const).map((st) => (
                <PlantArt key={st} kind={k} stage={st} seed={7} size={56} />
              ))}
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Obodo" testID="gg-obodo">
        <ObodoMap view={obodo.early} title={MOTIF_NAMES.hometown} titleIgbo onSelectPlace={(p) => toast.show(`Opened ${p}`)} testID="gg-obodo-early" />
        <ObodoMap view={obodo.whole} title={MOTIF_NAMES.hometown} titleIgbo testID="gg-obodo-whole" />
      </Section>

      <Section title="Collections" testID="gg-collections">
        <View style={styles.grid}>
          <CollectionCard kind="ilu" igbo="Ilu bụ mmanụ e ji eri okwu" english="Proverbs are the oil that words are eaten with." onPress={() => toast.show("Proverb")} testID="gg-card-ilu" />
          <CollectionCard kind="aha" igbo="Nnamdi" english="My father lives" note="A name of remembrance" onPress={() => toast.show("Name")} testID="gg-card-aha" />
        </View>
        <View style={styles.grid}>
          <CollectionCard kind="akuko" character="mbe" english="The tortoise and the birds" note="Chapter 1 · A feast in the sky" testID="gg-card-akuko-mbe" />
          <CollectionCard kind="akuko" english="The market day" note="Chapter 2" testID="gg-card-akuko" />
        </View>
        <View style={styles.grid}>
          <CollectionCard kind="ilu" locked testID="gg-card-ilu-locked" />
          <CollectionCard kind="aha" igbo="Ifeoma" english="A good thing" testID="gg-card-aha-2" />
        </View>
      </Section>

      <Section title="Weekly quest" testID="gg-quest">
        <QuestCard view={quest.going} title={MOTIF_NAMES.cohort} titleIgbo testID="gg-quest-going" />
        <QuestCard view={quest.done} title={MOTIF_NAMES.cohort} titleIgbo testID="gg-quest-done" />
      </Section>

      <Section title="Moments" testID="gg-moments">
        <Card padding="lg">
          <LessonCompleteMoment xp={lesson.xp} words={3} minutes={6} peak={lesson.peak} izu={lesson.izu} labels={LABELS} testID="gg-moment-lesson" />
        </Card>
        <Card padding="lg">
          <ChainKeptMoment length={izu.kept.length} cells={izu.kept.cells} labels={LABELS} testID="gg-moment-chain" />
        </Card>
      </Section>

      <Section title="Achievements" testID="gg-achievements">
        <AchievementList items={lesson.achievements} limit={6} testID="gg-achievements-list" />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  compactRow: { marginTop: space.sm },
  cropRow: { flexDirection: "row", justifyContent: "space-between" },
  grid: { flexDirection: "row", gap: space.sm },
});
