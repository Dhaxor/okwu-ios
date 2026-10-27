// Pure geometry for the library's culture art (artGeometry.test.ts).
// Original procedural line work in the vocabulary of uli painting (single
// strokes, spirals, dots, crescents, open space) and akwete weaving
// (lozenges, teeth, stepped bands): yam, a calabash, kola lobes, market
// beads, a road home, stepped honour lozenges, dawn arcs, a word spiral, a
// ring of people, and abstract shapes for the tales (feathers, a patched
// shell, a vine, kites, scattered dust). Nothing traces an artwork, and
// nothing draws a mask, a masquerade, a deity, a shrine, nsibidi, regalia or
// a political symbol. Deterministic for a seed, so screenshots are stable.
import { rng, spiralPoints, type Pt } from "@/components/art/geometry";
import type { CultureMotif } from "@/lib/library/types";

/** The pigments a shape may use (resolved to artInk in the component). */
export type Ink = "line" | "red" | "ochre" | "ochreLight" | "chalk" | "sunk";

export type ArtShape =
  | { kind: "path"; pts: Pt[]; closed?: boolean; smooth?: boolean; stroke?: Ink; fill?: Ink; width?: number; opacity?: number }
  | { kind: "dot"; x: number; y: number; r: number; fill?: Ink; stroke?: Ink; width?: number; opacity?: number };

/** The art is drawn in this box and scaled to fit. */
export const ART_W = 200;
export const ART_H = 120;

const TAU = Math.PI * 2;
const pt = (x: number, y: number): Pt => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });

/** A closed blob around (cx, cy): an ellipse with a little seeded wobble. */
function blob(cx: number, cy: number, rx: number, ry: number, rot: number, wobble: number, rand: () => number, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + (rand() - 0.5) * wobble;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    out.push(pt(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)));
  }
  return out;
}

/** An arc of points. */
function arc(cx: number, cy: number, r: number, from: number, to: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  });
}

/** A lozenge (an akwete diamond). */
const lozenge = (cx: number, cy: number, rx: number, ry: number): Pt[] => [pt(cx, cy - ry), pt(cx + rx, cy), pt(cx, cy + ry), pt(cx - rx, cy)];

/** A few quiet uli dots scattered in the open space (never over the subject). */
function airDots(rand: () => number, avoid: (p: Pt) => boolean, n: number, ink: Ink = "line"): ArtShape[] {
  const out: ArtShape[] = [];
  for (let tries = 0; out.length < n && tries < n * 30; tries++) {
    const p = pt(8 + rand() * (ART_W - 16), 8 + rand() * (ART_H - 16));
    if (avoid(p)) continue;
    out.push({ kind: "dot", x: p.x, y: p.y, r: 1.2 + rand() * 1.4, fill: out.length % 4 === 0 ? "red" : ink, opacity: 0.55 });
  }
  return out;
}

const near = (cx: number, cy: number, r: number) => (p: Pt) => Math.hypot(p.x - cx, p.y - cy) < r;

function yam(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const tubers: [number, number, number, number][] = [
    [72, 66, 44, -0.35],
    [118, 70, 40, 0.28],
    [96, 50, 30, -0.05],
  ];
  for (const [cx, cy, len, rot] of tubers) {
    out.push({ kind: "path", pts: blob(cx, cy, len, 13, rot, 0.16, rand, 14), closed: true, smooth: true, fill: "ochreLight", stroke: "line", width: 1.6 });
    // Root hairs: short ticks along the skin.
    for (let i = 0; i < 5; i++) {
      const t = -0.7 + i * 0.35;
      const x = cx + Math.cos(rot) * len * t;
      const y = cy + Math.sin(rot) * len * t;
      out.push({ kind: "path", pts: [pt(x, y + 12), pt(x + 2, y + 17)], stroke: "line", width: 1, opacity: 0.6 });
    }
  }
  out.push({ kind: "dot", x: 150, y: 34, r: 3.4, fill: "red" });
  return [...out, ...airDots(rand, near(96, 62, 70), 9)];
}

