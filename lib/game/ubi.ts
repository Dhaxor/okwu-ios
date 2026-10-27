// Ubi, the garden (docs/CONTRACTS.md §3). Practice tends it: every growing
// plant gains points and climbs stages 0 → 4. Crops are sown in a mixed
// rotation (ji, ede, ugu, ọka), staggered so the garden always shows
// something young and something ripe. Nothing wilts or dies: ripe plants
// wait for the harvest, and a garden left alone simply rests. In the Iri Ji
// window plants grow faster and the harvest is doubled.
import { daysBetween, festivalOn } from "./calendar";
import { GROWTH_POINTS_PER_STAGE, UBI } from "./rules";
import type { Festival, GameEffect, GardenView, GrowthStage, LocalDate, Plant, PlantKind, UbiGarden, XpSource } from "./types";
import type { UnitId } from "@/lib/content/types";

/** Plots in the order seeds are placed: spread across both rows so a young garden looks planted, not crowded. */
export const PLOT_ORDER: readonly number[] = [1, 6, 3, 4, 0, 7, 2, 5];

function freePlot(garden: UbiGarden): number | null {
  const used = new Set(garden.plants.map((p) => p.plot));
  for (const p of PLOT_ORDER) if (p < UBI.plots && !used.has(p)) return p;
  return null;
}

/** Sow the next crop in the rotation if the garden has room and the youngest plant is up. */
export function maybeSow(garden: UbiGarden, nowIso: string, from: UnitId): { garden: UbiGarden; effects: GameEffect[] } {
  const growing = garden.plants.filter((p) => p.stage < 4);
  if (growing.length >= UBI.maxGrowing) return { garden, effects: [] };
  const youngest = growing.reduce<number>((m, p) => Math.min(m, p.stage), 4);
  if (growing.length > 0 && youngest < UBI.sowAtStage) return { garden, effects: [] };
  const plot = freePlot(garden);
  if (plot === null) return { garden, effects: [] };
  const kind = UBI.crops[garden.sown % UBI.crops.length] as PlantKind;
  const plant: Plant = { id: `${kind}-${garden.sown + 1}`, kind, stage: 0, points: 0, plantedAt: nowIso, from, plot };
  return {
    garden: { ...garden, plants: [...garden.plants, plant], sown: garden.sown + 1 },
    effects: [{ kind: "plant-sown", plant: plant.id, crop: kind }],
  };
}

/** Practice tends the garden: sow if there is room, then every growing plant gains points. */
export function tend(
  garden: UbiGarden,
  source: XpSource,
  today: LocalDate,
  nowIso: string,
  from: UnitId
): { garden: UbiGarden; effects: GameEffect[] } {
  const effects: GameEffect[] = [];
  const sown = maybeSow(garden, nowIso, from);
  effects.push(...sown.effects);
  const boost = festivalOn(today) === "iri-ji" ? UBI.festivalGrowth : 1;
  const gain = (UBI.growth[source] ?? 0) * boost;
  const plants = sown.garden.plants.map((p) => {
    if (p.stage >= 4 || gain <= 0) return p;
    let stage = p.stage as number;
    let points = p.points + gain;
    while (points >= GROWTH_POINTS_PER_STAGE && stage < 4) {
      points -= GROWTH_POINTS_PER_STAGE;
      stage += 1;
      effects.push({ kind: "plant-grew", plant: p.id, stage: stage as GrowthStage });
    }
    if (stage >= 4) points = 0;
    return { ...p, stage: stage as GrowthStage, points };
  });
  // A sown seed may have room for the next one right after growing (keeps the rotation moving).
  let next: UbiGarden = { ...sown.garden, plants, lastTendedAt: nowIso };
  if (sown.effects.length === 0) {
    const again = maybeSow(next, nowIso, from);
    next = again.garden;
    effects.push(...again.effects);
  }
  return { garden: next, effects };
}

/** Gather every ripe plant into the barn. */
export function harvest(garden: UbiGarden, today: LocalDate): { garden: UbiGarden; effects: GameEffect[]; count: number; festival: Festival | null } {
  const ripe = garden.plants.filter((p) => p.stage >= 4);
  if (ripe.length === 0) return { garden, effects: [], count: 0, festival: null };
  const festival = festivalOn(today) === "iri-ji" ? "iri-ji" : null;
  const yieldEach = festival ? UBI.festivalYield : 1;
  const crops: Partial<Record<PlantKind, number>> = {};
  const barn = { ...garden.barn };
  for (const p of ripe) {
    crops[p.kind] = (crops[p.kind] ?? 0) + yieldEach;
    barn[p.kind] = (barn[p.kind] ?? 0) + yieldEach;
  }
  return {
    garden: { ...garden, plants: garden.plants.filter((p) => p.stage < 4), barn },
    effects: [{ kind: "harvest", crops, festival }],
    count: ripe.length,
    festival,
  };
}

/** `lastPractice` is the learner's last local practice day (resting is a local-calendar idea, not UTC). */
export function gardenView(garden: UbiGarden, today: LocalDate, lastPractice: LocalDate | null): GardenView {
  const plots: GardenView["plots"] = Array.from({ length: UBI.plots }, () => null);
  for (const p of garden.plants) {
    if (p.plot < 0 || p.plot >= UBI.plots) continue;
    plots[p.plot] = {
      id: p.id,
      kind: p.kind,
      stage: p.stage,
      plot: p.plot,
      progress: p.stage >= 4 ? 1 : Math.min(1, p.points / GROWTH_POINTS_PER_STAGE),
      ripe: p.stage >= 4,
    };
  }
  return {
    plots,
    growing: garden.plants.filter((p) => p.stage < 4).length,
    ripe: garden.plants.filter((p) => p.stage >= 4).length,
    barn: { ...garden.barn },
    resting: garden.plants.length > 0 && lastPractice !== null && daysBetween(lastPractice, today) >= UBI.restAfterDays,
    festival: festivalOn(today),
  };
}
