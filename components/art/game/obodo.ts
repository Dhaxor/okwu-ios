// Obodo, the hometown, as seven small line drawings in the uli manner:
// ink outlines, earth washes, and a little life once a place is whole.
//   stage 0  a faint dashed sketch: still to come
//   stage 1  the outlines are drawn in ink
//   stage 2  colour arrives: earth, ochre, camwood, leaf
//   stage 3  it comes alive: smoke from the kitchen, produce in the
//            baskets, ripples on the stream, bunting at the wedding
// Original work. Never drawn: masquerades, shrines or deities, sacred
// nsibidi, title regalia, political symbols (no rising suns or rays).
//
// Artboard: VIGNETTE wide × tall, the ground line near the bottom.
import type { ObodoPlace } from "@/lib/game/types";
import { rng, smoothPath, spiralPath, type Pt } from "../geometry";
import { circle, curl, dots, ellipse, heartLeaf, line, mound, poly, rect, strapLeaf, type ArtShape } from "./shapes";

export const VIGNETTE = { w: 120, h: 90 } as const;

export interface PlaceArt {
  /** Ink outlines (stage ≥ 1; the dashed sketch at stage 0). */
  base: ArtShape[];
  /** Colour washes (stage ≥ 2), painted under the outlines. */
  fills: ArtShape[];
  /** Life details (stage 3), on their own layer so they can breathe. */
  life: ArtShape[];
}

const INK: Pick<ArtShape, "stroke" | "width"> = { stroke: "line", width: 1.5 };
const THIN: Pick<ArtShape, "stroke" | "width"> = { stroke: "line", width: 1.1 };

function home(): PlaceArt {
  const roof = poly([{ x: 28, y: 50 }, { x: 45, y: 29 }, { x: 77, y: 29 }, { x: 94, y: 50 }]);
  const thatch = [36, 44, 52, 60, 68, 76, 84].map((x) => line({ x: x + (x - 61) * 0.1, y: 31 }, { x: x + (x - 61) * 0.45, y: 49 }));
  const uliBand = Array.from({ length: 8 }, (_, i) => ({ x: 39 + i * 6.2, y: 53.5 }));
  return {
    fills: [
      { d: rect(6, 68, 24, 12, 1.5), fill: "paperDeep" },
      { d: rect(92, 68, 22, 12, 1.5), fill: "paperDeep" },
      { d: rect(35, 49, 52, 31), fill: "chalk" },
      { d: roof, fill: "ochreLight" },
      { d: rect(55, 61, 12, 19, 2), fill: "line", fillOpacity: 0.85 },
      { d: circle(17, 38, 12.5), fill: "green", fillOpacity: 0.85 },
    ],
    base: [
      { d: rect(6, 68, 24, 12, 1.5), ...THIN },
      { d: rect(92, 68, 22, 12, 1.5), ...THIN },
      { d: line({ x: 17, y: 80 }, { x: 17, y: 49 }), ...INK },
      { d: circle(17, 38, 12.5), ...INK },
      { d: spiralPath(17, 38, 6, 1.5, 0, 1), ...THIN, opacity: 0.7 },
      { d: rect(35, 49, 52, 31), ...INK },
      { d: roof, ...INK },
      ...thatch.map((d) => ({ d, stroke: "ochre" as const, width: 1, opacity: 0.9 })),
      { d: rect(55, 61, 12, 19, 2), ...INK },
      { d: rect(40, 58, 9, 9, 1), ...THIN },
      { d: rect(73, 58, 9, 9, 1), ...THIN },
      { d: dots(uliBand, 1.15), fill: "red" },
    ],
    life: [
      { d: smoothPath([{ x: 84, y: 34 }, { x: 88, y: 26 }, { x: 84, y: 18 }, { x: 89, y: 9 }]), stroke: "line", width: 1.4, opacity: 0.4 },
      { d: curl({ x: 89, y: 9 }, 3.5, 1.3, 1, -90), stroke: "line", width: 1.2, opacity: 0.4 },
      { d: rect(40, 58, 9, 9, 1), fill: "ochreLight" },
      { d: rect(73, 58, 9, 9, 1), fill: "ochreLight" },
      { d: dots([{ x: 47, y: 79 }, { x: 51, y: 77.5 }, { x: 72, y: 78.5 }, { x: 76, y: 77 }], 1.6), fill: "red" },
    ],
  };
}

