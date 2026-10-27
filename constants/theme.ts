// Okwu design tokens: "Uli", a light theme.
//
// Warm cream paper, deep indigo ink, earth accents. The palette borrows from
// the pigments of uli wall painting (dark ink on pale walls, camwood red,
// ochre, white chalk) and the indigo of dyed cloth. Every screen draws its
// colour, type, spacing and motion from this file only; scripts/lint-ui.mjs
// bans hex and fontSize literals in screens and feature components.
//
// 60/30/10: paper is the 60, indigo ink the 30, and the 10 is camwood (the
// accent: progress, focus, the active tab, key numbers). The primary CTA is a
// filled ink button, a calm "ink seal", never an orange or green pill.
//
// This module is pure TypeScript (no react-native import) so bun can test it.

/** Raw pigments. Screens use the semantic `colors` below, never these. */
export const palette = {
  paper: "#F5EEE1",
  paperRaised: "#FBF7F0",
  paperSunk: "#ECE3D2",
  paperDeep: "#E2D5BE",
  chalk: "#FFFDF8",

  indigo: "#1F2552",
  indigoDeep: "#151938",
  indigoSoft: "#3A4178",

  camwood: "#A4461F",
  camwoodDeep: "#85371A",
  ochre: "#C2902B",
  ochreDeep: "#7F5C12",
  ochreLight: "#E7CC8C",
  leaf: "#2F6A4C",
  leafDeep: "#234F39",
  oxblood: "#8E2B2B",
} as const;

