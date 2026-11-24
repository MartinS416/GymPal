import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import type { TextProps as RNTextProps, TextStyle } from 'react-native';

import { colors } from '@/constants/theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'eyebrow'
  | 'timer'
  | 'metric';

/** Named colours from the design tokens. */
export type ColorToken = keyof typeof colors;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  /** A named colour from the design tokens. */
  tone?: ColorToken;
  /** A raw colour value, for the rare case one is required. */
  color?: string;
  align?: TextStyle['textAlign'];
  children?: ReactNode;
};

/**
 * Single typography entry point for the whole app.
 *
 * Sizes are tuned for iOS: body copy is 17pt (the platform default) so text
 * feels native, and labels are tracked-out uppercase to build hierarchy
 * without introducing colour.
 */
export function Text({
  variant = 'body',
  tone,
  color,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        styles.base,
        styles[variant],
        tone ? { color: colors[tone] } : null,
        color ? { color } : null,
        align ? { textAlign: align } : null,
        style,
      ]}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
    fontWeight: '400',
    // Android adds extra leading by default; normalising keeps the rhythm tight.
    includeFontPadding: false,
  },
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  heading: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subheading: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
  },
  bodyStrong: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  caption: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  metric: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  timer: {
    fontSize: 54,
    lineHeight: 60,
    fontWeight: '700',
    letterSpacing: -1.5,
    // Tabular figures stop the digits from jumping around as they change.
    fontVariant: ['tabular-nums'],
  },
});
