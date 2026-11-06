// ─── Light palette (the original design) ─────────────────────────────────────
export const lightColors = {
  primary: '#00193c',
  primaryLight: '#002d62',
  blue: '#115cb9',
  blueLight: '#eef4fd',
  purple: '#5c3188',
  purpleLight: '#f8f3fc',
  purpleBorder: '#5c3188',
  red: '#ba1a1a',
  redLight: '#fef2f2',
  amber: '#b45309',
  amberLight: '#fffbeb',
  green: '#15803d',
  greenLight: '#f0fdf4',
  gray: '#43474f',
  grayLight: '#f3f4f6',
  border: '#c4c6d1',
  white: '#ffffff',
  background: '#f5f7fa',
  // "surface" is the color of cards / headers / the tab bar (was hardcoded white)
  surface: '#ffffff',
  text: '#151c22',
  textMuted: '#6b7280',
  pending: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  investigating: { bg: '#f5f3ff', text: '#5c3188', border: '#ddd6fe' },
  resolved: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  rejected: { bg: '#f3f4f6', text: '#43474f', border: '#e5e7eb' },
};

// ─── Dark palette ─────────────────────────────────────────────────────────────
// Accent hues are lightened so they stay legible on dark surfaces. Neutrals are
// flipped: canvas is near-black, surfaces are dark grey, text is near-white.
export const darkColors: typeof lightColors = {
  primary: '#8ab4f8',        // lightened navy → readable accent on dark
  primaryLight: '#5c8fd6',
  blue: '#6ea8ff',
  blueLight: '#16273f',
  purple: '#c4a7e7',
  purpleLight: '#2a2140',
  purpleBorder: '#7c5bb0',
  red: '#ff6b6b',
  redLight: '#3a1d1d',
  amber: '#f0b45e',
  amberLight: '#3a2c14',
  green: '#5bd07f',
  greenLight: '#153021',
  gray: '#c7cad1',
  grayLight: '#252a31',
  border: '#3a4048',
  white: '#ffffff',
  background: '#0f1216',     // canvas
  surface: '#1a1f26',        // cards / headers / tab bar
  text: '#e6e9ee',
  textMuted: '#9aa2ad',
  pending: { bg: '#3a2c14', text: '#f0b45e', border: '#5a4620' },
  investigating: { bg: '#2a2140', text: '#c4a7e7', border: '#463a6e' },
  resolved: { bg: '#153021', text: '#5bd07f', border: '#1f4a32' },
  rejected: { bg: '#252a31', text: '#c7cad1', border: '#3a4048' },
};

export type ThemePalette = typeof lightColors;

// Backwards-compatible default export: the light palette. Screens that haven't
// been migrated to useTheme() keep working and stay light.
export const Colors = lightColors;
