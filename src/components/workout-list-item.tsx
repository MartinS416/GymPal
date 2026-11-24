import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { WorkoutSummary } from '@/db/repositories/workouts';

export type WorkoutListItemProps = {
  workout: WorkoutSummary;
  onPress: () => void;
  /** Adds the plan the workout belongs to, for the list of everything. */
  showPlan?: boolean;
};

/** One workout in a list: its name and what it will take. */
export function WorkoutListItem({ workout, onPress, showPlan = false }: WorkoutListItemProps) {
  const exercises = `${workout.exerciseCount} exercise${workout.exerciseCount === 1 ? '' : 's'}`;
  const sets = `${workout.setCount} set${workout.setCount === 1 ? '' : 's'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${exercises}, ${sets}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={`workout-${workout.id}`}>
      <View style={styles.text}>
        <Text variant="bodyStrong">{workout.name}</Text>
        <Text variant="caption">
          {exercises} · {sets}
          {showPlan ? ` · ${workout.planName}` : ''}
        </Text>
      </View>
      <Chevron direction="right" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