function market(): PlaceArt {
  const awnA = poly([{ x: 31, y: 52 }, { x: 69, y: 52 }, { x: 64, y: 41 }, { x: 36, y: 41 }]);
  const awnB = poly([{ x: 72, y: 55 }, { x: 112, y: 55 }, { x: 107, y: 44 }, { x: 77, y: 44 }]);
  const basket = (x: number, y: number) => poly([{ x: x - 6, y: y - 5 }, { x: x + 6, y: y - 5 }, { x: x + 4.5, y }, { x: x - 4.5, y }]);
  const baskets = [basket(42, 64), basket(57, 64), basket(84, 67), basket(99, 67)];
  const heap = (x: number, y: number) => [
    { x: x - 3, y: y - 6.5 },
    { x: x, y: y - 6.8 },
    { x: x + 3, y: y - 6.5 },
    { x: x - 1.5, y: y - 9 },
    { x: x + 1.5, y: y - 9 },
  ];
  return {
    fills: [
      { d: circle(15, 35, 14), fill: "green", fillOpacity: 0.85 },
      { d: awnA, fill: "red" },
      { d: awnB, fill: "ochre" },
      { d: rect(33, 64, 34, 5, 1), fill: "paperDeep" },
      { d: rect(74, 67, 36, 5, 1), fill: "paperDeep" },
      ...baskets.map((d) => ({ d, fill: "ochreLight" as const })),
    ],
    base: [
      { d: line({ x: 15, y: 80 }, { x: 15, y: 47 }), ...INK },
      { d: circle(15, 35, 14), ...INK },
      { d: spiralPath(15, 35, 7, 1.6, 1, -1), ...THIN, opacity: 0.7 },
      { d: line({ x: 36, y: 80 }, { x: 36, y: 52 }), ...INK },
      { d: line({ x: 64, y: 80 }, { x: 64, y: 52 }), ...INK },
      { d: line({ x: 77, y: 80 }, { x: 77, y: 55 }), ...INK },
      { d: line({ x: 107, y: 80 }, { x: 107, y: 55 }), ...INK },
      { d: awnA, ...INK },
      { d: awnB, ...INK },
      { d: [44, 50, 56].map((x) => `M${x} 41.5 L${x - 1} 51.5`).join(" "), stroke: "chalk", width: 1.4, opacity: 0.85 },
      { d: [86, 92, 98].map((x) => `M${x} 44.5 L${x - 1} 54.5`).join(" "), stroke: "chalk", width: 1.4, opacity: 0.85 },
      { d: rect(33, 64, 34, 5, 1), ...THIN },
      { d: rect(74, 67, 36, 5, 1), ...THIN },
      ...baskets.map((d) => ({ d, ...THIN })),
    ],
    life: [
      { d: dots([...heap(42, 64), ...heap(84, 67)], 1.7), fill: "red" },
      { d: dots([...heap(57, 64), ...heap(99, 67)], 1.7), fill: "ochre" },
      { d: dots([{ x: 57, y: 55 }, { x: 99, y: 58 }], 1.6), fill: "green" },
      { d: smoothPath([{ x: 22, y: 30 }, { x: 30, y: 36 }, { x: 36, y: 41 }]), stroke: "line", width: 0.9, opacity: 0.6 },
      { d: [poly([{ x: 25, y: 32.5 }, { x: 28.5, y: 34.5 }, { x: 25.5, y: 38 }]), poly([{ x: 31, y: 37 }, { x: 34.5, y: 39 }, { x: 31.5, y: 42.5 }])].join(" "), fill: "red" },
    ],
  };
}

