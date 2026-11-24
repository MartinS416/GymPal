import { StyleSheet, View } from 'react-native';

import type { ColorToken } from '@/components/text';
import { colors } from '@/constants/theme';

export type ChevronDirection = 'left' | 'right' | 'up' | 'down';

export type ChevronProps = {
  direction?: ChevronDirection;
  size?: number;
  color?: ColorToken;
  /** Stroke weight in points. */
  weight?: number;
};

/**
 * A hairline chevron drawn with borders.
 *
 * Keeps the app free of icon fonts and third-party vector dependencies.
 */
export function Chevron({
  direction = 'right',
  size = 9,
  color = 'textTertiary',
  weight = 1.5,
}: ChevronProps) {
  const rotation = {
    right: '-135deg',
    left: '45deg',
    down: '-45deg',
    up: '135deg',
  }[direction];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.chevron,
        {
          width: size,
          height: size,
          borderLeftWidth: weight,
          borderBottomWidth: weight,
          borderColor: colors[color],
          transform: [{ rotate: rotation }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  chevron: {
    // The rotated square sits slightly off-centre, so nudge it back.
    marginLeft: 2,
  },
});