function calabash(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  // The gourd: a round belly and a short neck, one closed stroke.
  const belly = arc(100, 72, 36, -1.1, Math.PI + 1.1, 30);
  const neck = [pt(84, 38), pt(88, 24), pt(100, 18), pt(112, 24), pt(116, 38)];
  out.push({ kind: "path", pts: [...belly, ...neck.slice(0)].reverse(), closed: true, smooth: true, fill: "ochreLight", stroke: "line", width: 1.8 });
  // A woven akwete band of teeth across the belly.
  const teeth: Pt[] = [];
  for (let i = 0; i <= 12; i++) teeth.push(pt(66 + i * 5.66, i % 2 ? 62 : 70));
  out.push({ kind: "path", pts: teeth, stroke: "red", width: 2 });
  out.push({ kind: "path", pts: [pt(66, 58), pt(134, 58)], stroke: "line", width: 1, opacity: 0.7 });
  out.push({ kind: "path", pts: [pt(66, 74), pt(134, 74)], stroke: "line", width: 1, opacity: 0.7 });
  out.push({ kind: "path", pts: spiralPoints(100, 90, 7, 1.6, 0, 1), stroke: "line", width: 1.4 });
  return [...out, ...airDots(rand, near(100, 64, 52), 8)];
}

function crescent(rand: () => number): ArtShape[] {
  const outer = arc(92, 60, 34, Math.PI * 0.35, Math.PI * 1.65, 28);
  const inner = arc(104, 56, 28, Math.PI * 1.55, Math.PI * 0.45, 28);
  const out: ArtShape[] = [{ kind: "path", pts: [...outer, ...inner], closed: true, smooth: true, fill: "ochre", stroke: "line", width: 1.4 }];
  // Seven small dots arcing over it: a new arrival, counted gently.
  arc(118, 64, 46, -1.25, 0.95, 6).forEach((p, i) => out.push({ kind: "dot", x: p.x, y: p.y, r: i === 3 ? 4 : 2.4, fill: i === 3 ? "red" : "line" }));
  out.push({ kind: "path", pts: spiralPoints(150, 34, 6, 1.4, 0, -1), stroke: "line", width: 1.2, opacity: 0.8 });
  return [...out, ...airDots(rand, near(110, 60, 60), 6)];
}

function kola(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const cx = 100;
  const cy = 60;
  // A kola nut broken into its lobes: four rounded pieces, eased apart.
  for (let i = 0; i < 4; i++) {
    const a = i * (TAU / 4) + Math.PI / 4;
    const px = cx + Math.cos(a) * 15;
    const py = cy + Math.sin(a) * 12;
    out.push({ kind: "path", pts: blob(px, py, 15, 11.5, a, 0.12, rand, 10), closed: true, smooth: true, fill: i % 2 ? "ochreLight" : "red", stroke: "line", width: 1.5 });
    // The seam where each lobe met its neighbour.
    out.push({ kind: "path", pts: [pt(px - Math.cos(a) * 6, py - Math.sin(a) * 5), pt(px + Math.cos(a) * 2, py + Math.sin(a) * 2)], stroke: i % 2 ? "ochre" : "chalk", width: 1.2, opacity: 0.8 });
  }
  // A ring of welcome dots.
  arc(cx, cy, 46, 0, TAU, 18)
    .slice(0, 18)
    .forEach((p, i) => out.push({ kind: "dot", x: p.x, y: p.y, r: i % 3 === 0 ? 2.2 : 1.4, fill: i % 3 === 0 ? "ochre" : "line", opacity: 0.8 }));
  return [...out, ...airDots(rand, near(cx, cy, 56), 4)];
}

function beads(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const xs = [40, 80, 120, 160];
  const thread: Pt[] = [pt(14, 66)];
  xs.forEach((x, i) => thread.push(pt(x, 60 + (i % 2 ? 4 : -4))));
  thread.push(pt(186, 58));
  out.push({ kind: "path", pts: thread, smooth: true, stroke: "line", width: 1.4, opacity: 0.8 });
  xs.forEach((x, i) => {
    const y = 60 + (i % 2 ? 4 : -4);
    out.push({ kind: "path", pts: lozenge(x, y, 15, 15), closed: true, fill: i === 0 ? "red" : "chalk", stroke: i === 0 ? "red" : "line", width: 1.6 });
    out.push({ kind: "path", pts: lozenge(x, y, 7, 7), closed: true, fill: i === 0 ? "ochreLight" : "ochre", opacity: i === 0 ? 1 : 0.85 });
  });
  return [...out, ...airDots(rand, (p) => Math.abs(p.y - 62) < 26, 8)];
}

