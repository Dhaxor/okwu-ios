// Learn. One primary action, pinned above the tab bar: continue (or start)
// the next lesson. Above it: the izu chain, the next lesson as the one
// featured card, the word of the day, the path of units (each framed by the
// Obodo place it restores) and the Ubi garden, which never wilts.
// Loading, error and empty states each say what comes next.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AkweteBand, Nnenne } from "@/components/art";
import { IzuChain, UbiGarden } from "@/components/feature/game";
import { PathSkeleton, UnitCard, WordOfTheDayCard } from "@/components/feature/lesson/Path";
import { LibraryEntryCard } from "@/components/feature/library/LibraryEntryCard";
import { ArrowRight, Repeat } from "@/components/glyphs/icons";
import { Button, Card, ProgressBar, Screen, Section, T, useToast } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { deviceCalendar, effectCopy, peakOf } from "@/lib/game";
import type { ObodoStage } from "@/lib/game/types";
import { seenItems } from "@/lib/learning";
import { buildPath, learnerSettings, useContent, useGame, useItemAudio, useLearning, usePlus, useProfile, useSoftPaywall, withPlannedNext, wordOfTheDay, type PathLesson } from "@/lib/state";

function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function LearnScreen() {
  const router = useRouter();
  const toast = useToast();
  const content = useContent();
  const learning = useLearning();
  const game = useGame();
  const { profile } = useProfile();
  const audio = useItemAudio();
  const bundle = content.bundle;

  // The next lesson's minutes come from the session its lesson screen will plan, so the path and the intro agree.
  const path = useMemo(
    () =>
      bundle && learning.ready
        ? withPlannedNext(buildPath(bundle, learning.progress, profile.track || (profile.heritage ? "heritage" : "new-learner")), {
            bundle,
            progress: learning.progress,
            settings: learnerSettings(profile),
            scheduler: learning.scheduler,
            now: new Date(),
          })
        : null,
    [bundle, learning.ready, learning.progress, learning.scheduler, profile]
  );
  const word = useMemo(() => (bundle ? wordOfTheDay(bundle, deviceCalendar.dayKey(new Date()), seenItems(learning.progress)) : null), [bundle, learning.progress]);
  const stages = useMemo(() => Object.fromEntries((game.view?.obodo.places ?? []).map((p) => [p.place, p.stage])) as Record<string, ObodoStage>, [game.view]);

  const plus = usePlus();
  // The one soft Plus offer: after the first finished lesson, here on a calm screen, once.
  useSoftPaywall(path ? path.lessonsDone : null);
  const open = (lesson: PathLesson) => {
    const unit = path?.units.find((u) => u.lessons.some((l) => l.id === lesson.id));
    // The first units of each track are free forever; the rest of the path is Okwu Plus.
    if (unit && !plus.can("full-path", { unitFree: unit.free })) return router.push({ pathname: "/paywall", params: { from: "path" } });
    router.push({ pathname: "/lesson/[id]", params: { id: lesson.id } });
  };
  const harvest = () => {
    const peak = peakOf(game.harvest());
    if (peak) toast.show(effectCopy(peak, game.labels).detail, { tone: "success" });
  };

  const loading = content.status === "loading" || (content.status === "ready" && (!learning.ready || !path));
  const failed = content.status === "error";
  const next = path?.next ?? null;
  const first = (path?.lessonsDone ?? 0) === 0;

  const footer = failed ? (
    <Button label="Try again" onPress={content.retry} testID="learn-retry" block />
  ) : next ? (
    <Button label={first ? "Start your first lesson" : "Continue lesson"} icon={ArrowRight} iconPosition="trailing" onPress={() => open(next.lesson)} testID="learn-continue" block />
  ) : path && path.lessonsTotal > 0 ? (
    <Button label="Review what you know" icon={Repeat} onPress={() => router.push("/practice")} testID="learn-review" block />
  ) : undefined;

  return (
    <Screen testID="learn" tabbed footer={footer}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <T variant="label" tone="accent">
            {greeting()}
          </T>
          <T variant="display" accessibilityRole="header">
            Your path
          </T>
        </View>
        {game.view ? <IzuChain view={game.view.izu} labels={game.labels} compact testID="learn-izu" /> : null}
      </View>

      {loading ? (
        <PathSkeleton testID="learn-loading" />
      ) : failed ? (
        <Card variant="sunk" testID="learn-error">
          <View style={styles.state}>
            <Nnenne size={96} ground="paper" />
            <T variant="title" center>
              Your lessons didn't open
            </T>
            <T variant="body" tone="muted" center>
              Nothing you've learned is lost. Try again, and if it keeps happening, restart the app.
            </T>
          </View>
        </Card>
      ) : !path || path.units.length === 0 ? (
        <Card variant="sunk" testID="learn-empty">
          <View style={styles.state}>
            <Nnenne size={96} ground="ochre" />
            <T variant="title" center>
              Your first lessons are on their way
            </T>
            <T variant="body" tone="muted" center>
              Every word is recorded by native speakers and checked twice. Lessons appear here as soon as they are ready.
            </T>
          </View>
        </Card>
      ) : (
        <>
          {next ? (
            <Card variant="ink" padding="none" testID="learn-hero" onPress={() => open(next.lesson)} accessibilityLabel={`Next lesson: ${next.lesson.title}`}>
              <AkweteBand height={28} />
              <View style={styles.hero}>
                <T variant="label" tone="onInkMuted">
                  {`Unit ${next.unit.number} · Lesson ${next.lesson.number} of ${next.unit.lessons.length}`}
                </T>
                <T variant="display" tone="onInk">
                  {next.lesson.title}
                </T>
                <T variant="body" tone="onInkMuted">
                  {`${next.unit.title}: ${next.unit.theme}. About ${next.lesson.estMinutes} minutes.`}
                </T>
                <ProgressBar
                  value={next.unit.lessons.length ? next.unit.done / next.unit.lessons.length : 0}
                  steps={next.unit.lessons.length}
                  tone="reward"
                  onInk
                  accessibilityLabel={`${next.unit.done} of ${next.unit.lessons.length} lessons done in this unit`}
                />
                {next.lesson.draft ? (
                  <View style={styles.inkTag} testID="learn-hero-draft">
                    <T variant="caption" strong tone="onInk">
                      Draft · pending native review
                    </T>
                  </View>
                ) : null}
              </View>
            </Card>
          ) : (
            <Card variant="ink" testID="learn-done">
              <T variant="label" tone="onInkMuted">
                {`${path.lessonsDone} lessons done`}
              </T>
              <T variant="display" tone="onInk">
                You've finished every lesson that's ready
              </T>
              <T variant="body" tone="onInkMuted">
                Keep them fresh with a short review. New units arrive as our speakers record them.
              </T>
            </Card>
          )}

          {word ? (
            <Section title="Word of the day">
              <WordOfTheDayCard item={word} marks={profile.toneMarks} audio={audio} testID="learn-word" />
            </Section>
          ) : null}

          <LibraryEntryCard onPress={() => router.push("/library")} testID="learn-library" />

          <Section title="Your path" testID="learn-path">
            <View style={styles.units}>
              {path.units.map((u, i) => (
                <UnitCard
                  key={u.id}
                  unit={u}
                  previous={path.units[i - 1] ?? null}
                  stage={u.place ? (stages[u.place] ?? 0) : 0}
                  labels={game.labels}
                  onOpenLesson={open}
                  plus={!u.free && !plus.isPlus}
                  testID={`learn-unit-${u.number}`}
                />
              ))}
            </View>
          </Section>

          {game.view ? <UbiGarden view={game.view.garden} labels={game.labels} onHarvest={harvest} testID="learn-garden" /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md },
  headText: { flex: 1, gap: space.xxs },
  hero: { padding: space.lg, gap: space.sm },
  inkTag: { alignSelf: "flex-start", marginTop: space.xxs, paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.onInk24 },
  units: { gap: space.md },
  state: { alignItems: "center", gap: space.sm, paddingVertical: space.md },
});
