// Ubi crops, drawn procedurally. Each crop has its own growth habit, true
// to an Igbo farm: ji (yam) climbs a stake from its heap, ede (cocoyam)
// opens broad heart leaves, ugu (fluted pumpkin) trails and curls its
// tendrils, ọka (maize) stands tall with arching straps. Stage 0 is a seed
// in the earth, 4 is ripe with its harvest showing. Deterministic per seed;
// nothing here ever draws a wilted or dying plant.
//
// Artboard: PLANT_BOX wide × tall, the ground line at PLANT_GROUND.
import type { GrowthStage, PlantKind } from "@/lib/game/types";
import { rng, smoothPath, type Pt } from "../geometry";
import { circle, curl, dots, ellipse, heartLeaf, lanceLeaf, line, midrib, mound, strapLeaf, type ArtShape } from "./shapes";

export const PLANT_BOX = { w: 100, h: 120 } as const;
export const PLANT_GROUND = 106;
const CX = 50;
const G = PLANT_GROUND;

const LEAF: Pick<ArtShape, "fill" | "stroke" | "width" | "fillOpacity"> = { fill: "green", stroke: "line", width: 1.1, fillOpacity: 0.92 };
const RIPE_LEAF: Pick<ArtShape, "fill" | "stroke" | "width" | "fillOpacity"> = { fill: "ochre", stroke: "line", width: 1.1, fillOpacity: 0.9 };
const STEM: Pick<ArtShape, "stroke" | "width"> = { stroke: "green", width: 2.2 };
const VEIN: Pick<ArtShape, "stroke" | "width" | "opacity"> = { stroke: "chalk", width: 0.9, opacity: 0.55 };
const EARTH: Pick<ArtShape, "fill" | "stroke" | "width"> = { fill: "paperDeep", stroke: "line", width: 1.3 };

function jitter(seed: number) {
  const r = rng(seed);
  return (spread: number) => (r() - 0.5) * 2 * spread;
}

function leafWithVein(d: string, vein: string, ripe = false): ArtShape[] {
  return [{ d, ...(ripe ? RIPE_LEAF : LEAF) }, { d: vein, ...VEIN }];
}

/** The seed: a heap of earth with the seed showing. */
function seedStage(heapW: number, heapH: number): ArtShape[] {
  return [
    { d: mound(CX, G, heapW, heapH), ...EARTH },
    { d: ellipse(CX, G - heapH * 0.92, 3.6, 2.4), fill: "ochre", stroke: "line", width: 1 },
    { d: curl({ x: CX + 4, y: G - heapH * 0.95 }, 3, 1.1, -1, -30), stroke: "line", width: 1, opacity: 0.6 },
  ];
}

function yam(stage: GrowthStage, j: (n: number) => number): ArtShape[] {
  const heapW = 62;
  const heapH = 16;
  if (stage === 0) return seedStage(heapW, heapH);
  const out: ArtShape[] = [];
  const top = G - heapH;
  const stakeTop = [0, 66, 30, 8, 8][stage] as number;
  const vineTop = [0, top - 14, 50, 16, 16][stage] as number;
  out.push({ d: `M${CX - 1} ${G - 4} L${CX + 1.5} ${stakeTop}`, stroke: "line", width: 2.2, opacity: stage === 1 ? 0.4 : 0.62 });
  // The vine twines up the stake …
  const pts: Pt[] = [];
  const turns = stage === 1 ? 0.5 : stage === 2 ? 1.5 : 2.6;
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: CX + Math.sin(t * turns * Math.PI * 2) * (5 + 2 * t), y: top - (top - vineTop) * t });
  }
  out.push({ d: smoothPath(pts), ...STEM });
  // … and hangs heart leaves out on short stalks, alternating sides.
  const leaves = stage === 1 ? 1 : stage === 2 ? 4 : 8;
  for (let k = 0; k < leaves; k++) {
    const t = leaves === 1 ? 0.9 : 0.12 + (k / (leaves - 1)) * 0.84;
    const at = pts[Math.round(t * n)] as Pt;
    const side = k % 2 === 0 ? -1 : 1;
    const reach = 6 + (k % 3) * 2;
    const base = { x: at.x + side * reach, y: at.y + 2 };
    out.push({ d: smoothPath([at, { x: at.x + side * reach * 0.6, y: at.y - 1.5 }, base]), ...STEM, width: 1.3 });
    const ang = (side < 0 ? 165 : 15) + j(12) + (k > 4 ? side * -8 : 0);
    const len = (stage === 1 ? 13 : 15 - (k / leaves) * 3) + j(1.5);
    const ripe = stage === 4 && (k === 2 || k === 5);
    out.push(...leafWithVein(heartLeaf(base, ang, len, len * 0.84), midrib(base, ang, len), ripe));
  }
  out.push({ d: mound(CX, G, heapW, heapH), ...EARTH });
  if (stage === 4) {
    out.push({ d: ellipse(CX - 17, G - 4, 11, 5.5), fill: "ochre", stroke: "line", width: 1.2 });
    out.push({ d: ellipse(CX + 15, G - 3, 9, 4.5), fill: "ochre", stroke: "line", width: 1.2 });
    out.push({ d: dots([{ x: CX - 20, y: G - 5 }, { x: CX - 13, y: G - 3 }, { x: CX + 13, y: G - 4 }], 0.9), fill: "line", opacity: 0.6 });
  }
  return out;
}