function farm(): PlaceArt {
  const heaps = [
    { x: 34, y: 62, w: 22, h: 8 },
    { x: 60, y: 62, w: 22, h: 8 },
    { x: 86, y: 62, w: 22, h: 8 },
    { x: 22, y: 80, w: 25, h: 9 },
    { x: 50, y: 80, w: 25, h: 9 },
    { x: 78, y: 80, w: 25, h: 9 },
  ];
  const stakes = heaps.map((m) => ({ a: { x: m.x, y: m.y - m.h }, b: { x: m.x + 1.5, y: m.y - m.h - (m.y > 70 ? 24 : 20) } }));
  const leaves: ArtShape[] = [];
  stakes.forEach((s, i) => {
    const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
    leaves.push({ d: smoothPath([s.a, { x: s.a.x + 3, y: mid.y + 4 }, { x: s.b.x - 2, y: mid.y - 3 }, s.b]), stroke: "green", width: 1.3 });
    leaves.push({ d: heartLeaf({ x: mid.x - 2, y: mid.y + 2 }, 165, 7, 6), fill: "green", stroke: "line", width: 0.8 });
    leaves.push({ d: heartLeaf({ x: mid.x + 2, y: mid.y - 4 }, 15 - i * 2, 7, 6), fill: "green", stroke: "line", width: 0.8 });
  });
  return {
    fills: heaps.map((m) => ({ d: mound(m.x, m.y, m.w, m.h), fill: "paperDeep" as const })),
    base: [
      ...stakes.map((s) => ({ d: line(s.a, s.b), stroke: "line" as const, width: 1.3, opacity: 0.8 })),
      ...heaps.map((m) => ({ d: mound(m.x, m.y, m.w, m.h), ...THIN })),
      { d: line({ x: 106, y: 80 }, { x: 106, y: 34 }), stroke: "green", width: 2 },
      { d: line({ x: 4, y: 70 }, { x: 116, y: 70 }), stroke: "line", width: 0.9, opacity: 0.25, dash: "1.5 4" },
    ],
    life: [
      ...leaves,
      { d: strapLeaf({ x: 106, y: 66 }, -150, 14, 4, 6), fill: "green", stroke: "line", width: 0.8 },
      { d: strapLeaf({ x: 106, y: 56 }, -30, 14, 4, 6), fill: "green", stroke: "line", width: 0.8 },
      { d: strapLeaf({ x: 106, y: 46 }, -150, 12, 4, 5), fill: "green", stroke: "line", width: 0.8 },
      { d: ellipse(109, 52, 2.2, 5), fill: "ochre", stroke: "line", width: 0.8 },
      { d: [-20, 0, 20].map((da) => `M106 34 l${Math.sin((da * Math.PI) / 180) * 5} -6`).join(" "), stroke: "ochre", width: 1.2 },
    ],
  };
}

