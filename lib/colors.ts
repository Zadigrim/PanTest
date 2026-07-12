// Okuji palette — canonical tokens (mirror of tailwind.config.js).
// Use these for StyleSheet / imperative color values where a NativeWind
// className isn't available. Do not add tint scales — soften with opacity
// over ink or paper instead.
export const palette = {
  ink: '#1f1d1a',
  paper: '#f6f1e6',
  cream: '#f5f0e8',
  muted: '#6b6356',
  hairline: '#c8bfa9',
  accent: '#c9a84c',
  green: '#1d9e75',
  red: '#9b2335',
  blue: '#2d5a8e',
  navy: '#0d1b2a',
} as const

// DB color columns (stamp_color, illus_color, background_color, …) are stored
// as bare 6-digit hex WITHOUT a leading '#'. React Native and react-native-svg
// reject a bare hex ("1D9E75" is not a valid color or brush), so normalize
// before handing a stored color to any color/fill/stroke prop. Idempotent for
// values that already include '#'; falls back for null/empty.
export function hexColor(value: string | null | undefined, fallback = '#000000'): string {
  if (!value) return fallback
  return value.startsWith('#') ? value : `#${value}`
}
