import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import {
  addMonths,
  dayOfMonth,
  formatMonth,
  isSameDay,
  monthGrid,
  startOfDay,
  startOfMonth,
  WEEKDAY_LABELS,
} from '@/lib/calendar';

export type DatePickerProps = {
  /** The selected day, as a timestamp. */
  value: number;
  onChange: (at: number) => void;
  /** Days after this are shown but cannot be picked. Defaults to today. */
  maximum?: number;
  testID?: string;
};

/**
 * A month grid, small enough to live inside a sheet.
 *
 * Dates are the one thing a user logs in the past, so the calendar shows a
 * whole month at once instead of making them step back one day at a time.
 * Today is ringed, the selection is filled, and the future is unavailable.
 */
export function DatePicker({ value, onChange, maximum, testID }: DatePickerProps) {
  const haptics = useHaptics();
  const [today] = useState(() => startOfDay(Date.now()));
  const max = startOfDay(maximum ?? today);

  const [month, setMonth] = useState(() => startOfMonth(value));

  const cells = monthGrid(month);
  const canGoForward = addMonths(month, 1) <= startOfMonth(max);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth((current) => addMonths(current, -1))}
          hitSlop={12}
          style={({ pressed }) => [styles.monthButton, pressed ? styles.pressed : null]}
          testID="calendar-previous">
          <Chevron direction="left" size={9} color="text" />
        </Pressable>

        <Text variant="subheading">{formatMonth(month)}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoForward}
          onPress={() => setMonth((current) => addMonths(current, 1))}
          hitSlop={12}
          style={({ pressed }) => [
            styles.monthButton,
            pressed ? styles.pressed : null,
            canGoForward ? null : styles.hidden,
          ]}
          testID="calendar-next">
          <Chevron direction="right" size={9} color="text" />
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.cell}>
            <Text variant="caption" tone="textTertiary" style={styles.weekday}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }

          const at = dayOfMonth(month, day);
          const selected = isSameDay(at, value);
          const isToday = isSameDay(at, today);
          const disabled = at > max;

          return (
            <View key={`day-${day}`} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={new Date(at).toDateString()}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => {
                  haptics.tick();
                  onChange(at);
                }}
                style={({ pressed }) => [
                  styles.day,
                  isToday && !selected ? styles.today : null,
                  selected ? styles.selected : null,
                  pressed && !selected ? styles.pressed : null,
                ]}
                testID={`calendar-day-${day}`}>
                <Text
                  variant="body"
                  tone={disabled ? 'textTertiary' : selected ? 'textOnInverted' : 'text'}
                  style={selected ? styles.selectedLabel : null}>
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  monthButton: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    opacity: 0,
  },
  pressed: {
    opacity: 0.5,
  },
  weekdays: {
    flexDirection: 'row',
  },
  weekday: {
    fontSize: 10,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  selected: {
    backgroundColor: colors.inverted,
  },
  selectedLabel: {
    fontWeight: '600',
  },
});
