// Turning effects into moments. The UI celebrates one peak per flow
// (peak-end rule): `peakOf` picks it, `effectCopy` words it in English, and
// labels from approved content (crop, place and market-day names) can be
// passed in to name things in Igbo. Copy never uses GUILT_WORDS (tested).
import { achievementDef } from "./achievements";
import type { GameEffect, GardenView, IzuView, MarketDay, ObodoPlace, PlantKind, XpSource } from "./types";

export interface GameLabels {
  crops?: Partial<Record<PlantKind, string>>;
  places?: Partial<Record<ObodoPlace, string>>;
  marketDays?: Partial<Record<MarketDay, string>>;
}

export const CROP_NAMES_EN: Record<PlantKind, string> = {
  yam: "yam",
  cocoyam: "cocoyam",
  maize: "maize",
  okra: "okra",
  pepper: "pepper",
  "pumpkin-leaf": "pumpkin leaf",
  bitterleaf: "bitterleaf",
  "oil-palm": "oil palm",
};

export const PLACE_NAMES_EN: Record<ObodoPlace, string> = {
  home: "home",
  market: "market",
  farm: "farm",
  stream: "stream",
  "village-square": "village square",
  wedding: "wedding",
  homecoming: "homecoming",
};

/** Plant ids are `<kind>-<n>`. */
export function cropOfPlant(id: string): PlantKind {
  const kind = id.replace(/-\d+$/, "");
  return (kind in CROP_NAMES_EN ? kind : "yam") as PlantKind;
}

const crop = (k: PlantKind, l?: GameLabels) => l?.crops?.[k] ?? CROP_NAMES_EN[k];
const place = (p: ObodoPlace, l?: GameLabels) => l?.places?.[p] ?? PLACE_NAMES_EN[p];
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Peak priority: the first kind present wins (obodo stage 3 outranks its earlier stages). */
const ORDER: readonly string[] = [
  "izu-revived",
  "izu-repaired",
  "quest-complete",
  "welcome-back",
  "izu-kept",
  "obodo-3",
  "harvest",
  "achievement",
  "obodo",
  "collection",
  "plant-ripe",
  "quest-progress",
  "plant-grew",
  "plant-sown",
  "izu-repair-progress",
  "izu-repair-open",
  "izu-day",
  "izu-rested",
  "xp",
];

function rank(e: GameEffect): number {
  const key =
    e.kind === "obodo" && e.stage === 3 ? "obodo-3" : e.kind === "plant-grew" && e.stage === 4 ? "plant-ripe" : e.kind;
  const i = ORDER.indexOf(key);
  return i < 0 ? ORDER.length : i;
}

/** The one effect worth a moment (null when nothing happened). */
export function peakOf(effects: readonly GameEffect[]): GameEffect | null {
  let best: GameEffect | null = null;
  for (const e of effects) if (!best || rank(e) < rank(best)) best = e;
  return best;
}

/** XP earned across effects, by source. */
export function xpOf(effects: readonly GameEffect[]): { total: number; bySource: Partial<Record<XpSource, number>> } {
  const bySource: Partial<Record<XpSource, number>> = {};
  let total = 0;
  for (const e of effects) {
    if (e.kind !== "xp") continue;
    total += e.amount;
    bySource[e.source] = (bySource[e.source] ?? 0) + e.amount;
  }
  return { total, bySource };
}

