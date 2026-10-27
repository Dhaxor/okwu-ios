// The izu chain widget: the four market days (Eke, Orie, Afọ, Nkwọ) as
// woven beads, the chain's length, and one calm status line. A repair
// window shows as an ochre "waiting" panel, never a warning; the yearly
// Homecoming revival is offered as an invitation.
//   <IzuChain view={game.view(state, now).izu} labels={labels} onRevive={…} testID="izu" />
//   <IzuChain compact … />  the beads alone, for headers
import React from "react";
import { StyleSheet, View } from "react-native";
import { MarketDayBead } from "@/components/art/game/MarketDayBead";
import { Button, Card, ProgressBar, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { izuStatusCopy, type GameLabels } from "@/lib/game";
import type { IzuCell, IzuView, MarketDay } from "@/lib/game/types";

export interface IzuChainProps {
  view: IzuView;
  /** Display names from approved content (market days are Igbo). */
  labels?: GameLabels;
  /** Heading; the motif name from content, e.g. "Izu". Default "Market-day chain". */
  title?: string;
  titleIgbo?: boolean;
  /** A quiet English line beside an Igbo title (defaults to the English name when the title is Igbo). */
  subtitle?: string;
  /** Offered when the Homecoming revival is available. */
  onRevive?: () => void;
  compact?: boolean;
  testID: string;
}

const FALLBACK: Record<MarketDay, string> = { eke: "Day 1", orie: "Day 2", afo: "Day 3", nkwo: "Day 4" };

function cellLabel(c: IzuCell, labels?: GameLabels): { text: string; igbo: boolean } {
  const name = labels?.marketDays?.[c.day];
  return name ? { text: name, igbo: true } : { text: FALLBACK[c.day], igbo: false };
}

function a11yFor(view: IzuView, labels?: GameLabels): string {
  const days = view.cells
    .map((c) => {
      const n = cellLabel(c, labels).text;
      const s = c.state === "practised" ? "practised" : c.state === "rest" ? "rest day" : c.isToday ? "today" : c.state === "missed" ? "not practised" : "to come";
      return `${n}, ${s}`;
    })
    .join("; ");
  return `Market-day chain: ${view.length} market weeks. ${view.practised} of ${view.needed} days this week. ${days}.`;
}

export function IzuChain({ view, labels, title = "Market-day chain", titleIgbo = false, subtitle, onRevive, compact = false, testID }: IzuChainProps) {
  if (compact) {
    return (
      <View testID={testID} style={styles.compact} accessible accessibilityLabel={a11yFor(view, labels)}>
        {view.cells.map((c) => {
          const l = cellLabel(c, labels);
          return (
            <View key={c.day} style={styles.compactDay}>
              <MarketDayBead state={c.state} today={c.isToday} size={22} />
              <T variant="caption" igbo={l.igbo} tone={c.state === "open" || c.state === "missed" ? "faint" : "secondary"}>
                {l.text}
              </T>
            </View>
          );
        })}
      </View>
    );
  }

  // With the revival panel showing, the status speaks about today, not the offer.
  const offer = !!(view.revival && onRevive);
  const status = izuStatusCopy(offer ? { ...view, revival: null } : view, labels);
  const sub = subtitle ?? (titleIgbo ? "Market-day chain" : undefined);
  return (
    <Card testID={testID}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <T variant="title" igbo={titleIgbo} accessibilityRole="header">
            {title}
          </T>
          {sub ? <T variant="caption">{sub}</T> : null}
        </View>
        <View style={styles.count} accessible accessibilityLabel={`${view.length} market weeks in a row`}>
          <T variant="display" numeric tone={view.length > 0 ? "accent" : "faint"}>
            {view.length}
          </T>
          <T variant="caption">{view.length === 1 ? "market week" : "market weeks"}</T>
        </View>
      </View>

      <View style={styles.beads} accessible accessibilityLabel={a11yFor(view, labels)}>
        {view.cells.map((c) => {
          const l = cellLabel(c, labels);
          return (
            <View key={c.day} style={styles.day}>
              <MarketDayBead state={c.state} today={c.isToday} size={36} />
              <T variant="body" igbo={l.igbo} tone={c.state === "open" || c.state === "missed" ? "muted" : "primary"} strong={c.isToday}>
                {l.text}
              </T>
              <T variant="caption" tone={c.isToday ? "accent" : "faint"}>
                {c.isToday ? "Today" : c.state === "rest" ? "Rest" : " "}
              </T>
            </View>
          );
        })}
      </View>

      <View style={styles.status}>
        <T variant="body" strong tone="primary">
          {status.title}
        </T>
        <T variant="caption">{status.detail}</T>
      </View>

      {view.repair ? (
        <View style={styles.repair} testID={`${testID}-repair`}>
          <ProgressBar value={view.repair.lessonsDone / view.repair.needed} steps={view.repair.needed} tone="reward" accessibilityLabel={`${view.repair.lessonsDone} of ${view.repair.needed} mending lessons done`} />
          <T variant="caption" tone="reward" strong>
            {view.repair.lessonsDone} of {view.repair.needed} done
          </T>
        </View>
      ) : null}

      {offer && view.revival && onRevive ? (
        <View style={styles.revival} testID={`${testID}-revival`}>
          <T variant="body" tone="primary" strong>
            Homecoming
          </T>
          <T variant="caption">Once a year, a chain that rested can come home with you: {view.revival.length} market weeks.</T>
          <Button label="Bring it home" size="sm" variant="secondary" onPress={onRevive} testID={`${testID}-revive`} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  compact: { flexDirection: "row", gap: space.sm },
  compactDay: { alignItems: "center", gap: space.xxs },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md },
  headText: { flex: 1 },
  status: { gap: space.xxs },
  count: { alignItems: "flex-end" },
  beads: { flexDirection: "row", justifyContent: "space-between", marginTop: space.md, marginBottom: space.sm },
  day: { alignItems: "center", gap: space.xxs, minWidth: 64 },
  repair: { marginTop: space.md, padding: space.md, gap: space.xs, borderRadius: radius.lg, backgroundColor: colors.reward12 },
  revival: { marginTop: space.md, padding: space.md, gap: space.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.accent06 },
});
