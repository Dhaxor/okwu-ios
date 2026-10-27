// The market-day calendar: today's market day and the next 28 days, one izu
// per row, from lib/game's market-day logic. Until a cultural advisor sets a
// verified anchor (MARKET_DAY_ANCHOR), it follows the learner's own izu from
// their first day, as the izu chain does, and says so before anything else.
// Then the four days: what the dataset says about each, a sentence to hear,
// and the names given to children born on it.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { IgboLine, MarketCalendar, PlayButton, ReviewTag, SourceNote, TodayCard } from "@/components/feature/library";
import { ArrowLeft, Info, Sprout } from "@/components/glyphs/icons";
import { Card, Chip, IconButton, Row, Screen, Section, T } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { calendarFile, calendarRows, daysUntil, namesFile, namesForDay } from "@/lib/library";
import { useLibraryAudio, useTodayInIzu } from "@/lib/library/useLibrary";

export default function MarketDayCalendar() {
  const router = useRouter();
  const audio = useLibraryAudio();
  const izu = useTodayInIzu();
  const { days, beliefNote } = calendarFile();
  const names = namesFile().names;
  const rows = useMemo(() => calendarRows(izu.today, izu.align), [izu.today, izu.align]);
  const today = days.find((d) => d.id === izu.day);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library"));

  return (
    <Screen testID="calendar">
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={close} testID="calendar-back" variant="tinted" />
        <T variant="label" tone="accent">
          Izu · Market days
        </T>
      </View>
      <T variant="display" accessibilityRole="header">
        Market-day calendar
      </T>

      {today ? <TodayCard day={today} verified={izu.verified} audio={audio} testID="calendar-today" /> : null}

      {!izu.verified ? (
        <Card variant="sunk" testID="calendar-anchor">
          <View style={styles.notice}>
            <Info size={size.icon} color={colors.ink80} strokeWidth={2} />
            <View style={styles.flex}>
              <T variant="body" strong tone="primary">
                Market cycles are kept locally
              </T>
              <T variant="body" tone="muted">
                Neighbouring towns share a market day, but the cycle isn't the same everywhere, and Okwu won't guess yours. Until our cultural advisor confirms a verified date, this counts your own izu from the day you started, as your market-day chain does. Ask an elder which day it is at home.
              </T>
            </View>
          </View>
        </Card>
      ) : null}

      <Section title="The next 28 days" testID="calendar-grid-section">
        <MarketCalendar rows={rows} days={days} today={izu.day} testID="calendar-grid" />
      </Section>

      <Section title="The four days" testID="calendar-days">
        <View style={styles.days}>
          {days.map((d, i) => {
            const born = namesForDay(names, d.names, d.id);
            const until = daysUntil(izu.today, izu.align, d.id);
            return (
              <Card key={d.id} testID={`calendar-day-${d.id}`}>
                <View style={styles.dayHead}>
                  <View style={styles.flex}>
                    <T variant="label">{`${i + 1} of 4 · ${until === 0 ? "today" : until === 1 ? "tomorrow" : `in ${until} days`}`}</T>
                    <T variant="display" igbo>
                      {d.spelling}
                    </T>
                    <T variant="body" tone="muted">
                      {d.label}
                    </T>
                  </View>
                  <PlayButton id={d.audio} audio={audio} label={`Play ${d.spelling}`} playKey={`calendar-${d.id}`} testID={`calendar-day-${d.id}-play`} />
                </View>
                <T variant="body" tone="primary" style={styles.about}>
                  {d.about}
                </T>
                <View style={styles.rule} />
                <IgboLine line={d.line} audio={audio} testID={`calendar-day-${d.id}-line`} />
                {born.length > 0 ? (
                  <View style={styles.born}>
                    <T variant="caption" strong tone="secondary">
                      Names for a child born on this day
                    </T>
                    <View style={styles.chips}>
                      {born.map((n) => (
                        <Chip key={n.id} label={n.spelling} igbo onPress={() => router.push({ pathname: "/library/names/[id]", params: { id: n.id } })} testID={`calendar-day-${d.id}-name-${n.id}`} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
        <T variant="caption" testID="calendar-belief">
          {beliefNote}
        </T>
      </Section>

      <Card variant="flat" padding="md">
        <Row title="About the four market days" detail="The izu, names and older meanings" icon={Sprout} onPress={() => router.push({ pathname: "/library/customs/[id]", params: { id: "market-week" } })} testID="calendar-explainer" />
      </Card>

      <View style={styles.tags}>
        <ReviewTag kind="draft" testID="calendar-review" />
      </View>
      <SourceNote testID="calendar-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md },
  notice: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  days: { gap: space.md },
  dayHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  about: { marginTop: space.sm },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong, marginTop: space.md },
  born: { gap: space.xs, marginTop: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
