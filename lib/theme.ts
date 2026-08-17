// Design tokens — Life OS App
// Inherited from the Faith Apps (WordApp) visual language per ARCHITECTURE.md:
// Cinzel display + EB Garamond body, warm gold/cream palette on deep brown-black.
// Palette values sourced from WordApp-Expo/App.js (the proven production set).

export const colors = {
  // Base
  bg: "#140F07",          // deep brown-black — app background
  surface: "#1E1710",     // cards / panels
  surfaceRaised: "#2A2117",

  // Golds (primary identity)
  gold: "#CCA858",        // primary accent — actions, active tab
  goldBright: "#E8D498",  // headings on dark
  goldSoft: "#DEC990",    // secondary text on dark
  goldMuted: "#907848",   // tertiary / disabled
  goldDeep: "#7A6028",    // borders, dividers

  // Text
  text: "#E8D498",
  textSecondary: "#B8A06A",
  textMuted: "#907040",

  // Semantic
  danger: "#B05040",
  warning: "#B87020",
  success: "#6B8E4E",
} as const;

export const fonts = {
  display: "Cinzel_600SemiBold",      // screen titles, brand moments
  displayBold: "Cinzel_700Bold",
  body: "EBGaramond_400Regular",
  bodyItalic: "EBGaramond_400Regular_Italic",
  bodyMedium: "EBGaramond_500Medium",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;
