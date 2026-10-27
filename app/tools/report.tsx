// The weekly progress report, from what is on this phone: minutes, lessons,
// words met and strong (FSRS stability), reviews and recall, tones heard
// right the first time per tone pattern (a count of listening trials, never
// a score of anyone's voice), the market-day chain, the hometown, and every
// unit's mastery. This week against last, kindly: more is "+N", fewer is
// just last week's number. Shareable as text through the share sheet.
import React, { useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AkweteBand, Nnenne } from "@/components/art";
import { IzuChain } from "@/components/feature/game";
import { CountBeads, DayBars, LEVEL_NAMES, MasteryBar, MasteryLegend, StatTile } from "@/components/feature/tools";
import { ChevronLeft, ChevronRight, Ear, Share2 } from "@/components/glyphs/icons";
import { Button, Card, IconButton, ProgressBar, Screen, ScreenHeader, Section, T, useToast } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { PLACE_NAMES_EN, deviceCalendar } from "@/lib/game";
import type { MasteryLevel } from "@/lib/learning";
import type { ObodoPlace } from "@/lib/game/types";
import { useContent, useGame, useLearning, useProfile } from "@/lib/state";
import { WEEKDAY_INITIALS, headline, shareText, weeklyReport, type ReportInput } from "@/lib/tools";

/** How far back the report goes. */
const MAX_WEEKS_BACK = 12;

const LEVELS: readonly MasteryLevel[] = [4, 3, 2, 1, 0];

