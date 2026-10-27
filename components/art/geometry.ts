// Pure geometry for Okwu's procedural motifs. Original line work inspired by
// the vocabulary of uli painting (fluid single lines, spirals, dots,
// crescents, generous empty space) and akwete weaving (lozenges, zigzag
// teeth, stepped bands). Nothing here traces or copies an existing artwork,
// and nothing draws masquerades, deities, nsibidi or political symbols.
// Deterministic for a seed so screenshots and snapshots are stable.

export type Pt = { x: number; y: number };

/** mulberry32: a tiny seeded PRNG (0 ≤ r < 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed from any string (FNV-1a). */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
export function smoothPath(pts: Pt[], tension = 1): string {
  if (pts.length === 0) return "";
  const first = pts[0] as Pt;
  if (pts.length === 1) return `M${r2(first.x)} ${r2(first.y)}`;
  let d = `M${r2(first.x)} ${r2(first.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? (pts[i] as Pt);
    const p1 = pts[i] as Pt;
    const p2 = pts[i + 1] as Pt;
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += ` C${r2(c1.x)} ${r2(c1.y)} ${r2(c2.x)} ${r2(c2.y)} ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return d;
}

/** Archimedean spiral points from the centre outward. dir 1 = clockwise on screen. */
export function spiralPoints(cx: number, cy: number, rOuter: number, turns: number, start = 0, dir: 1 | -1 = 1): Pt[] {
  const steps = Math.max(8, Math.ceil(turns * 28));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + dir * t * turns * Math.PI * 2;
    const r = rOuter * t;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function spiralPath(cx: number, cy: number, rOuter: number, turns: number, start = 0, dir: 1 | -1 = 1): string {
  return smoothPath(spiralPoints(cx, cy, rOuter, turns, start, dir));
}

export interface Meander {
  /** The main flowing line. */
  line: string;
  /** Small curls hanging off the line. */
  curls: string[];
  /** Dots that punctuate the line. */
  dots: (Pt & { r: number })[];
  /** Spiral terminals at each end. */
  ends: string[];
}

/**
 * The uli line: one unbroken stroke that wanders across `width`, swelling
 * and settling, ending in a spiral at each side. Curls grow out of the line
 * (each spiral's outer end sits on it) and dots punctuate the gaps.
 */
export function meander(width: number, height: number, seed: number): Meander {
  const rand = rng(seed);
  const mid = height / 2;
  const amp = height * 0.3;
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const f1 = 1.6 + rand() * 0.8;
  const f2 = 3.2 + rand() * 1.2;
  const endR = Math.min(height * 0.3, 12);
  const x0 = endR * 2.2;
  const x1 = width - endR * 2.2;
  const n = Math.max(8, Math.round((x1 - x0) / 14));
  const yAt = (t: number) => {
    const env = Math.sin(Math.PI * t) ** 0.7; // calm at the ends, freer in the middle
    return mid + env * amp * (0.72 * Math.sin(p1 + t * Math.PI * f1) + 0.28 * Math.sin(p2 + t * Math.PI * f2));
  };
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x0 + (x1 - x0) * t, y: yAt(t) });
  }
  const start = pts[0] as Pt;
  const end = pts[pts.length - 1] as Pt;
  const ends = [
    spiralPath(start.x - endR, start.y, endR, 1.6, 0, -1),
    spiralPath(end.x + endR, end.y, endR, 1.6, Math.PI, 1),
  ];

  // Curls: a small spiral whose outer end lands on the line, on alternating sides.
  const curls: string[] = [];
  const curlAt = width > 260 ? [0.36, 0.66] : [0.5];
  const r = Math.min(height * 0.2, 8);
  curlAt.forEach((t0, k) => {
    const t = t0 + (rand() - 0.5) * 0.06;
    const x = x0 + (x1 - x0) * t;
    const y = yAt(t);
    const dy = (yAt(t + 0.01) - yAt(t - 0.01)) / (((x1 - x0) * 0.02) || 1);
    const len = Math.hypot(1, dy);
    const side = k % 2 === 0 ? -1 : 1;
    const nx = (-dy / len) * side;
    const ny = (1 / len) * side;
    const cx = x + nx * r;
    const cy = y + ny * r;
    const turns = 1.35;
    const dir: 1 | -1 = side > 0 ? 1 : -1;
    const aEnd = Math.atan2(y - cy, x - cx);
    curls.push(spiralPath(cx, cy, r, turns, aEnd - dir * turns * Math.PI * 2, dir));
  });

  // Dots in the gaps between curls, close to the line, alternating sides.
  const dots: (Pt & { r: number })[] = [];
  const dotAt = width > 260 ? [0.18, 0.51, 0.82] : [0.24, 0.76];
  dotAt.forEach((t, k) => {
    const side = k % 2 === 0 ? 1 : -1;
    dots.push({ x: x0 + (x1 - x0) * t, y: yAt(t) + side * (height * 0.2 + rand() * 2), r: 1.6 + rand() * 0.8 });
  });
  return { line: smoothPath(pts), curls, dots, ends };
}

