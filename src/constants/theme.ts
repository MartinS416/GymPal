/**
 * GymPal design tokens.
 *
 * The interface is deliberately monochrome: a white canvas, black type and a
 * single hairline grey for separation. The only accent in the entire product is
 * `danger`, reserved for validation messages.
 */

export const colors = {
  /** Page background. */
  background: '#FFFFFF',
  /** Cards sit on the background and are separated by a hairline, not a shadow. */
  surface: '#FFFFFF',
  /** Quiet fill used for segmented controls, skeletons and inline chips. */
  surfaceMuted: '#F6F6F7',
  /** Input fields and other interactive wells. */
  field: '#FFFFFF',

  text: '#000000',
  textSecondary: '#6C6C72',
  textTertiary: '#A1A1A7',
  textOnInverted: '#FFFFFF',

  /** Hairline dividers and card borders. */
  border: '#E7E7EA',
  borderStrong: '#D2D2D7',

  /** Inverted (black) surfaces, used for the primary action. */
  inverted: '#000000',

  /** Validation. */
  danger: '#B42318',
  /** A brighter red, for use on the inverted (black) screen. */
  dangerBright: '#FF6B5E',
  dangerSurface: '#FEF4F3',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Layout constraints. Keeps line length comfortable on large iPhones and iPads. */
export const layout = {
  /** Maximum width of the content column. */
  maxWidth: 520,
  /** Maximum width of the content column on tablets. */
  maxWidthWide: 640,
  /** Horizontal screen gutter. */
  gutter: 20,
} as const;

/** Hairline thickness, scaled for retina screens. */
export const hairline = 1;

export const durations = {
  fast: 120,
  base: 220,
} as const;