export default function ProgressReport() {
  const router = useRouter();
  const toast = useToast();
  const { bundle } = useContent();
  const learning = useLearning();
  const game = useGame();
  const { profile } = useProfile();
  const [offset, setOffset] = useState(0);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/me"));
  const input = useMemo<ReportInput | null>(
    () =>
      bundle && learning.ready
        ? {
            bundle,
            progress: learning.progress,
            log: learning.reviewLog,
            game: game.state,
            view: game.view,
            scheduler: learning.scheduler,
            now: new Date(),
            dayKey: (d) => deviceCalendar.dayKey(d),
            track: profile.track || undefined,
          }
        : null,
    [bundle, learning.ready, learning.progress, learning.reviewLog, learning.scheduler, game.state, game.view, profile.track]
  );
  const report = useMemo(() => (input ? weeklyReport(input, offset) : null), [input, offset]);
  const placeName = (p: string) => game.labels.places?.[p as ObodoPlace] ?? PLACE_NAMES_EN[p as ObodoPlace] ?? p;
  const placeNameEn = (p: string) => PLACE_NAMES_EN[p as ObodoPlace] ?? p;

  const share = async () => {
    if (!report) return;
    try {
      await Share.share({ message: shareText(report, placeNameEn), title: "My week on Okwu" });
    } catch {
      toast.show("Sharing didn't open here. It works from the iPhone app.", { tone: "neutral" });
    }
  };

  if (!report) {
    return (
      <Screen testID="report-loading" center>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            Gathering your week…
          </T>
        </View>
      </Screen>
    );
  }

  const s = report.stats;
  const w = report.week;
  const todayIndex = w.current ? w.daysSoFar - 1 : -1;
  const unitLevels = report.units.reduce<Record<MasteryLevel, number>>(
    (acc, u) => {
      for (const l of LEVELS) acc[l] += u.levels[l];
      return acc;
    },
    { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
  );

  return (
    <Screen testID="report" footer={<Button label={w.current ? "Share this week" : "Share that week"} icon={Share2} onPress={() => void share()} testID="report-share" block />}>
      <ScreenHeader
        eyebrow="Your tools"
        title="Progress report"
        subtitle={`${w.label}${w.current ? " · so far" : ""}`}
        onBack={close}
        trailing={
          <>
            <IconButton
              icon={ChevronLeft}
              variant="tinted"
              accessibilityLabel="The week before"
              onPress={() => setOffset((o) => Math.max(-MAX_WEEKS_BACK, o - 1))}
              disabled={offset <= -MAX_WEEKS_BACK}
              testID="report-prev"
            />
            <IconButton icon={ChevronRight} variant="tinted" accessibilityLabel="The week after" onPress={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} testID="report-next" />
          </>
        }
        testID="report-header"
      />

      <Card variant="ink" padding="lg" testID="report-hero">
        <View style={styles.band}>
          <AkweteBand height={16} ground="ink" />
        </View>
        <T variant="label" tone="onInkMuted">
          {headline(report)}
        </T>
        <View style={styles.heroValue}>
          <T variant="display" tone="onInk" numeric testID="report-minutes">
            {`${s.minutes} min`}
          </T>
          <T variant="body" tone={report.minutes.up ? "onInk" : "onInkMuted"}>
            {report.empty ? "Nothing yet" : report.minutes.note}
          </T>
        </View>
        <View style={styles.heroBars}>
          <DayBars minutes={s.minutesByDay} today={todayIndex} daysSoFar={w.daysSoFar} initials={WEEKDAY_INITIALS} onInk testID="report-days" />
        </View>
        <T variant="caption" tone="onInkMuted">
          {[`${s.daysPractised} ${s.daysPractised === 1 ? "day" : "days"} of practice`, s.xp > 0 ? `${s.xp} XP` : null, report.bestWeek ? "more minutes than any week before" : null]
            .filter(Boolean)
            .join(" · ")}
        </T>
      </Card>

      <View style={styles.grid}>
        <Card variant="flat" padding="md" style={styles.cell} testID="report-lessons">
          <StatTile
            value={String(s.lessons)}
            label={s.lessons === 1 ? "Lesson" : "Lessons"}
            note={report.lessons.note}
            sub={`${Object.keys(learning.progress.lessons).length} finished in all`}
            up={report.lessons.up}
            testID="report-lessons-stat"
          />
        </Card>
        <Card variant="flat" padding="md" style={styles.cell} testID="report-words">
          <StatTile
            value={String(s.newWords)}
            label={s.newWords === 1 ? "New word" : "New words"}
            note={report.newWords.note}
            sub={`${report.words.met} met in all`}
            up={report.newWords.up}
            testID="report-words-stat"
          />
        </Card>
        <Card variant="flat" padding="md" style={styles.cell} testID="report-strong">
          <StatTile
            value={String(report.words.strong)}
            label="Strong words"
            note={report.words.strongGain > 0 ? `+${report.words.strongGain} this week` : "Same as last week"}
            sub="A week or more"
            up={report.words.strongGain > 0}
            testID="report-strong-stat"
          />
        </Card>
        <Card variant="flat" padding="md" style={styles.cell} testID="report-reviews">
          <StatTile
            value={String(s.reviews)}
            label={s.reviews === 1 ? "Review" : "Reviews"}
            note={report.reviews.note}
            sub={report.recall !== null ? `${Math.round(report.recall * 100)}% recalled` : undefined}
            up={report.reviews.up}
            testID="report-reviews-stat"
          />
        </Card>
      </View>
      {s.spoken > 0 ? <T variant="caption">{`You also said ${s.spoken} ${s.spoken === 1 ? "word" : "words"} aloud. Speaking is yours alone: never scored, never counted as right or wrong.`}</T> : null}

      <Section title="Tones heard right first time" testID="report-tones">
        <Card variant="flat" padding="md">
          {report.tones.length > 0 ? (
            <>
              {report.tones.map((t, i) => (
                <View key={t.pattern} style={[styles.tone, i < report.tones.length - 1 && styles.divider]} testID={`report-tone-${i}`}>
                  <View style={styles.flex}>
                    {t.example ? (
                      <T variant="title" igbo>
                        {t.example}
                      </T>
                    ) : null}
                    <T variant="caption">{t.label.charAt(0).toUpperCase() + t.label.slice(1)}</T>
                  </View>
                  <View style={styles.toneCount}>
                    <T variant="body" strong tone="primary" numeric>{`${t.right} of ${t.heard}`}</T>
                    <CountBeads right={t.right} heard={t.heard} testID={`report-tone-${i}-beads`} />
                  </View>
                </View>
              ))}
              <T variant="caption" style={styles.toneNote}>
                Each word's first hearing of the day. A count of listening, never a score of your voice.
              </T>
            </>
          ) : (
            <View style={styles.toneEmpty}>
              <T variant="body" tone="muted">
                {w.current ? "No tone trials yet this week. A few minutes in the tone trainer tunes your ear." : "No tone trials that week."}
              </T>
              {w.current ? <Button label="Train your ear" icon={Ear} variant="secondary" size="sm" onPress={() => router.push("/practice/tones")} testID="report-tones-train" /> : null}
            </View>
          )}
        </Card>
      </Section>

      {report.chain || report.places ? (
        <Section title="Your market days and hometown" testID="report-game">
          {report.chain && game.view ? (
            <Card variant="flat" padding="md" testID="report-chain">
              <T variant="title" numeric>{`${report.chain.length} ${report.chain.length === 1 ? "market week" : "market weeks"}`}</T>
              <T variant="caption">{`Longest ${report.chain.longest} · ${report.chain.kept ? "this market week is kept" : `${report.chain.practised} of ${report.chain.needed} days this market week`}`}</T>
              <View style={styles.izu}>
                <IzuChain view={game.view.izu} labels={game.labels} compact testID="report-izu" />
              </View>
            </Card>
          ) : null}
          {report.places ? (
            <Card variant="flat" padding="md" testID="report-places">
              <T variant="title" numeric>
                {report.places.restored > 0 ? `${report.places.restored} of ${report.places.total} places restored` : `${report.places.rebuilding} of ${report.places.total} places being rebuilt`}
              </T>
              <View style={styles.placesBar}>
                <ProgressBar value={report.places.progress} tone="success" accessibilityLabel={`Hometown ${Math.round(report.places.progress * 100)}% rebuilt`} testID="report-places-bar" />
              </View>
              {report.places.workedOn.length ? (
                <T variant="caption">
                  {w.current ? "This week you worked on " : "That week you worked on "}
                  {report.places.workedOn.map((p, i) => (
                    <React.Fragment key={p}>
                      {i > 0 ? (i === report.places!.workedOn.length - 1 ? " and " : ", ") : ""}
                      <T variant="caption" igbo={!!game.labels.places?.[p as ObodoPlace]} tone="secondary">
                        {placeName(p)}
                      </T>
                    </React.Fragment>
                  ))}
                  .
                </T>
              ) : (
                <T variant="caption">Each unit you learn rebuilds a place in your hometown.</T>
              )}
            </Card>
          ) : null}
        </Section>
      ) : null}

      {report.units.length > 0 ? (
        <Section title="Every unit" testID="report-units">
          <Card variant="flat" padding="md">
            {report.units.map((u, i) => {
              const strong = u.levels[3] + u.levels[4];
              const started = u.lessonsDone > 0;
              if (!started) {
                // Units still ahead: one quiet line each.
                return (
                  <View key={u.id} style={[styles.unitAhead, i < report.units.length - 1 && styles.divider]} testID={`report-unit-${i}`}>
                    <T variant="body" tone="secondary" numberOfLines={1} style={styles.flex}>
                      {u.title}
                    </T>
                    <T variant="caption" numeric>{`Unit ${u.index + 1} · ${strong > 0 ? `${strong}/${u.words} strong` : `${u.words} words`}`}</T>
                  </View>
                );
              }
              return (
                <View key={u.id} style={[styles.unit, i < report.units.length - 1 && styles.divider]} testID={`report-unit-${i}`}>
                  <View style={styles.unitHead}>
                    <View style={styles.flex}>
                      <T variant="body" strong tone="primary" numberOfLines={1}>
                        {u.title}
                      </T>
                      <T variant="caption">{`Unit ${u.index + 1} · ${u.lessonsDone} of ${u.lessonsTotal} lessons`}</T>
                    </View>
                    <T variant="body" strong tone={strong > 0 ? "success" : "muted"} numeric>{`${strong}/${u.words}`}</T>
                  </View>
                  <MasteryBar
                    levels={u.levels}
                    height={8}
                    accessibilityLabel={`${u.title}: ${
                      LEVELS.filter((l) => u.levels[l] > 0)
                        .map((l) => `${u.levels[l]} ${LEVEL_NAMES[l].toLowerCase()}`)
                        .join(", ") || "not started"
                    }`}
                    testID={`report-unit-${i}-bar`}
                  />
                </View>
              );
            })}
          </Card>
          <MasteryLegend levels={unitLevels} testID="report-units-legend" />
          <T variant="caption">The number is words strong or mastered: every skill you've practised holds a week or more.</T>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", gap: space.md },
  band: { marginHorizontal: -space.lg, marginTop: -space.lg, marginBottom: space.md },
  heroValue: { gap: space.xxs, marginTop: space.xxs },
  heroBars: { marginTop: space.lg, marginBottom: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: -space.md },
  cell: { flexBasis: "47%", flexGrow: 1 },
  tone: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  toneCount: { alignItems: "flex-end", gap: space.xxs, maxWidth: 140 },
  toneNote: { marginTop: space.xs },
  toneEmpty: { gap: space.sm, alignItems: "flex-start" },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  izu: { marginTop: space.md },
  placesBar: { marginVertical: space.xs },
  unit: { gap: space.xs, paddingVertical: space.sm },
  unitHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  unitAhead: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48, paddingVertical: space.xs },
});
