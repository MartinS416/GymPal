import { useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { Sparkline } from '@/components/sparkline';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { formatRelativeDate } from '@/lib/calendar';
import type { MeasurementSystem } from '@/lib/units';
import {
  filterByWindow,
  formatChange,
  formatMeasureValue,
  summarize,
  timeframeWindow,
  type MetricData,
} from '@/workouts/progress';

export type MetricCardProps = {
  data: MetricData;
  system: MeasurementSystem;
  now: number;
  onPress: () => void;
  /** Smaller treatment for the metrics below the pinned ones. */
  compact?: boolean;
  testID?: string;
};

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const SPARKLINE_WIDTH = 92;

/**
 * One metric on the progress dashboard.
 *
 * The latest value is the headline; the sparkline says which way it is going
 * and the line underneath says when. Pressing it opens the full chart.
 */
export function MetricCard({
  data,
  system,
  now,
  onPress,
  compact = false,
  testID,
}: MetricCardProps) {
  const [scale] = useState(() => new Animated.Value(1));

  const measure = data.defaultMeasure;
  const all = data.series[measure] ?? [];
  const recent = filterByWindow(all, timeframeWindow('3M', now));
  const shown = recent.length >= 2 ? recent : all.slice(-12);
  const stats = summarize(recent.length > 0 ? recent : all);

  const value = stats ? formatMeasureValue(measure, stats.latest, system) : null;
  const change = stats?.change ?? null;

  const animateTo = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: 120,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: compact ? 1 : scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          value
            ? `${data.metric.name}, ${value.text} ${value.unit}, ${formatRelativeDate(
                stats?.latestAt ?? now,
                now
              )}`
            : `${data.metric.name}, no data`
        }
        onPress={onPress}
        onPressIn={() => {
          if (!compact) {
            animateTo(0.98);
          }
        }}
        onPressOut={() => {
          if (!compact) {
            animateTo(1);
          }
        }}
        style={({ pressed }) => [
          styles.card,
          compact ? styles.cardCompact : null,
          pressed ? styles.pressed : null,
        ]}
        testID={testID}>
        <View style={styles.textColumn}>
          <Text variant={compact ? 'subheading' : 'caption'} tone="textSecondary">
            {data.metric.name}
          </Text>

          <View style={styles.valueRow}>
            <Text variant={compact ? 'heading' : 'title'} numberOfLines={1}>
              {value ? value.text : '—'}
            </Text>
            {value ? (
              <Text variant="caption" tone="textTertiary" style={styles.unit}>
                {value.unit}
              </Text>
            ) : null}
          </View>

          <Text variant="caption" tone="textTertiary" numberOfLines={1}>
            {stats ? formatRelativeDate(stats.latestAt, now) : 'No entries yet'}
            {change && Math.abs(change) > 0.049 ? ` · ${formatChange(measure, change, system)}` : ''}
          </Text>
        </View>

        <View style={styles.sparkColumn}>
          <Sparkline
            values={shown.map((point) => point.value)}
            width={compact ? 64 : SPARKLINE_WIDTH}
            height={compact ? 28 : 40}
            testID={testID ? `${testID}-sparkline` : undefined}
          />
          {compact ? null : <Chevron direction="right" size={8} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardCompact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  textColumn: {
    flex: 1,
    gap: spacing.xxs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  unit: {
    marginBottom: 4,
  },
  sparkColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