function road(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const path = [pt(10, 108), pt(46, 92), pt(40, 74), pt(88, 66), pt(104, 52), pt(140, 50)];
  out.push({ kind: "path", pts: path, smooth: true, stroke: "ochre", width: 6, opacity: 0.85 });
  out.push({ kind: "path", pts: path, smooth: true, stroke: "line", width: 1.2 });
  // Home: a simple roof and walls, waiting at the end of the road.
  out.push({ kind: "path", pts: [pt(142, 52), pt(142, 34), pt(172, 34), pt(172, 52)], fill: "chalk", stroke: "line", width: 1.6 });
  out.push({ kind: "path", pts: [pt(136, 36), pt(157, 18), pt(178, 36)], closed: true, fill: "red", stroke: "line", width: 1.6 });
  out.push({ kind: "path", pts: [pt(154, 52), pt(154, 42), pt(160, 42), pt(160, 52)], stroke: "line", width: 1.2 });
  path.slice(1, 5).forEach((p, i) => out.push({ kind: "dot", x: p.x + 6, y: p.y - 8, r: 1.8, fill: i % 2 ? "red" : "line" }));
  return [...out, ...airDots(rand, (p) => p.y > 40 && p.x < 150 && p.y < 112 && p.x > 0 && Math.abs(p.y - (108 - p.x * 0.45)) < 22, 6)];
}

function steps(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const inks: Ink[] = ["line", "ochre", "red"];
  [44, 32, 20, 9].forEach((r, i) => {
    out.push({ kind: "path", pts: lozenge(100, 60, r * 1.25, r), closed: true, fill: i === 3 ? "red" : i === 2 ? "ochreLight" : undefined, stroke: inks[i % 3], width: i === 0 ? 1.4 : 2 });
  });
  // Stepped teeth either side: an akwete band.
  for (const side of [-1, 1]) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 6; i++) pts.push(pt(100 + side * (64 + i * 5), 60 + (i % 2 ? -6 : 6)));
    out.push({ kind: "path", pts, stroke: "line", width: 1.4, opacity: 0.75 });
  }
  return [...out, ...airDots(rand, near(100, 60, 70), 6)];
}

function dawn(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [{ kind: "path", pts: [pt(16, 88), pt(184, 88)], stroke: "line", width: 1.4 }];
  [40, 30, 20].forEach((r, i) => out.push({ kind: "path", pts: arc(100, 88, r, Math.PI, TAU, 26), stroke: i === 2 ? "red" : "ochre", fill: i === 2 ? "ochreLight" : undefined, width: i === 2 ? 2 : 1.6 }));
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + 0.22 + (i * (Math.PI - 0.44)) / 8;
    out.push({ kind: "path", pts: [pt(100 + Math.cos(a) * 48, 88 + Math.sin(a) * 48), pt(100 + Math.cos(a) * 58, 88 + Math.sin(a) * 58)], stroke: "line", width: 1.4, opacity: 0.8 });
  }
  for (let i = 0; i < 5; i++) out.push({ kind: "dot", x: 40 + i * 30, y: 100, r: i === 2 ? 2.6 : 1.6, fill: i === 2 ? "red" : "line", opacity: 0.7 });
  return [...out, ...airDots(rand, (p) => p.y > 20 && Math.hypot(p.x - 100, p.y - 88) < 66, 5)];
}

function spiral(rand: () => number): ArtShape[] {
  // A word, spoken: it coils out of the mouth and travels on as a wave, and
  // the dots after it are the word still carrying.
  const coil = spiralPoints(66, 60, 22, 2.2, Math.PI, 1);
  const end = coil[coil.length - 1] as Pt;
  const wave: Pt[] = [end];
  for (let i = 1; i <= 5; i++) wave.push(pt(end.x + i * 16, end.y + (i % 2 ? -9 : 7)));
  const last = wave[wave.length - 1] as Pt;
  return [
    { kind: "path", pts: coil, smooth: true, stroke: "line", width: 2.2 },
    { kind: "path", pts: wave, smooth: true, stroke: "line", width: 2.2 },
    { kind: "dot", x: 66, y: 60, r: 2.6, fill: "ochre" },
    { kind: "dot", x: last.x + 10, y: last.y, r: 4.4, fill: "red" },
    { kind: "dot", x: last.x + 22, y: last.y + 2, r: 2.6, fill: "ochre" },
    { kind: "dot", x: last.x + 32, y: last.y + 4, r: 1.6, fill: "line" },
    ...airDots(rand, (p) => Math.abs(p.y - 60) < 34 && p.x > 30 && p.x < 190, 6),
  ];
}