export type ToneLevel = "H" | "L" | "D";

export interface Contour {
  points: Pt[];
  path: string;
}

/**
 * A pitch contour for a run of syllable tones: H high, L low, D a
 * downstepped high (it lowers the high register for the rest of the run).
 * Points sit at the centre of equal columns, so text laid out in equal
 * columns lines up under them. Level tones hold flat; changes glide.
 */
export function pitchContour(tones: readonly ToneLevel[], width: number, height: number, pad = 6): Contour {
  if (tones.length === 0) return { points: [], path: "" };
  const top = pad;
  const bottom = height - pad;
  const span = bottom - top;
  const step = span * 0.22;
  let highY = top;
  const col = width / tones.length;
  const points = tones.map((t, i) => {
    if (t === "D") highY = Math.min(highY + step, top + span * 0.6);
    const y = t === "L" ? bottom - span * 0.08 : highY;
    return { x: col * (i + 0.5), y };
  });
  const first = points[0] as Pt;
  let d = `M${r2(first.x - col * 0.32)} ${r2(first.y)} L${r2(first.x)} ${r2(first.y)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Pt;
    const b = points[i] as Pt;
    const mx = (b.x - a.x) / 2;
    d += ` C${r2(a.x + mx)} ${r2(a.y)} ${r2(b.x - mx)} ${r2(b.y)} ${r2(b.x)} ${r2(b.y)}`;
  }
  const last = points[points.length - 1] as Pt;
  d += ` L${r2(last.x + col * 0.32)} ${r2(last.y)}`;
  return { points, path: d };
}

export type BandShape =
  | { kind: "poly"; points: string; fill: "line" | "red" | "ochre" | "chalk" | "paperSunk" }
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: "line" | "red" | "ochre" | "chalk" | "paperSunk" };

const poly = (pts: Pt[]) => pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join(" ");

/**
 * An akwete-inspired woven band: edge stripes, a run of nested lozenges and
 * zigzag teeth between them. `variant` picks the weave.
 */
export function akweteBand(width: number, height: number, variant: "lozenge" | "teeth" = "lozenge"): BandShape[] {
  const out: BandShape[] = [];
  const edge = Math.max(2, Math.round(height * 0.08));
  out.push({ kind: "rect", x: 0, y: 0, w: width, h: edge, fill: "line" });
  out.push({ kind: "rect", x: 0, y: height - edge, w: width, h: edge, fill: "line" });
  const top = edge * 2;
  const bottom = height - edge * 2;
  const h = bottom - top;
  const cy = top + h / 2;
  const unit = h * 1.25;
  const count = Math.ceil(width / unit) + 1;
  const offset = (width - count * unit) / 2;
  for (let i = 0; i < count; i++) {
    const cx = offset + unit * (i + 0.5);
    if (variant === "lozenge") {
      out.push({ kind: "poly", points: poly([{ x: cx, y: top }, { x: cx + unit / 2, y: cy }, { x: cx, y: bottom }, { x: cx - unit / 2, y: cy }]), fill: "red" });
      const k = 0.5;
      out.push({ kind: "poly", points: poly([{ x: cx, y: cy - (h / 2) * k }, { x: cx + (unit / 2) * k, y: cy }, { x: cx, y: cy + (h / 2) * k }, { x: cx - (unit / 2) * k, y: cy }]), fill: "ochre" });
      const s = Math.max(1.2, h * 0.07);
      out.push({ kind: "poly", points: poly([{ x: cx, y: cy - s }, { x: cx + s, y: cy }, { x: cx, y: cy + s }, { x: cx - s, y: cy }]), fill: "chalk" });
      // teeth between lozenges, from the edges inward
      const ex = cx + unit / 2;
      const tw = unit * 0.22;
      out.push({ kind: "poly", points: poly([{ x: ex - tw, y: top }, { x: ex + tw, y: top }, { x: ex, y: top + h * 0.32 }]), fill: "line" });
      out.push({ kind: "poly", points: poly([{ x: ex - tw, y: bottom }, { x: ex + tw, y: bottom }, { x: ex, y: bottom - h * 0.32 }]), fill: "line" });
    } else {
      const half = unit / 2;
      out.push({ kind: "poly", points: poly([{ x: cx - half, y: bottom }, { x: cx, y: top }, { x: cx + half, y: bottom }]), fill: i % 2 === 0 ? "red" : "ochre" });
      out.push({ kind: "poly", points: poly([{ x: cx - half * 0.4, y: bottom }, { x: cx, y: top + h * 0.45 }, { x: cx + half * 0.4, y: bottom }]), fill: "chalk" });
    }
  }
  return out;
}

export type FieldMark =
  | { kind: "dot"; x: number; y: number; r: number; accent: boolean }
  | { kind: "ring"; x: number; y: number; r: number }
  | { kind: "arc"; d: string }
  | { kind: "spiral"; d: string };

/** A sparse scatter of uli marks for backgrounds (low ink, lots of air). */
export function uliField(width: number, height: number, seed: number, cell = 64): FieldMark[] {
  const rand = rng(seed);
  const out: FieldMark[] = [];
  for (let gy = 0; gy < Math.ceil(height / cell); gy++) {
    for (let gx = 0; gx < Math.ceil(width / cell); gx++) {
      const roll = rand();
      if (roll < 0.45) continue;
      const x = (gx + 0.2 + rand() * 0.6) * cell;
      const y = (gy + 0.2 + rand() * 0.6) * cell;
      const pick = rand();
      if (pick < 0.4) out.push({ kind: "dot", x, y, r: 1.4 + rand() * 1.6, accent: rand() < 0.18 });
      else if (pick < 0.6) out.push({ kind: "ring", x, y, r: 3 + rand() * 3 });
      else if (pick < 0.85) {
        const r = 6 + rand() * 6;
        const a0 = rand() * Math.PI * 2;
        const a1 = a0 + Math.PI * (0.7 + rand() * 0.5);
        const p0 = { x: x + Math.cos(a0) * r, y: y + Math.sin(a0) * r };
        const p1 = { x: x + Math.cos(a1) * r, y: y + Math.sin(a1) * r };
        out.push({ kind: "arc", d: `M${r2(p0.x)} ${r2(p0.y)} A${r2(r)} ${r2(r)} 0 0 1 ${r2(p1.x)} ${r2(p1.y)}` });
      } else out.push({ kind: "spiral", d: spiralPath(x, y, 5 + rand() * 3, 1.5, rand() * Math.PI * 2, rand() < 0.5 ? 1 : -1) });
    }
  }
  return out;
}

export interface MarkGeometry {
  path: string;
  dot: Pt & { r: number };
  /** Bounding box of the stroke centreline and the dot. */
  box: { x: number; y: number; w: number; h: number };
}

/**
 * The Okwu mark: a spoken word as a spiral. The coil opens into a tail that
 * keeps the coil's sweep (no kink), and a dot lands where the word ends.
 */
export function okwuMark(): MarkGeometry {
  const cx = 48;
  const cy = 48;
  const R = 26;
  const turns = 2.1;
  const start = -Math.PI / 2;
  const coil = spiralPoints(cx, cy, R, turns, start, 1);
  const aEnd = start + turns * Math.PI * 2;
  const tail: Pt[] = [];
  const grow = R / (turns * Math.PI * 2); // the coil's radial rate per radian, carried on
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const da = t * 0.6 * Math.PI;
    const a = aEnd + da;
    const r = R + grow * da + R * 0.35 * t * t;
    tail.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  const all = [...coil, ...tail];
  const p = tail[tail.length - 1] as Pt;
  const q = tail[tail.length - 2] as Pt;
  const len = Math.hypot(p.x - q.x, p.y - q.y) || 1;
  const dot = { x: p.x + ((p.x - q.x) / len) * 11, y: p.y + ((p.y - q.y) / len) * 11, r: 5 };
  const xs = [...all.map((v) => v.x), dot.x - dot.r, dot.x + dot.r];
  const ys = [...all.map((v) => v.y), dot.y - dot.r, dot.y + dot.r];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { path: smoothPath(all), dot, box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
}