function stream(): PlaceArt {
  const top = "M4 52 C26 45 48 57 72 51 C92 46 104 48 116 53";
  const bottom = "M116 75 C100 71 86 79 66 75 C44 70 24 79 4 74";
  const water = `${top} L116 75 ${bottom.replace("M116 75", "")} Z`;
  const pot = "M93 34 L103 34 L102 36.5 C108 39 108 47 103 49 L93 49 C88 47 88 39 94 36.5 Z";
  const stones = [ellipse(42, 63, 6, 3), ellipse(58, 66, 6, 3), ellipse(74, 62, 6, 3)];
  return {
    fills: [
      { d: water, fill: "line", fillOpacity: 0.11 },
      ...stones.map((d) => ({ d, fill: "paperDeep" as const })),
      { d: pot, fill: "red" },
    ],
    base: [
      { d: top, ...INK },
      { d: bottom, ...INK },
      { d: "M30 58 q5 -2.5 10 0 t10 0 M76 70 q5 -2.5 10 0 t10 0 M92 56 q4 -2 8 0", stroke: "line", width: 1, opacity: 0.35 },
      ...stones.map((d) => ({ d, ...THIN })),
      { d: pot, ...THIN },
      { d: [line({ x: 10, y: 50 }, { x: 8, y: 36 }), line({ x: 14, y: 49 }, { x: 15, y: 33 }), line({ x: 18, y: 48.5 }, { x: 21, y: 38 })].join(" "), stroke: "green", width: 1.4 },
      { d: [line({ x: 106, y: 76 }, { x: 108, y: 84 }), line({ x: 110, y: 75.5 }, { x: 113, y: 85 })].join(" "), stroke: "green", width: 1.4 },
    ],
    life: [
      { d: "M14 61 q5 -3 10 0 t10 0 M86 66 q5 -3 10 0 t10 0 M24 70 q4 -2.5 8 0 t8 0", stroke: "line", width: 1.1, opacity: 0.45 },
      { d: ellipse(58, 66, 10, 5), stroke: "line", width: 0.8, opacity: 0.3 },
      { d: ellipse(42, 63, 10, 5), stroke: "line", width: 0.8, opacity: 0.3 },
      { d: dots([{ x: 8, y: 35.5 }, { x: 15, y: 32.5 }, { x: 21, y: 37.5 }], 1.5), fill: "ochre" },
      { d: dots([{ x: 95, y: 41 }, { x: 98, y: 43 }, { x: 101, y: 41 }], 0.9), fill: "chalk" },
    ],
  };
}

function villageSquare(): PlaceArt {
  const canopy = [circle(47, 30, 14), circle(73, 30, 14), circle(60, 19, 16)];
  const benches = [rect(12, 69, 20, 5, 2.5), rect(88, 69, 20, 5, 2.5), rect(30, 79, 18, 4.5, 2.2), rect(72, 79, 18, 4.5, 2.2)];
  return {
    fills: [
      { d: ellipse(60, 74, 50, 10), fill: "paperDeep" },
      ...canopy.map((d) => ({ d, fill: "green" as const, fillOpacity: 0.85 })),
      ...benches.map((d) => ({ d, fill: "ochre" as const })),
    ],
    base: [
      { d: ellipse(60, 74, 50, 10), stroke: "line", width: 1, opacity: 0.5, dash: "2 3" },
      { d: "M57 72 C58 60 57 48 56 38 M63 72 C62 60 63 48 64 38 M57 72 C54 73 51 74 49 74 M63 72 C66 73 69 74 71 74", ...INK },
      ...canopy.map((d) => ({ d, ...INK })),
      { d: spiralPath(47, 30, 6, 1.4, 0, 1), ...THIN, opacity: 0.7 },
      { d: spiralPath(73, 30, 6, 1.4, 2, -1), ...THIN, opacity: 0.7 },
      { d: spiralPath(60, 18, 7, 1.6, 4, 1), ...THIN, opacity: 0.7 },
      ...benches.map((d) => ({ d, ...THIN })),
    ],
    life: [
      { d: "M36 36 Q60 46 84 36", stroke: "line", width: 0.8, opacity: 0.55 },
      { d: dots([{ x: 42, y: 39.5 }, { x: 51, y: 41.6 }, { x: 60, y: 42 }, { x: 69, y: 41.6 }, { x: 78, y: 39.5 }], 2), fill: "ochre" },
      { d: rect(50, 75, 20, 5, 1), fill: "red" },
      { d: "M51 77.5 l2.5 -2 l2.5 2 l2.5 -2 l2.5 2 l2.5 -2 l2.5 2 l2.5 -2", stroke: "chalk", width: 0.9 },
    ],
  };
}