function circle(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  // A ring of people, side by side: alternating heads around a shared centre.
  arc(100, 60, 38, 0, TAU, 12)
    .slice(0, 12)
    .forEach((p, i) => {
      out.push({ kind: "dot", x: p.x, y: p.y, r: 6, fill: i % 2 ? "ochre" : "ochreLight", stroke: "line", width: 1.2 });
    });
  out.push({ kind: "path", pts: arc(100, 60, 24, 0, TAU, 32), closed: true, smooth: true, stroke: "line", width: 1, opacity: 0.6 });
  out.push({ kind: "path", pts: spiralPoints(100, 60, 10, 1.8, 0, 1), stroke: "red", width: 1.8 });
  return [...out, ...airDots(rand, near(100, 60, 56), 6)];
}

function feathers(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const inks: Ink[] = ["ochreLight", "chalk", "ochre", "chalk", "ochreLight"];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.38;
    const bx = 100 + Math.cos(a + Math.PI) * 6;
    const by = 104;
    const len = 70 - Math.abs(i - 2) * 8;
    const tx = bx + Math.cos(a) * len;
    const ty = by + Math.sin(a) * len;
    const nx = -Math.sin(a) * 9;
    const ny = Math.cos(a) * 9;
    const mid = (k: number) => pt(bx + (tx - bx) * k, by + (ty - by) * k);
    const m = mid(0.55);
    out.push({ kind: "path", pts: [pt(bx, by), pt(m.x + nx, m.y + ny), pt(tx, ty), pt(m.x - nx, m.y - ny)], closed: true, smooth: true, fill: inks[i], stroke: "line", width: 1.3 });
    out.push({ kind: "path", pts: [pt(bx, by), pt(tx, ty)], stroke: i === 2 ? "red" : "line", width: 1.1 });
  }
  return [...out, ...airDots(rand, (p) => p.y > 26 && Math.abs(p.x - 100) < 52, 8)];
}

function mosaic(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const cx = 100;
  const cy = 64;
  // A patched dome seen from the side: irregular cells, joined with visible seams.
  const base = cy + 26;
  out.push({ kind: "path", pts: arc(cx, base, 64, Math.PI, TAU, 40).map((p) => pt(p.x, base - (base - p.y) * 0.9)), closed: true, fill: "ochreLight", stroke: "line", width: 1.8 });
  out.push({ kind: "path", pts: [pt(cx - 72, base), pt(cx + 72, base)], stroke: "line", width: 1.4 });
  const cells: [number, number, number, number][] = [
    [0, -26, 15, 10],
    [-30, -18, 13, 9],
    [30, -18, 13, 9],
    [-14, 0, 12, 9],
    [14, 0, 12, 9],
    [-44, 4, 10, 8],
    [44, 4, 10, 8],
    [0, 16, 11, 6],
    [-28, 17, 9, 5],
    [28, 17, 9, 5],
  ];
  cells.forEach(([dx, dy, rx, ry], i) => out.push({ kind: "path", pts: blob(cx + dx, cy + dy, rx, ry, 0, 0.3, rand, 6), closed: true, fill: i % 3 === 0 ? "ochre" : undefined, stroke: "line", width: 1.4, opacity: 0.95 }));
  // The healer's seams: little stitches across two of the joins.
  for (const [x, y] of [[-16, -12], [22, -6]] as const) for (let k = 0; k < 3; k++) out.push({ kind: "path", pts: [pt(cx + x + k * 4, cy + y - 3), pt(cx + x + k * 4 + 2, cy + y + 3)], stroke: "red", width: 1.4 });
  return [...out, ...airDots(rand, near(cx, cy, 74), 5)];
}

