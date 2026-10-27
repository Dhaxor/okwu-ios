// Shared shape vocabulary for the game art (Ubi garden, Obodo map). Pure
// geometry: every builder returns path strings in a local artboard, filled
// and stroked by name from the `artInk` pigments, so the renderers stay
// thin and the geometry stays testable and deterministic per seed.
import type { artInk } from "@/constants/theme";
import { smoothPath, spiralPath, type Pt } from "../geometry";

export type Pigment = keyof typeof artInk;

export interface ArtShape {
  d: string;
  fill?: Pigment;
  stroke?: Pigment;
  /** Stroke width in artboard units. */
  width?: number;
  opacity?: number;
  /** Fill opacity (defaults to 1). */
  fillOpacity?: number;
  dash?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Map a point from a leaf's own frame (u along, v across) into the artboard. */
function frame(base: Pt, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (u: number, v: number) => `${r2(base.x + u * c - v * s)} ${r2(base.y + u * s + v * c)}`;
}

/** A heart-shaped leaf (yam, cocoyam): notch at `base`, tip `len` away along `angleDeg` (0 = right, 90 = down). */
export function heartLeaf(base: Pt, angleDeg: number, len: number, wid: number, notch = 0.18): string {
  const p = frame(base, angleDeg);
  const L = len;
  const W = wid;
  return (
    `M${p(0, 0)} C${p(-notch * L, -0.5 * W)} ${p(0.28 * L, -0.66 * W)} ${p(0.55 * L, -0.4 * W)} ` +
    `C${p(0.76 * L, -0.24 * W)} ${p(0.93 * L, -0.07 * W)} ${p(L, 0)} ` +
    `C${p(0.93 * L, 0.07 * W)} ${p(0.76 * L, 0.24 * W)} ${p(0.55 * L, 0.4 * W)} ` +
    `C${p(0.28 * L, 0.66 * W)} ${p(-notch * L, 0.5 * W)} ${p(0, 0)} Z`
  );
}

/** A lance-shaped leaf or leaflet (ugu). */
export function lanceLeaf(base: Pt, angleDeg: number, len: number, wid: number): string {
  const p = frame(base, angleDeg);
  const L = len;
  const W = wid;
  return `M${p(0, 0)} C${p(0.3 * L, -0.55 * W)} ${p(0.72 * L, -0.42 * W)} ${p(L, 0)} C${p(0.72 * L, 0.42 * W)} ${p(0.3 * L, 0.55 * W)} ${p(0, 0)} Z`;
}

/** The midrib of a leaf: a quiet line from the base most of the way to the tip. */
export function midrib(base: Pt, angleDeg: number, len: number): string {
  const p = frame(base, angleDeg);
  return `M${p(len * 0.05, 0)} L${p(len * 0.82, 0)}`;
}

/** A long arching strap (maize leaf): leaves `base` along `angleDeg`, then droops. */
export function strapLeaf(base: Pt, angleDeg: number, len: number, wid: number, droop: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const n = 10;
  const centre: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    centre.push({ x: base.x + dir.x * len * t, y: base.y + dir.y * len * t + droop * t * t });
  }
  const left: Pt[] = [];
  const right: Pt[] = [];
  centre.forEach((c, i) => {
    const t = i / n;
    const nb = centre[Math.min(n, i + 1)] as Pt;
    const pb = centre[Math.max(0, i - 1)] as Pt;
    const dx = nb.x - pb.x;
    const dy = nb.y - pb.y;
    const l = Math.hypot(dx, dy) || 1;
    const w = (wid / 2) * Math.sin(Math.PI * Math.min(0.98, t * 0.92 + 0.08)) ** 0.7;
    left.push({ x: c.x - (dy / l) * w, y: c.y + (dx / l) * w });
    right.push({ x: c.x + (dy / l) * w, y: c.y - (dx / l) * w });
  });
  const outline = [...left, ...right.reverse()];
  return `${smoothPath(outline)} Z`;
}

/** An earth mound (a yam heap) sitting on the ground line. */
export function mound(cx: number, ground: number, w: number, h: number): string {
  return `M${r2(cx - w / 2)} ${r2(ground)} C${r2(cx - w * 0.36)} ${r2(ground - h * 1.1)} ${r2(cx + w * 0.36)} ${r2(ground - h * 1.1)} ${r2(cx + w / 2)} ${r2(ground)} Z`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r2(cx - rx)} ${r2(cy)} A${r2(rx)} ${r2(ry)} 0 1 0 ${r2(cx + rx)} ${r2(cy)} A${r2(rx)} ${r2(ry)} 0 1 0 ${r2(cx - rx)} ${r2(cy)} Z`;
}

export function circle(cx: number, cy: number, r: number): string {
  return ellipse(cx, cy, r, r);
}

export function rect(x: number, y: number, w: number, h: number, rx = 0): string {
  if (rx <= 0) return `M${r2(x)} ${r2(y)} H${r2(x + w)} V${r2(y + h)} H${r2(x)} Z`;
  const r = Math.min(rx, w / 2, h / 2);
  return (
    `M${r2(x + r)} ${r2(y)} H${r2(x + w - r)} Q${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + r)} V${r2(y + h - r)} ` +
    `Q${r2(x + w)} ${r2(y + h)} ${r2(x + w - r)} ${r2(y + h)} H${r2(x + r)} Q${r2(x)} ${r2(y + h)} ${r2(x)} ${r2(y + h - r)} V${r2(y + r)} Q${r2(x)} ${r2(y)} ${r2(x + r)} ${r2(y)} Z`
  );
}

export function poly(pts: Pt[], close = true): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${r2(p.x)} ${r2(p.y)}`).join(" ") + (close ? " Z" : "");
}

export function line(a: Pt, b: Pt): string {
  return `M${r2(a.x)} ${r2(a.y)} L${r2(b.x)} ${r2(b.y)}`;
}

/** A small uli curl: a spiral whose outer end lands on `at`. */
export function curl(at: Pt, r: number, turns = 1.4, dir: 1 | -1 = 1, startDeg = 0): string {
  const a = (startDeg * Math.PI) / 180;
  const cx = at.x - Math.cos(a) * r;
  const cy = at.y - Math.sin(a) * r;
  return spiralPath(cx, cy, r, turns, a - dir * turns * Math.PI * 2, dir);
}

/** Several small dots as one path (cheap to render). */
export function dots(pts: Pt[], r: number): string {
  return pts.map((p) => circle(p.x, p.y, r)).join(" ");
}