function wedding(): PlaceArt {
  const roof = poly([{ x: 16, y: 41 }, { x: 60, y: 22 }, { x: 104, y: 41 }]);
  let valance = "M16 41";
  for (let i = 0; i < 8; i++) valance += ` q5.5 7 11 0`;
  valance += " Z";
  const chair = (x: number, y: number) => `M${x} ${y} L${x} ${y - 9} M${x} ${y - 4} L${x + 6} ${y - 4} L${x + 6} ${y}`;
  const chairs = [30, 44, 70, 84].flatMap((x) => [chair(x, 73), chair(x + 2, 82)]);
  const bunting = "M2 14 Q60 30 118 14";
  const flags: Pt[] = [];
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    flags.push({ x: 2 + 116 * t, y: 14 + 32 * t * (1 - t) });
  }
  return {
    fills: [
      { d: roof, fill: "chalk" },
      { d: valance, fill: "red" },
      { d: rect(48, 56, 24, 5, 1), fill: "paperDeep" },
      { d: "M56 56 A4 4 0 0 1 64 56 Z", fill: "ochre" },
      ...chairs.map((d) => ({ d, stroke: "ochre" as const, width: 2.4, opacity: 0.7 })),
    ],
    base: [
      { d: roof, ...INK },
      { d: valance, ...THIN },
      { d: "M38 33 L60 26 L82 33", stroke: "ochre", width: 1.2 },
      { d: line({ x: 20, y: 46 }, { x: 20, y: 82 }), ...INK },
      { d: line({ x: 100, y: 46 }, { x: 100, y: 82 }), ...INK },
      { d: rect(48, 56, 24, 5, 1), ...THIN },
      { d: "M56 56 A4 4 0 0 1 64 56 Z", ...THIN },
      ...chairs.map((d) => ({ d, ...THIN })),
    ],
    life: [
      { d: bunting, stroke: "line", width: 0.8, opacity: 0.6 },
      ...flags.map((p, i) => ({
        d: poly([{ x: p.x - 3.2, y: p.y }, { x: p.x + 3.2, y: p.y }, { x: p.x, y: p.y + 6 }]),
        fill: (["red", "ochre", "green"] as const)[i % 3],
      })),
    ],
  };
}

function homecoming(): PlaceArt {
  const road = "M54 2 C50 30 38 56 20 88 L100 88 C82 56 70 30 66 2 Z";
  const arch = "M20 44 Q60 14 100 44 L100 36 Q60 6 20 36 Z";
  const lights: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = 20 + 80 * t;
    lights.push({ x, y: 36 - 30 * 2 * t * (1 - t) * 0.98 - 2.5 });
  }
  const car = "M47 74 L49 67 Q50 64 53 64 L67 64 Q70 64 71 67 L73 74 Z";
  return {
    fills: [
      { d: road, fill: "paperDeep" },
      { d: rect(16, 36, 8, 46, 1), fill: "ochreLight" },
      { d: rect(96, 36, 8, 46, 1), fill: "ochreLight" },
      { d: arch, fill: "red" },
      { d: car, fill: "ochre" },
      { d: rect(45, 73, 30, 6, 2), fill: "ochre" },
    ],
    base: [
      { d: "M54 2 C50 30 38 56 20 88", ...THIN },
      { d: "M66 2 C70 30 82 56 100 88", ...THIN },
      { d: "M60 8 L60 14 M59.6 24 L59.4 32 M59 44 L58.8 54", stroke: "line", width: 1, opacity: 0.4 },
      { d: rect(16, 36, 8, 46, 1), ...INK },
      { d: rect(96, 36, 8, 46, 1), ...INK },
      { d: arch, ...INK },
      { d: dots([{ x: 40, y: 30.5 }, { x: 60, y: 26 }, { x: 80, y: 30.5 }], 1.3), fill: "chalk" },
      { d: car, ...THIN },
      { d: rect(45, 73, 30, 6, 2), ...THIN },
      { d: "M53 66 L67 66 L69 71 L51 71 Z", fill: "chalk", stroke: "line", width: 0.8 },
      { d: [circle(51, 80, 3), circle(69, 80, 3)].join(" "), fill: "line" },
    ],
    life: [
      { d: smoothPath(lights), stroke: "line", width: 0.7, opacity: 0.5 },
      { d: dots(lights.filter((_, i) => i % 2 === 0), 1.9), fill: "ochre" },
      { d: dots(lights.filter((_, i) => i % 2 === 1), 1.6), fill: "chalk" },
      { d: dots([{ x: 47.5, y: 76 }, { x: 72.5, y: 76 }], 1.4), fill: "chalk" },
    ],
  };
}