function vine(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const rope: Pt[] = [];
  for (let i = 0; i <= 16; i++) rope.push(pt(12 + i * 11, 62 + Math.sin(i * 0.9) * 6));
  out.push({ kind: "path", pts: rope, smooth: true, stroke: "ochre", width: 5, opacity: 0.85 });
  out.push({ kind: "path", pts: rope, smooth: true, stroke: "line", width: 1.4 });
  rope.forEach((p, i) => {
    if (i % 3 !== 1) return;
    const up = i % 2 ? -1 : 1;
    out.push({ kind: "path", pts: [pt(p.x, p.y), pt(p.x + 6, p.y + up * 9), pt(p.x + 14, p.y + up * 10), pt(p.x + 8, p.y + up * 2)], closed: true, smooth: true, fill: "ochreLight", stroke: "line", width: 1.1 });
  });
  // The pull at either end.
  out.push({ kind: "dot", x: 12, y: 62, r: 4, fill: "red" });
  out.push({ kind: "dot", x: 188, y: rope[16]!.y, r: 4, fill: "red" });
  return [...out, ...airDots(rand, (p) => Math.abs(p.y - 62) < 24, 8)];
}

function kite(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  const birds: [number, number, number][] = [
    [70, 40, 26],
    [128, 30, 18],
    [150, 62, 13],
  ];
  birds.forEach(([x, y, w], i) => {
    out.push({ kind: "path", pts: [pt(x - w, y - w * 0.18), pt(x - w * 0.45, y - w * 0.32), pt(x, y + w * 0.12), pt(x + w * 0.45, y - w * 0.32), pt(x + w, y - w * 0.18)], smooth: true, stroke: i === 0 ? "red" : "line", width: i === 0 ? 2.4 : 1.8 });
  });
  // Below, a hen's scratched ground: a few short marks and a curl.
  for (let i = 0; i < 7; i++) out.push({ kind: "path", pts: [pt(40 + i * 18, 100), pt(46 + i * 18, 94 + (i % 2) * 3)], stroke: "ochre", width: 1.8 });
  out.push({ kind: "path", pts: spiralPoints(170, 98, 6, 1.4, 0, 1), stroke: "line", width: 1.2 });
  return [...out, ...airDots(rand, (p) => p.y > 20 && p.y < 76, 6)];
}

function dust(rand: () => number): ArtShape[] {
  const out: ArtShape[] = [];
  // Scratched ground: short strokes flung outward, in two pigments.
  for (let i = 0; i < 26; i++) {
    const a = rand() * TAU;
    const r = 14 + rand() * 46;
    const x = 100 + Math.cos(a) * r * 1.4;
    const y = 62 + Math.sin(a) * r * 0.75;
    const l = 4 + rand() * 7;
    out.push({ kind: "path", pts: [pt(x, y), pt(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.6)], stroke: i % 3 ? "ochre" : "line", width: 1.6, opacity: 0.85 });
  }
  for (let i = 0; i < 18; i++) {
    const a = rand() * TAU;
    const r = 8 + rand() * 54;
    out.push({ kind: "dot", x: pt(100 + Math.cos(a) * r * 1.4, 0).x, y: pt(0, 62 + Math.sin(a) * r * 0.7).y, r: 1 + rand() * 1.6, fill: i % 5 === 0 ? "red" : "line", opacity: 0.7 });
  }
  out.push({ kind: "path", pts: spiralPoints(100, 62, 9, 2, 0, -1), stroke: "red", width: 1.8 });
  return out;
}

const MOTIFS: Record<Exclude<CultureMotif, "none">, (rand: () => number) => ArtShape[]> = {
  yam,
  calabash,
  crescent,
  kola,
  beads,
  road,
  steps,
  dawn,
  spiral,
  circle,
  feathers,
  mosaic,
  vine,
  kite,
  dust,
};

/** The shapes of a motif in the ART_W × ART_H box; "none" draws nothing (the masquerade note). */
export function cultureArt(motif: CultureMotif, seed = 1): ArtShape[] {
  if (motif === "none") return [];
  return MOTIFS[motif](rng(seed));
}

export const CULTURE_MOTIFS = Object.keys(MOTIFS) as Exclude<CultureMotif, "none">[];