/** `rgba()` of a 6-digit hex at an opacity (0..1). */
export function alpha(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(opacity * 1000) / 1000})`;
}

const ink = palette.indigo;

/** Semantic colours. */
export const colors = {
  // Ground (the 60)
  bg: palette.paper,
  surface: palette.paperRaised,
  surfaceSunk: palette.paperSunk,
  surfaceDeep: palette.paperDeep,
  chalk: palette.chalk,

  // Ink (the 30): text hierarchy by opacity of one indigo
  ink,
  inkDeep: palette.indigoDeep,
  inkSoft: palette.indigoSoft,
  ink80: alpha(ink, 0.8),
  ink68: alpha(ink, 0.68),
  ink48: alpha(ink, 0.48),
  ink24: alpha(ink, 0.24),
  ink12: alpha(ink, 0.12),
  ink06: alpha(ink, 0.06),
  onInk: palette.paperRaised,
  onInk68: alpha(palette.paperRaised, 0.68),
  onInk24: alpha(palette.paperRaised, 0.24),
  onInk12: alpha(palette.paperRaised, 0.12),

  // Accent (the 10)
  accent: palette.camwood,
  accentDeep: palette.camwoodDeep,
  accent12: alpha(palette.camwood, 0.12),
  accent06: alpha(palette.camwood, 0.06),

  // Meaning
  reward: palette.ochre,
  rewardText: palette.ochreDeep,
  rewardLight: palette.ochreLight,
  reward12: alpha(palette.ochre, 0.14),
  success: palette.leaf,
  successDeep: palette.leafDeep,
  success12: alpha(palette.leaf, 0.12),
  danger: palette.oxblood,
  danger12: alpha(palette.oxblood, 0.1),

  // Chrome
  hairline: alpha(ink, 0.12),
  hairlineStrong: alpha(ink, 0.2),
  focus: palette.camwood,
  scrim: alpha(palette.indigoDeep, 0.42),
  transparent: "transparent",
} as const;

export type ColorToken = keyof typeof colors;

/** Pigments the procedural art may use (components/art). */
export const artInk = {
  line: palette.indigo,
  red: palette.camwood,
  ochre: palette.ochre,
  ochreLight: palette.ochreLight,
  green: palette.leaf,
  chalk: palette.chalk,
  paper: palette.paper,
  paperSunk: palette.paperSunk,
  paperDeep: palette.paperDeep,
} as const;

// ---------------------------------------------------------------------------
// Type
//
// Two families, both from SIL International and designed for African Latin
// orthographies. Both render ị ọ ụ ṅ and stack tone marks on dotted vowels
// (ị́ ọ̀ ụ̄, which have no precomposed form), with mark-to-base and
// mark-to-mark positioning and soft-dotted i (the tittle gives way to a tone
// mark). Chosen by a headless render test; see docs/DESIGN.md §Type.
//   Gentium Book Plus: the voice of Igbo and of display headings.
//   Andika: the interface (English UI, labels, glosses), a literacy face.
// Shipped unmodified (the OFL Reserved Font Names forbid a renamed subset).
// ---------------------------------------------------------------------------

/** Font family names, as registered with expo-font in app/_layout.tsx. */
export const fonts = {
  ui: "Andika-Regular",
  uiBold: "Andika-Bold",
  display: "GentiumBookPlus-Regular",
  displayBold: "GentiumBookPlus-Bold",
  /** The Igbo-safe faces. <T igbo> always sets Igbo in these. */
  igbo: "GentiumBookPlus-Regular",
  igboBold: "GentiumBookPlus-Bold",
} as const;

export type TypeVariant = "display" | "title" | "body" | "caption" | "label";

/**
 * Four sizes (32, 22, 17, 13) and two weights (400, 700). `label` is the
 * caption size set in bold capitals with tracking, for English only.
 */
export const typeScale: Record<TypeVariant, { fontSize: number; lineHeight: number }> = {
  display: { fontSize: 32, lineHeight: 40 },
  title: { fontSize: 22, lineHeight: 28 },
  body: { fontSize: 17, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 20 },
  label: { fontSize: 13, lineHeight: 20 },
};

/**
 * Line heights for Igbo. A capital with a tone mark reaches ~0.99em above the
 * baseline and a dot below ~0.22em under it, so Igbo lines get more room than
 * English ones (iOS clips glyphs that overflow a Text's own box).
 */
export const igboLineHeight: Record<TypeVariant, number> = {
  display: 44,
  title: 32,
  body: 28,
  caption: 20,
  label: 20,
};

/** Tracking for the English-only label style. Never applied to Igbo (it can split a letter from its marks). */
export const labelTracking = 0.8;

/** Which family each variant uses. */
export const variantFamily: Record<TypeVariant, { regular: string; bold: string }> = {
  display: { regular: fonts.display, bold: fonts.displayBold },
  title: { regular: fonts.display, bold: fonts.displayBold },
  body: { regular: fonts.ui, bold: fonts.uiBold },
  caption: { regular: fonts.ui, bold: fonts.uiBold },
  label: { regular: fonts.uiBold, bold: fonts.uiBold },
};

// ---------------------------------------------------------------------------
// Space, shape, size
// ---------------------------------------------------------------------------

/** The 8-point grid (4 for hairline adjustments). */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  huge: 80,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Control heights. Every tap target is at least 44pt. */
export const size = {
  tapMin: 44,
  buttonLg: 56,
  buttonMd: 48,
  buttonSm: 40,
  field: 52,
  chip: 40,
  iconButton: 44,
  icon: 22,
  iconSm: 18,
  key: 48,
  tabIcon: 24,
  progress: 8,
  switchW: 52,
  switchH: 32,
} as const;

/** Side gutter by window width: 20 on SE-class phones, 24 above. */
export function gutterFor(width: number): number {
  return width < 400 ? 20 : space.lg;
}

/** Reading measure: text blocks never run wider than this. */
export const maxContentWidth = 560;

// ---------------------------------------------------------------------------
// Depth: soft, warm, paper-tinted shadows (never grey on cream)
// ---------------------------------------------------------------------------

const shadowTint = "84, 58, 24"; // umber, so shadows read as paper lifting off paper

export const shadow = {
  none: "none",
  /** A card resting on the page. */
  card: `0px 1px 2px rgba(${shadowTint}, 0.06), 0px 8px 24px rgba(${shadowTint}, 0.08)`,
  /** Something lifted: a toast, a selected segment, a switch thumb. */
  lift: `0px 2px 4px rgba(${shadowTint}, 0.08), 0px 12px 32px rgba(${shadowTint}, 0.14)`,
  /** The ink button: an inner highlight on top plus an indigo-tinted drop. */
  inkButton: "inset 0px 1px 0px rgba(255, 255, 255, 0.14), 0px 6px 16px rgba(31, 37, 82, 0.22)",
  /** A key cap on the Igbo key strip: a hairline of depth under the key. */
  key: `0px 1px 0px rgba(${shadowTint}, 0.12)`,
  /** A sheet rising from the bottom edge. */
  sheet: `0px -8px 32px rgba(${shadowTint}, 0.16)`,
} as const;

// ---------------------------------------------------------------------------
// Motion: calm. Nothing bounces more than once; Reduce Motion gets fades.
// ---------------------------------------------------------------------------

export const motion = {
  /** Press feedback. */
  tap: 120,
  /** A state change (selection, toggle, segment). */
  state: 220,
  /** Something entering (sheet, toast, card). */
  enter: 320,
  /** The one celebratory peak per flow. */
  celebrate: 640,
  /** Toast dwell time. */
  toastMs: 2800,
  /** Calm ease-out: cubic-bezier(0.22, 1, 0.36, 1). */
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  press: { scale: 0.97, damping: 20, stiffness: 260 },
} as const;

/** Z order for overlays rendered outside a Modal. */
export const layer = {
  toast: 50,
  keyStrip: 20,
} as const;