const BUILDERS: Record<ObodoPlace, () => PlaceArt> = {
  home,
  market,
  farm,
  stream,
  "village-square": villageSquare,
  wedding,
  homecoming,
};

const cache = new Map<ObodoPlace, PlaceArt>();

export function placeArt(place: ObodoPlace): PlaceArt {
  let art = cache.get(place);
  if (!art) {
    art = BUILDERS[place]();
    cache.set(place, art);
  }
  return art;
}

/** Where each place sits on the map (centre, as fractions of the map), in restoration order from the bottom up. */
export const MAP_LAYOUT: Record<ObodoPlace, { x: number; y: number }> = {
  home: { x: 0.28, y: 0.844 },
  market: { x: 0.72, y: 0.72 },
  farm: { x: 0.28, y: 0.596 },
  stream: { x: 0.72, y: 0.472 },
  "village-square": { x: 0.28, y: 0.348 },
  wedding: { x: 0.72, y: 0.224 },
  homecoming: { x: 0.28, y: 0.1 },
};

/** Map height for a width. */
export const MAP_ASPECT = 1.72;

/** Width of a vignette as a share of the map width. */
export const VIGNETTE_SHARE = 0.44;

/** Quiet scenery between the places: small trees and grass marks, deterministic for a size. */
export function mapScenery(w: number, h: number, seed = 11): ArtShape[] {
  const r = rng(seed);
  const out: ArtShape[] = [];
  const vw = w * VIGNETTE_SHARE;
  const vh = (vw * VIGNETTE.h) / VIGNETTE.w;
  const clear = (x: number, y: number) =>
    Object.values(MAP_LAYOUT).every((p) => Math.abs(x - p.x * w) > vw * 0.55 || Math.abs(y - p.y * h) > vh * 0.75);
  for (let i = 0; i < 70 && out.length < 26; i++) {
    const x = (0.04 + r() * 0.92) * w;
    const y = (0.04 + r() * 0.92) * h;
    if (!clear(x, y)) continue;
    if (r() < 0.4) {
      // A low bush: a mound of leaf with an uli curl inside.
      const s = 5 + r() * 4;
      out.push({ d: `M${x - s} ${y} C${x - s} ${y - s * 1.2} ${x + s} ${y - s * 1.2} ${x + s} ${y} Z`, fill: "green", fillOpacity: 0.16, stroke: "green", width: 1, opacity: 0.55 });
      out.push({ d: curl({ x: x + s * 0.2, y: y - s * 0.35 }, s * 0.32, 1.2, r() < 0.5 ? 1 : -1, 0), stroke: "green", width: 0.9, opacity: 0.45 });
    } else if (r() < 0.5) {
      out.push({ d: dots([{ x, y }, { x: x + 5, y: y - 2 }, { x: x + 9, y: y + 1 }], 1.1), fill: "ochre", opacity: 0.5 });
    } else {
      out.push({ d: `M${x - 3} ${y} q1.5 -4 3 -5 M${x} ${y} q0 -4 1.5 -6 M${x + 3} ${y} q-1 -4 -0.5 -5`, stroke: "green", width: 1, opacity: 0.35 });
    }
  }
  return out;
}
