import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useWorkoutCount } from '@/hooks/use-workout-count';

/**
 * A compact widget showing how many workouts landed in the selected period.
 *
 * Half the footprint of the activity calendar. Tap to cycle the period through
 * week, month and year. Follows the app's clean monochrome palette.
 */
export function WorkoutCount() {
  const haptics = useHaptics();
  const { count, loading, label, cycle } = useWorkoutCount();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} workouts ${label}. Tap to change period.`}
      onPress={() => {
        haptics.tick();
        cycle();
      }}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={styles.row}>
        <Text variant="display" tone="text" style={styles.number}>
          {loading ? '—' : count}
        </Text>
        <Chevron direction="down" size={10} color="textTertiary" />
      </View>
      <Text variant="eyebrow" tone="textSecondary" style={styles.label}>
        {label}
      </Text>
      <Text variant="caption" tone="textTertiary" style={styles.hint}>
        tap to change
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  number: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  label: {
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 10,
    lineHeight: 12,
  },
});
