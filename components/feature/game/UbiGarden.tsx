// The Ubi garden card: the procedural garden, a calm status line, the
// barn (what has been harvested, per crop) and a Harvest button when
// something is ripe. Nothing here ever wilts: a garden left alone says it
// waited for you.
//   <UbiGarden view={game.view(state, now).garden} labels={labels} onHarvest={…} testID="ubi" />
import React from "react";
import { StyleSheet, View } from "react-native";
import { PlantArt, UbiGardenArt } from "@/components/art/game/UbiGardenArt";
import { Sprout } from "@/components/glyphs/icons";
import { Button, Card, Chip, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { CROP_NAMES_EN, gardenStatusCopy, UBI, type GameLabels } from "@/lib/game";
import type { GardenView, PlantKind } from "@/lib/game/types";

export interface UbiGardenProps {
  view: GardenView;
  labels?: GameLabels;
  /** Heading; the motif name from content, e.g. "Ubi". Default "Your garden". */
  title?: string;
  titleIgbo?: boolean;
  /** A quiet English line beside an Igbo title (defaults to the English name when the title is Igbo). */
  subtitle?: string;
  onHarvest?: () => void;
  testID: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function a11y(view: GardenView, labels?: GameLabels): string {
  const crops = view.plots
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => `${labels?.crops?.[p.kind] ?? CROP_NAMES_EN[p.kind]} ${p.ripe ? "ripe" : `stage ${p.stage} of 4`}`)
    .join(", ");
  return `Garden: ${view.growing} growing, ${view.ripe} ripe. ${crops}`;
}

export function UbiGarden({ view, labels, title = "Your garden", titleIgbo = false, subtitle, onHarvest, testID }: UbiGardenProps) {
  const status = gardenStatusCopy(view);
  const sub = subtitle ?? (titleIgbo ? "Your garden" : undefined);
  const anyBarn = UBI.crops.some((c) => (view.barn[c] ?? 0) > 0);
  return (
    <Card testID={testID} padding="none">
      <View style={styles.head}>
        <View style={styles.headText}>
          <T variant="title" igbo={titleIgbo} accessibilityRole="header">
            {title}
          </T>
          {sub ? <T variant="caption">{sub}</T> : null}
        </View>
        {view.festival === "iri-ji" ? <Chip label="New Yam season" tone="reward" icon={Sprout} testID={`${testID}-festival`} /> : null}
      </View>

      <View style={styles.art} accessible accessibilityLabel={a11y(view, labels)}>
        <UbiGardenArt plots={view.plots} resting={view.resting} />
      </View>

      <View style={styles.foot}>
        <View style={styles.status}>
          <T variant="body" strong tone="primary">
            {status.title}
          </T>
          <T variant="caption">{status.detail}</T>
        </View>
        <View style={styles.barn} accessible accessibilityLabel={`Barn: ${UBI.crops.map((c) => `${view.barn[c] ?? 0} ${labels?.crops?.[c] ?? CROP_NAMES_EN[c]}`).join(", ")}`}>
          {UBI.crops.map((c: PlantKind) => {
            const name = labels?.crops?.[c];
            return (
              <View key={c} style={styles.crop}>
                <View style={styles.cropArt}>
                  <PlantArt kind={c} stage={4} seed={3} size={28} />
                </View>
                <T variant="caption" igbo={!!name} tone="secondary" numberOfLines={1}>
                  {name ?? cap(CROP_NAMES_EN[c])}
                </T>
                {anyBarn ? (
                  <T variant="caption" strong numeric tone={(view.barn[c] ?? 0) > 0 ? "reward" : "faint"}>
                    {view.barn[c] ?? 0}
                  </T>
                ) : null}
              </View>
            );
          })}
        </View>
        {view.ripe > 0 && onHarvest ? (
          <Button label={view.ripe === 1 ? "Gather the harvest" : `Gather ${view.ripe} crops`} icon={Sprout} variant="secondary" size="md" block onPress={onHarvest} testID={`${testID}-harvest`} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.lg },
  headText: { flex: 1 },
  status: { gap: space.xxs },
  art: { paddingHorizontal: space.sm, marginTop: space.xs },
  foot: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.md, gap: space.md },
  barn: { flexDirection: "row", justifyContent: "space-between", paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  crop: { flex: 1, alignItems: "center", gap: space.xxs },
  cropArt: { height: 34, justifyContent: "flex-end", overflow: "hidden", borderRadius: radius.sm },
});
