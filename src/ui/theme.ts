// Design tokens for the "Conceptual Sketch Bento Box" style (CLAUDE.md) —
// one consistent system every screen draws from, not per-screen improvisation.

export const colors = {
  // Off-white/paper base surface — deliberately not pure white, to read as
  // a sketchbook page rather than a rendered UI panel.
  paper: "#f6f1e6",
  // Single dark neutral used consistently for every sketch border and
  // monoline icon — CLAUDE.md calls for exactly one ink color, not a palette.
  ink: "#2b2a25",
  // Same ink color at reduced opacity, for secondary/de-emphasized text
  // (e.g. an inactive step label, a description under a heading).
  inkMuted: "rgba(43, 42, 37, 0.65)",
  // The ONE accent color, reserved exclusively for allergen/warning cells —
  // used sparingly so it reads as urgent, not as this app's general "brand color".
  accent: "#b3452b",
} as const;

export const fonts = {
  // Handwritten/marker-style display face for cell titles, headings, and
  // callouts. Bundled via @expo-google-fonts/caveat and loaded with
  // useFonts() in app/_layout.tsx — text using these families renders with
  // the platform default until that load resolves.
  display: "Caveat_700Bold",
  displaySemiBold: "Caveat_600SemiBold",
  // Body/data text (confidence scores, ingredient details, JSON-derived
  // values) stays a clean, highly legible sans-serif — the sketch aesthetic
  // applies to structure and chrome, not to the data a user needs to read
  // quickly and unambiguously (a food-safety-relevant allergen list above
  // all). Left undefined deliberately: components using this token should
  // omit fontFamily and let the platform default sans-serif apply.
  body: undefined,
} as const;

// Asymmetric corner radii, evoking a hand-redrawn box rather than a
// pixel-perfect rectangle. Shared presets for every sketch-bordered box in
// the app (T7.2's SketchCard, and every screen before it).
export const radii = {
  // Cards and full-size buttons.
  sketch: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 8,
  },
  // Smaller pill-style controls (toggle buttons, small action buttons).
  sketchTight: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 8,
  },
} as const;

export const strokes = {
  normal: 2,
  // Slightly heavier weight for emphasized/warning cells. CLAUDE.md also
  // calls for an "occasional double-stroke (as if redrawn)" on emphasized
  // cells — that's a nested-border component technique (two overlapping
  // bordered Views, offset slightly), not a single style value, so it's
  // implemented where SketchCard supports an "emphasized" variant (T7.2),
  // not here.
  emphasized: 3,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