/** English headline and line for an effect. */
export function effectCopy(e: GameEffect, labels?: GameLabels): { title: string; detail: string } {
  switch (e.kind) {
    case "xp":
      return { title: `+${e.amount} XP`, detail: "For the practice you just did." };
    case "izu-day":
      return { title: "Today counts", detail: labels?.marketDays?.[e.day] ? `${labels.marketDays[e.day]} is marked on your chain.` : "This market day is marked on your chain." };
    case "izu-kept":
      return e.length === 1
        ? { title: "Your chain holds", detail: "Your first market week is kept. Rest whenever you like." }
        : { title: "Your chain holds", detail: `${e.length} market weeks in a row. The fourth day is yours to rest.` };
    case "izu-repair-open":
      return { title: "Your chain is waiting", detail: "Three short lessons in the next two days carry it on." };
    case "izu-repair-progress":
      return { title: "Mending", detail: `${e.lessonsDone} of ${e.needed} lessons done.` };
    case "izu-repaired":
      return { title: "Mended", detail: `Your chain carries on: ${e.length} market weeks.` };
    case "izu-rested":
      return { title: "A fresh chain begins", detail: "Your last chain is resting. Every day you practise starts the next." };
    case "izu-revived":
      return { title: "Welcome home", detail: `Your chain of ${e.length} market weeks came back with you.` };
    case "plant-sown":
      return { title: "Something new is planted", detail: `A ${crop(e.crop, labels)} seed went into the ground.` };
    case "plant-grew": {
      const c = crop(cropOfPlant(e.plant), labels);
      return e.stage >= 4 ? { title: "Ready to harvest", detail: `Your ${c} is ripe.` } : { title: "Your garden grew", detail: `Your ${c} is a little taller.` };
    }
    case "harvest": {
      const n = Object.values(e.crops).reduce((a, b) => a + (b ?? 0), 0);
      return {
        title: e.festival === "iri-ji" ? "A New Yam harvest" : "Harvest",
        detail: e.festival === "iri-ji" ? `${n} crops gathered. The season doubled it.` : `${n} ${n === 1 ? "crop" : "crops"} gathered into your barn.`,
      };
    }
    case "collection":
      return e.entry.kind === "ilu"
        ? { title: "A proverb for your collection", detail: "Hear it from an elder any time." }
        : e.entry.kind === "aha"
          ? { title: "A name for your collection", detail: "Its meaning is yours to keep." }
          : { title: "A story chapter collected", detail: "Read it again whenever you like." };
    case "obodo": {
      const p = place(e.place, labels);
      if (e.stage === 3) return { title: `Your ${p} is whole again`, detail: "Another place in your hometown is alive." };
      if (e.stage === 2) return { title: `Your ${p} is coming back to life`, detail: "Keep going and it will be whole." };
      return { title: `Your ${p} is waking up`, detail: "Your words are bringing it back." };
    }
    case "quest-progress":
      return { title: "Together", detail: `Your cohort is ${e.percent}% of the way there.` };
    case "quest-complete":
      return { title: "Together, you did it", detail: "Your cohort reached this week's goal." };
    case "achievement": {
      const def = achievementDef(e.id);
      return { title: def?.title ?? "Something to remember", detail: def?.detail ?? "" };
    }
    case "welcome-back":
      return { title: "Welcome back", detail: "Your garden waited for you." };
  }
}

export { cap as capitalise };

const dayName = (d: MarketDay, l?: GameLabels) => l?.marketDays?.[d] ?? null;

/** The izu widget's status line: what is true now and what comes next, never what was lost. */
export function izuStatusCopy(v: IzuView, labels?: GameLabels): { title: string; detail: string } {
  if (v.repair) {
    const left = v.repair.needed - v.repair.lessonsDone;
    return {
      title: "Your chain is waiting",
      detail: `${left} short ${left === 1 ? "lesson" : "lessons"} mend it. ${v.repair.hoursLeft} ${v.repair.hoursLeft === 1 ? "hour" : "hours"} to go.`,
    };
  }
  if (v.revival && v.length === 0) {
    return { title: "Bring your chain home", detail: `Once a year, your chain of ${v.revival.length} market weeks can come back with you.` };
  }
  if (v.kept) {
    const rest = v.cells.find((c) => c.state === "rest");
    const name = rest ? dayName(rest.day, labels) : null;
    return {
      title: "This market week is kept",
      detail: rest ? (name ? `${name} is yours to rest.` : "The day left is yours to rest.") : "You practised on every day this week.",
    };
  }
  const left = v.needed - v.practised;
  if (v.practised === 0 && v.length === 0) {
    return { title: "Start a chain today", detail: `Practise on any ${v.needed} of the ${v.cells.length} market days.` };
  }
  if (left === 1) return { title: "One more market day keeps it", detail: "Any short lesson counts." };
  return { title: `${v.practised} of ${v.needed} market days`, detail: `Any ${v.needed} of the ${v.cells.length} days keep your chain.` };
}

/** The garden's status line. */
export function gardenStatusCopy(g: GardenView): { title: string; detail: string } {
  const planted = g.growing + g.ripe;
  if (planted === 0) return { title: "Ready for planting", detail: "Your first lesson plants the first seed." };
  if (g.resting) return { title: "Your garden waited for you", detail: "Nothing here wilts. A little practice and it grows again." };
  if (g.ripe > 0) return { title: g.ripe === 1 ? "One crop is ripe" : `${g.ripe} crops are ripe`, detail: g.growing > 0 ? `${g.growing} more growing. Gather when you like.` : "Gather when you like." };
  return { title: g.growing === 1 ? "One crop growing" : `${g.growing} crops growing`, detail: "Every practice tends them." };
}
