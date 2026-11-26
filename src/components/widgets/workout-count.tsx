import { Pressable, StyleSheet } from 'react-native';

import { Chevron } from '@/components/chevron';
import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useWorkoutCount } from '@/hooks/use-workout-count';

/**
 * The lift count above the calendar.
 *
 * Reads as one sentence ("3 lifts this week") and taps through week, month,
 * year and lifetime. The chevron is the only affordance; the row has no card
 * so the calendar stays the focus of the screen.
 */
export function WorkoutCount() {
  const haptics = useHaptics();
  const { count, loading, label, cycle } = useWorkoutCount();
  const noun = count === 1 ? 'lift' : 'lifts';

  return (
    <Pressable
      testID="home-lift-count"
      accessibilityRole="button"
      accessibilityLabel={
        loading
          ? 'Loading lift count'
          : `${count} ${noun} ${label}. Tap to change the period.`
      }
      accessibilityHint="Switches between this week, this month, this year and lifetime."
      onPress={() => {
        haptics.tick();
        cycle();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      <Text variant="heading" numberOfLines={1} style={styles.label}>
        {loading ? '—' : count} {noun} {label}
      </Text>
      <Chevron direction="down" size={10} color="textTertiary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    letterSpacing: -0.2,
  },
});
