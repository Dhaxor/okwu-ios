// The Obodo map card: the learner's hometown, restored place by place as
// units are learned. Each place is a button (testID `${testID}-${place}`)
// with its name and three small beads for its stage.
//   <ObodoMap view={game.view(state, now).obodo} labels={labels} onSelectPlace={…} testID="obodo" />
import React from "react";
import { StyleSheet, View } from "react-native";
import { mapGeometry, ObodoMapArt } from "@/components/art/game/ObodoMapArt";
import { useWidth } from "@/components/art/useWidth";
import { Card, Press, ProgressBar, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { PLACE_NAMES_EN, type GameLabels } from "@/lib/game";
import type { ObodoPlace, ObodoStage, ObodoView } from "@/lib/game/types";

export interface ObodoMapProps {
  view: ObodoView;
  labels?: GameLabels;
  /** Heading; the motif name from content, e.g. "Obodo". Default "Your hometown". */
  title?: string;
  titleIgbo?: boolean;
  /** A quiet English line beside an Igbo title (defaults to the English name when the title is Igbo). */
  subtitle?: string;
  onSelectPlace?: (place: ObodoPlace) => void;
  testID: string;
}

const STAGE_WORDS = ["still to come", "being drawn", "coming back to life", "whole again"] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function StageBeads({ stage }: { stage: ObodoStage }) {
  return (
    <View style={styles.stageBeads}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.stageBead, i <= stage ? styles.stageBeadOn : null]} />
      ))}
    </View>
  );
}

export function ObodoMap({ view, labels, title = "Your hometown", titleIgbo = false, subtitle, onSelectPlace, testID }: ObodoMapProps) {
  const [w, onLayout] = useWidth();
  const g = w > 0 ? mapGeometry(w) : null;
  const stages = Object.fromEntries(view.places.map((p) => [p.place, p.stage])) as Record<ObodoPlace, ObodoStage>;
  const nextName = view.next ? labels?.places?.[view.next] ?? cap(PLACE_NAMES_EN[view.next]) : null;
  const sub = subtitle ?? (titleIgbo ? "Your hometown" : undefined);
  return (
    <Card testID={testID} padding="none">
      <View style={styles.head}>
        <View>
          <T variant="title" igbo={titleIgbo} accessibilityRole="header">
            {title}
          </T>
          {sub ? <T variant="caption">{sub}</T> : null}
        </View>
        <T variant="body" strong tone="primary" style={styles.count}>
          {view.restored} of {view.places.length} places restored
        </T>
        {nextName ? (
          <T variant="caption">
            Restoring now: <T variant="caption" strong tone="primary" igbo={!!labels?.places?.[view.next!]}>{nextName}</T>
          </T>
        ) : (
          <T variant="caption">Every place in your hometown is alive.</T>
        )}
        <View style={styles.bar} />
        <ProgressBar value={view.places.reduce((n, p) => n + p.stage, 0) / (view.places.length * 3)} tone="accent" accessibilityLabel={`${view.restored} of ${view.places.length} places restored`} />
      </View>
      <View onLayout={onLayout} style={styles.map}>
        {g ? (
          <>
            <ObodoMapArt width={g.width} stages={stages} next={view.next} />
            {view.places.map((p) => {
              const box = g.boxes[p.place];
              const name = labels?.places?.[p.place];
              const label = name ?? cap(PLACE_NAMES_EN[p.place]);
              const a11y = `${label}: ${STAGE_WORDS[p.stage]}`;
              const body = (
                <View style={styles.tag}>
                  <StageBeads stage={p.stage} />
                  <T variant="caption" strong={p.stage > 0} tone={p.stage > 0 ? "primary" : "muted"} igbo={!!name} numberOfLines={1}>
                    {label}
                  </T>
                </View>
              );
              const frame = { left: box.x, top: box.y, width: box.w, height: box.h + space.lg };
              return onSelectPlace ? (
                <Press key={p.place} testID={`${testID}-${p.place}`} accessibilityLabel={a11y} onPress={() => onSelectPlace(p.place)} pressScale={0.98} style={[styles.place, frame]}>
                  {body}
                </Press>
              ) : (
                <View key={p.place} testID={`${testID}-${p.place}`} accessible accessibilityLabel={a11y} style={[styles.place, frame]}>
                  {body}
                </View>
              );
            })}
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { padding: space.lg, paddingBottom: space.sm, gap: space.xxs },
  count: { marginTop: space.sm },
  bar: { height: space.xxs },
  map: { width: "100%" },
  place: { position: "absolute", justifyContent: "flex-end", alignItems: "center" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  stageBeads: { flexDirection: "row", gap: space.xxs },
  stageBead: { width: 6, height: 6, transform: [{ rotate: "45deg" }], borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface },
  stageBeadOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
