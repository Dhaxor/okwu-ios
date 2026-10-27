// The market-day calendar's pieces: today's card (ink, the one featured card)
// and the grid of the next 28 days, one izu per row (Eke, Orie, Afọ, Nkwọ).
import React from "react";
import { StyleSheet, View } from "react-native";
import { MarketDayBead } from "@/components/art/game";
import { AkweteBand } from "@/components/art";
import { ArrowRight } from "@/components/glyphs/icons";
import { Card, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { CalendarCell, LibraryMarketDay } from "@/lib/library";
import type { LibraryAudio } from "@/lib/library/useLibrary";
import { PlayButton } from "./parts";

/** Today's market day, with a dataset sentence that says it, and how sure we are. */
export function TodayCard({
  day,
  verified,
  audio,
  onPress,
  testID,
}: {
  day: LibraryMarketDay;
  verified: boolean;
  audio: LibraryAudio;
  onPress?: () => void;
  testID: string;
}) {
  const inner = (
    <>
      <AkweteBand height={24} />
      <View style={styles.todayBody}>
        <T variant="label" tone="onInkMuted">
          {verified ? "Today's market day" : "Today, in your izu"}
        </T>
        <View style={styles.todayHead}>
          <View style={styles.flex}>
            <T variant="display" igbo tone="onInk">
              {day.spelling}
            </T>
            <T variant="body" tone="onInkMuted">
              {day.label}
            </T>
          </View>
          <PlayButton id={day.audio} audio={audio} label={`Play ${day.spelling}`} playKey={`day-${day.id}`} testID={`${testID}-play`} onInk />
        </View>
        <View style={styles.todayLine}>
          <View style={styles.flex}>
            <T variant="body" igbo tone="onInk">
              {day.today.igbo}
            </T>
            <T variant="caption" tone="onInkMuted">
              {day.today.en}
            </T>
          </View>
          <PlayButton id={day.today.audio} audio={audio} label={`Play: ${day.today.en}`} playKey={`today-${day.id}`} testID={`${testID}-line-play`} onInk />
        </View>
        <View style={styles.inkTag} testID={`${testID}-basis`}>
          <T variant="caption" strong tone="onInk">
            {verified ? "Verified market date" : "Your own cycle · not yet verified"}
          </T>
        </View>
      </View>
      {onPress ? (
        <Press testID={`${testID}-open`} onPress={onPress} pressScale={1} haptics="select" accessibilityLabel="Open the market-day calendar" style={styles.todayLink}>
          <T variant="body" strong tone="onInk" style={styles.flex}>
            The next 28 days
          </T>
          <ArrowRight size={size.icon} color={colors.onInk} strokeWidth={2} />
        </Press>
      ) : null}
    </>
  );
  return (
    <Card variant="ink" padding="none" testID={testID}>
      {inner}
    </Card>
  );
}

/** The next 28 days, one izu per row. Today is filled with ink; past days in the first row are quiet. */
export function MarketCalendar({ rows, days, today, testID }: { rows: CalendarCell[][]; days: LibraryMarketDay[]; today: string; testID: string }) {
  return (
    <View testID={testID} style={styles.grid}>
      <View style={styles.row}>
        {days.map((d) => (
          <View key={d.id} style={styles.head}>
            <MarketDayBead state={d.id === today ? "today" : "open"} size={22} />
            <T variant="caption" igbo strong tone="primary">
              {d.spelling}
            </T>
          </View>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={row[0]?.date ?? r} style={styles.row}>
          {row.map((c) => (
            <View
              key={c.date}
              testID={c.isToday ? `${testID}-today` : undefined}
              accessible
              accessibilityLabel={`${c.weekday} ${c.dayOfMonth} ${c.month}: ${days.find((d) => d.id === c.day)?.spelling ?? c.day}${c.isToday ? ", today" : ""}`}
              style={[styles.cell, c.isToday && styles.today, c.isPast && styles.past]}
            >
              <T variant="caption" strong={c.isToday} tone={c.isToday ? "onInk" : "muted"} numberOfLines={1}>
                {c.isToday ? "Today" : c.weekday}
              </T>
              <T variant="title" tone={c.isToday ? "onInk" : "primary"} numeric>
                {String(c.dayOfMonth)}
              </T>
              {c.showMonth ? (
                <T variant="caption" strong tone={c.isToday ? "onInkMuted" : "accent"} numberOfLines={1} style={styles.month}>
                  {c.month}
                </T>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  todayBody: { padding: space.lg, gap: space.md },
  todayHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  todayLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.onInk24,
  },
  todayLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: size.tapMin + space.sm,
    paddingHorizontal: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.onInk24,
  },
  inkTag: { alignSelf: "flex-start", paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.onInk24 },
  grid: { gap: space.xs },
  row: { flexDirection: "row", gap: space.xs },
  head: { flex: 1, alignItems: "center", gap: space.xxs, paddingBottom: space.xxs },
  cell: {
    flex: 1,
    height: 84,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  today: { backgroundColor: colors.ink, borderColor: colors.ink },
  past: { opacity: 0.45 },
  month: { marginTop: -space.xxs },
});