function cocoyam(stage: GrowthStage, j: (n: number) => number): ArtShape[] {
  const heapW = 48;
  const heapH = 10;
  if (stage === 0) return seedStage(heapW, heapH);
  const out: ArtShape[] = [];
  const base = { x: CX, y: G - heapH + 2 };
  // Petioles fan from the base; a broad blade hangs from each tip.
  const plan: { ang: number; len: number; blade: number; tilt: number }[][] = [
    [],
    [{ ang: -90, len: 16, blade: 14, tilt: -100 }],
    [
      { ang: -118, len: 30, blade: 22, tilt: 185 },
      { ang: -64, len: 34, blade: 24, tilt: -5 },
    ],
    [
      { ang: -132, len: 36, blade: 25, tilt: 178 },
      { ang: -100, len: 56, blade: 27, tilt: 215 },
      { ang: -72, len: 50, blade: 28, tilt: -28 },
      { ang: -44, len: 32, blade: 24, tilt: 6 },
    ],
    [
      { ang: -132, len: 36, blade: 25, tilt: 178 },
      { ang: -100, len: 56, blade: 27, tilt: 215 },
      { ang: -72, len: 50, blade: 28, tilt: -28 },
      { ang: -44, len: 32, blade: 24, tilt: 6 },
    ],
  ];
  for (const p of plan[stage] ?? []) {
    const a = ((p.ang + j(5)) * Math.PI) / 180;
    const tip = { x: base.x + Math.cos(a) * p.len, y: base.y + Math.sin(a) * p.len };
    const mid = { x: base.x + Math.cos(a) * p.len * 0.5 + j(2), y: base.y + Math.sin(a) * p.len * 0.5 };
    out.push({ d: smoothPath([base, mid, tip]), ...STEM });
    const tilt = p.tilt + j(8);
    out.push(...leafWithVein(heartLeaf(tip, tilt, p.blade, p.blade * 0.92, 0.26), midrib(tip, tilt, p.blade)));
  }
  out.push({ d: mound(CX, G, heapW, heapH), ...EARTH });
  if (stage === 4) {
    out.push({ d: circle(CX - 12, G - 4, 6), fill: "ochre", stroke: "line", width: 1.2 });
    out.push({ d: circle(CX + 1, G - 3, 5), fill: "ochre", stroke: "line", width: 1.2 });
    out.push({ d: circle(CX + 13, G - 4, 6.5), fill: "ochre", stroke: "line", width: 1.2 });
  }
  return out;
}

/** Three leaflets from one point: the ugu leaf. */
function trifoliate(at: Pt, ang: number, len: number): ArtShape[] {
  const out: ArtShape[] = [];
  for (const da of [-38, 0, 38]) {
    const l = da === 0 ? len : len * 0.82;
    out.push(...leafWithVein(lanceLeaf(at, ang + da, l, l * 0.46), midrib(at, ang + da, l)));
  }
  return out;
}

function ugu(stage: GrowthStage, j: (n: number) => number): ArtShape[] {
  const heapW = 44;
  const heapH = 9;
  if (stage === 0) return seedStage(heapW, heapH);
  const out: ArtShape[] = [];
  const base = { x: CX - 4, y: G - heapH + 1 };
  if (stage === 1) {
    const tip = { x: base.x + 2, y: base.y - 12 };
    out.push({ d: smoothPath([base, tip]), ...STEM });
    out.push(...leafWithVein(lanceLeaf(tip, -150 + j(6), 11, 6), midrib(tip, -150, 11)));
    out.push(...leafWithVein(lanceLeaf(tip, -30 + j(6), 11, 6), midrib(tip, -30, 11)));
  } else {
    // A low A-frame of sticks the vine climbs over, then trails along.
    const h = stage === 2 ? 44 : 78;
    if (stage >= 3) {
      out.push({ d: line({ x: CX - 26, y: G }, { x: CX - 2, y: G - h }), stroke: "line", width: 1.8, opacity: 0.6 });
      out.push({ d: line({ x: CX + 26, y: G }, { x: CX + 2, y: G - h }), stroke: "line", width: 1.8, opacity: 0.6 });
    }
    const vine: Pt[] =
      stage === 2
        ? [base, { x: CX - 12, y: G - 20 }, { x: CX - 2, y: G - 34 }, { x: CX + 12, y: G - 40 }, { x: CX + 22, y: G - 30 }]
        : [base, { x: CX - 14, y: G - 30 }, { x: CX - 4, y: G - 56 }, { x: CX + 2, y: G - h + 2 }, { x: CX + 16, y: G - 60 }, { x: CX + 28, y: G - 44 }, { x: CX + 36, y: G - 26 }];
    out.push({ d: smoothPath(vine), ...STEM });
    const leafAt = stage === 2 ? [1, 3] : [1, 2, 4, 5];
    leafAt.forEach((i, k) => {
      const at = vine[i] as Pt;
      const ang = (k % 2 === 0 ? -150 : -30) + j(10);
      out.push(...trifoliate(at, ang, (stage === 2 ? 15 : 19) + j(1.5)));
    });
    // Tendrils: the uli curl, grown by the plant itself.
    const tendrils = stage === 2 ? [vine[4] as Pt] : [vine[3] as Pt, vine[6] as Pt];
    tendrils.forEach((t, k) => out.push({ d: curl({ x: t.x + 1, y: t.y }, 4.5, 1.6, k % 2 === 0 ? 1 : -1, 200), stroke: "green", width: 1.2 }));
  }
  out.push({ d: mound(CX - 4, G, heapW, heapH), ...EARTH });
  if (stage === 4) {
    // The fluted gourd resting on the earth.
    const gx = CX + 20;
    const gy = G - 9;
    out.push({ d: ellipse(gx, gy, 15, 9.5), fill: "green", stroke: "line", width: 1.3, fillOpacity: 0.75 });
    for (const dy of [-5, 0, 5]) out.push({ d: `M${gx - 13} ${gy + dy * 0.4} Q${gx} ${gy + dy * 1.25} ${gx + 13} ${gy + dy * 0.4}`, stroke: "chalk", width: 1.1, opacity: 0.8 });
    out.push({ d: `M${gx - 14} ${gy - 2} q-3 -4 -1 -7`, stroke: "line", width: 1.4 });
  }
  return out;
}

