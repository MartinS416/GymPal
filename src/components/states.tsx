import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type EmptyStateProps = {
  title: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
  /** Hides the decorative mark for very compact placements. */
  compact?: boolean;
};

/**
 * Empty state.
 *
 * Used wherever a section has nothing to show yet. The mark is three
 * hairline rules — a content placeholder rather than a control, so it can
 * never be mistaken for a radio button or a checkbox.
 */
export function EmptyState({ title, description, style, compact = false }: EmptyStateProps) {
  return (
    <View style={[styles.empty, style]}>
      <View style={[styles.mark, compact ? styles.markCompact : null]}>
        <View style={[styles.markLine, styles.markLineLong]} />
        <View style={styles.markLine} />
        <View style={[styles.markLine, styles.markLineShort]} />
      </View>
      <View style={styles.emptyText}>
        <Text variant="subheading">{title}</Text>
        {description ? (
          <Text variant="caption" style={styles.emptyDescription}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export type SkeletonProps = {
  /** Height of the placeholder bar. */
  height?: number;
  /** Width of the placeholder bar. */
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

/**
 * A single placeholder bar.
 *
 * The pulse is the only looping animation in the app; it exists so a loading
 * state reads as "in progress" rather than "frozen".
 */
export function Skeleton({ height = 12, width = '100%', style }: SkeletonProps) {
  const [pulse] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    // The native driver is not available on web, where React Native Web falls
    // back to a JS animation.
    const useNativeDriver = Platform.OS !== 'web';
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.skeleton,
        { height, width, opacity: pulse },
        style,
      ]}
    />
  );
}

export type LoadingStateProps = {
  /** Number of placeholder lines. */
  lines?: number;
  style?: StyleProp<ViewStyle>;
};

/** Block placeholder used while a section is resolving its content. */
export function LoadingState({ lines = 2, style }: LoadingStateProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.loading, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={index === 0 ? 14 : 11}
          width={index === 0 ? '62%' : '100%'}
          style={index === 0 ? styles.skeletonFirst : styles.skeletonRest}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
  },
  mark: {
    width: 20,
    gap: 3,
    marginTop: 4,
  },
  markCompact: {
    width: 16,
  },
  markLine: {
    height: 1,
    width: '70%',
    backgroundColor: colors.borderStrong,
  },
  markLineLong: {
    width: '100%',
  },
  markLineShort: {
    width: '45%',
  },
  emptyText: {
    flex: 1,
    gap: spacing.xxs,
  },
  emptyDescription: {
    marginTop: spacing.xxs,
  },
  loading: {
    gap: spacing.sm,
  },
  skeleton: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  skeletonFirst: {
    marginBottom: spacing.xs,
  },
  skeletonRest: {
    marginBottom: spacing.xs,
  },
});
