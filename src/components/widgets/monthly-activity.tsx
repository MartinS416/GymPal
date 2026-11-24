import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addMonths, dayOfMonth, formatMonth, monthGrid, startOfMonth } from '@/lib/calendar';
import { useHaptics } from '@/hooks/use-haptics';
import { useNow } from '@/hooks/use-now';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type MonthlyActivityProps = {
  /** Days the user trained, as start-of-day timestamps. */
  trainedDays: ReadonlySet<number>;
  /** How many months to render for scrolling. Defaults to six. */
  months?: number;
  /** The clock, injectable so tests can be deterministic. */
  now?: number;
  /** Called when a day is tapped. */
  onDayPress?: (day: number) => void;
};

/**
 * The trained day numbers of one month.
 */
export function trainedDaysInMonth(
  trainedDays: ReadonlySet<number>,
  monthStart: number
): Set<number> {
  const trainedNumbers = new Set<number>();
  for (const trained of Array.from(trainedDays)) {
    if (startOfMonth(trained) === monthStart) {
      trainedNumbers.add(new Date(trained).getDate());
    }
  }
  return trainedNumbers;
}

export const DOT_INACTIVE = colors.border;
export const DOT_ACTIVE = colors.text;

/**
 * A minimalist, horizontally scrollable workout calendar.
 *
 * Three (or more) months sit side by side inside a clean card matching the
 * app design tokens. Each month is a seven-column grid of small dots: a dot is
 * black when the user trained that day and muted border gray otherwise.
 * Scroll horizontally to move through months; tap a day to inspect it.
 */
export function MonthlyActivity({
  trainedDays,
  months = 6,
  now: nowProp,
  onDayPress,
}: MonthlyActivityProps) {
  const now = useNow();
  const clock = nowProp ?? now;
  const haptics = useHaptics();
  const monthStarts = Array.from({ length: months }, (_, index) => addMonths(clock, -index));

  return (
    <View style={styles.card}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={styles.scrollContent}>
        {monthStarts.map((monthStart) => {
          const trained = trainedDaysInMonth(trainedDays, monthStart);
          const cells = monthGrid(monthStart);

          return (
            <View key={monthStart} style={styles.month}>
              <Text style={styles.monthLabel}>{formatMonth(monthStart)}</Text>
              <View style={styles.grid}>
                {cells.map((day, index) => {
                  if (day === null) {
                    return <View key={`empty-${index}`} style={styles.cell} />;
                  }
                  const at = dayOfMonth(monthStart, day);
                  const isTrained = trained.has(day);
                  return (
                    <Pressable
                      key={`day-${day}`}
                      accessibilityRole="button"
                      accessibilityLabel={new Date(at).toDateString()}
                      onPress={() => {
                        haptics.tick();
                        onDayPress?.(at);
                      }}
                      hitSlop={4}
                      style={styles.cell}>
                      <View
                        testID={`monthly-activity-dot-${monthStart}-${day}`}
                        style={[styles.dot, isTrained ? styles.dotActive : styles.dotInactive]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    gap: spacing.base,
    paddingRight: spacing.xs,
  },
  month: {
    width: 150,
    gap: spacing.sm,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotInactive: {
    backgroundColor: DOT_INACTIVE,
  },
  dotActive: {
    backgroundColor: DOT_ACTIVE,
  },
});