function maize(stage: GrowthStage, j: (n: number) => number): ArtShape[] {
  const heapW = 40;
  const heapH = 8;
  if (stage === 0) return seedStage(heapW, heapH);
  const out: ArtShape[] = [];
  const top = [0, G - 26, G - 58, 14, 10][stage] as number;
  const sway = j(2);
  const stalk: Pt[] = [
    { x: CX, y: G - heapH + 1 },
    { x: CX + sway * 0.5, y: (G + top) / 2 },
    { x: CX + sway, y: top },
  ];
  out.push({ d: smoothPath(stalk), stroke: "green", width: stage >= 3 ? 3.2 : 2.4 });
  const leaves = stage === 1 ? 2 : stage === 2 ? 4 : 6;
  for (let k = 0; k < leaves; k++) {
    const t = 0.18 + (k / leaves) * 0.72;
    const at = { x: CX + sway * t, y: G - heapH - (G - heapH - top) * t };
    const left = k % 2 === 0;
    const len = (stage === 1 ? 16 : 30 - k * 2.2) + j(2);
    const ang = (left ? -150 : -30) + j(6);
    out.push({ d: strapLeaf(at, ang, len, stage === 1 ? 5 : 7, 9 + k), ...LEAF });
  }
  if (stage >= 3) {
    // Tassel: a little fan of ochre strokes, never a sunburst.
    const tx = CX + sway;
    for (const da of [-26, -10, 8, 24]) {
      const a = ((da - 90) * Math.PI) / 180;
      out.push({ d: `M${tx} ${top + 2} q${Math.cos(a) * 4} ${Math.sin(a) * 6} ${Math.cos(a) * 9} ${Math.sin(a) * 10}`, stroke: stage === 4 ? "ochre" : "line", width: 1.4, opacity: stage === 4 ? 1 : 0.55 });
    }
  }
  if (stage === 4) {
    // The cob in its husk, leaning off the stalk.
    const cob = { x: CX + 9, y: G - 56 };
    out.push({ d: lanceLeaf({ x: CX + 1, y: G - 44 }, -62, 30, 13), fill: "ochre", stroke: "line", width: 1.2 });
    out.push({
      d: dots(
        [0, 1, 2, 3, 4].flatMap((i) => [
          { x: cob.x - 2 + i * 1.3, y: cob.y + 8 - i * 4.6 },
          { x: cob.x + 2 + i * 1.3, y: cob.y + 9 - i * 4.6 },
        ]),
        1
      ),
      fill: "chalk",
      opacity: 0.75,
    });
    out.push({ d: lanceLeaf({ x: CX + 1, y: G - 42 }, -78, 22, 8), ...LEAF });
  }
  out.push({ d: mound(CX, G, heapW, heapH), ...EARTH });
  return out;
}

/** The shapes of one plant, in paint order. */
export function plantShapes(kind: PlantKind, stage: GrowthStage, seed: number): ArtShape[] {
  const j = jitter(seed);
  switch (kind) {
    case "yam":
      return yam(stage, j);
    case "cocoyam":
      return cocoyam(stage, j);
    case "pumpkin-leaf":
      return ugu(stage, j);
    case "maize":
      return maize(stage, j);
    default:
      // Other crops (future content) grow like ede until they have their own habit.
      return cocoyam(stage, j);
  }
}

/** An empty plot: a waiting ring of earth (never a bare hole). */
export function emptyPlot(): ArtShape[] {
  return [
    { d: ellipse(CX, G - 2, 20, 5), fill: "paperDeep", fillOpacity: 0.7 },
    { d: ellipse(CX, G - 2, 20, 5), stroke: "line", width: 1, opacity: 0.35, dash: "2 3" },
  ];
}
