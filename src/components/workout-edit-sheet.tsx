import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Chevron } from '@/components/chevron';
import { ExercisePicker } from '@/components/exercise-picker';
import { Text } from '@/components/text';
import { useHaptics } from '@/hooks/use-haptics';
import { colors, radius, spacing } from '@/constants/theme';
import type { SessionExercise } from '@/db/repositories/sessions';
import type { Exercise } from '@/db/repositories/exercises';

export type WorkoutEditSheetProps = {
  visible: boolean;
  onClose: () => void;
  exercises: SessionExercise[];
  /** The position of the exercise the session is currently on (-1 if none). */
  currentPosition: number;
  workoutTitle: string | null;
  onAddExercise: (exercise: Exercise) => void;
  onReorder: (fromPosition: number, toPosition: number) => void | Promise<void>;
};

type ExerciseRowProps = {
  exercise: SessionExercise;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  isReordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function ExerciseRow({
  exercise,
  isCurrent,
  isFirst,
  isLast,
  isReordering,
  onMoveUp,
  onMoveDown,
}: ExerciseRowProps) {
  const isDone = exercise.status === 'completed' || exercise.status === 'skipped';

  const subtitle = isDone
    ? exercise.status === 'skipped'
      ? 'Skipped'
      : 'Completed'
    : exercise.targetSets > 0
      ? `${exercise.targetSets} sets · ${exercise.repRangeMin}–${exercise.repRangeMax} reps`
      : 'No target sets';

  return (
    <View
      style={[
        styles.row,
        isCurrent ? styles.rowCurrent : null,
        isDone ? styles.rowCompleted : null,
      ]}>
      <View style={styles.rowContent}>
        <View style={styles.nameRow}>
          <Text
            variant="bodyStrong"
            style={[
              styles.rowName,
              isCurrent ? styles.rowNameCurrent : null,
              isDone ? styles.rowNameDone : null,
            ]}
            numberOfLines={2}>
            {exercise.name}
          </Text>
          {isCurrent ? (
            <View style={styles.activeBadge}>
              <Text variant="caption" style={styles.activeBadgeText}>
                ACTIVE
              </Text>
            </View>
          ) : null}
          {isDone ? (
            <Text variant="caption" tone="textTertiary" style={styles.checkmark}>
              ✓
            </Text>
          ) : null}
        </View>
        <Text
          variant="caption"
          style={isCurrent ? styles.rowCaptionCurrent : styles.rowCaption}>
          {subtitle}
        </Text>
      </View>

      <View
        style={styles.reorderPill}
        testID={`reorder-handle-${exercise.position}`}
        accessibilityLabel={`Reorder controls for ${exercise.name}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${exercise.name} up`}
          accessibilityHint="Moves this exercise earlier in the queue"
          accessibilityState={{ disabled: isFirst }}
          disabled={isFirst || isReordering}
          onPress={onMoveUp}
          hitSlop={6}
          style={({ pressed }) => [
            styles.reorderButton,
            isFirst ? styles.reorderButtonDisabled : null,
            pressed ? styles.reorderButtonPressed : null,
          ]}
          testID={`move-up-${exercise.position}`}>
          <Chevron
            direction="up"
            size={7}
            weight={2}
            color={isFirst ? 'textTertiary' : isCurrent ? 'textOnInverted' : 'text'}
          />
        </Pressable>

        <View style={[styles.reorderDivider, isCurrent ? styles.reorderDividerInverted : null]} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${exercise.name} down`}
          accessibilityHint="Moves this exercise later in the queue"
          accessibilityState={{ disabled: isLast }}
          disabled={isLast || isReordering}
          onPress={onMoveDown}
          hitSlop={6}
          style={({ pressed }) => [
            styles.reorderButton,
            isLast ? styles.reorderButtonDisabled : null,
            pressed ? styles.reorderButtonPressed : null,
          ]}
          testID={`move-down-${exercise.position}`}>
          <Chevron
            direction="down"
            size={7}
            weight={2}
            color={isLast ? 'textTertiary' : isCurrent ? 'textOnInverted' : 'text'}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function WorkoutEditSheet({
  visible,
  onClose,
  exercises,
  currentPosition,
  workoutTitle,
  onAddExercise,
  onReorder,
}: WorkoutEditSheetProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const haptics = useHaptics();

  /** All exercises sorted by position — no sectioning, fully reorderable. */
  const sorted = useMemo(
    () => [...exercises].sort((a, b) => a.position - b.position),
    [exercises]
  );

  const handleMove = useCallback(
    async (fromPosition: number, toPosition: number) => {
      if (reordering) {
        return;
      }
      setReordering(true);
      haptics.tick();
      try {
        await onReorder(fromPosition, toPosition);
      } finally {
        setReordering(false);
      }
    },
    [reordering, haptics, onReorder]
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={workoutTitle ?? 'Workout Queue'}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        <Text variant="caption" tone="textTertiary" style={styles.hint}>
          Tap ▲ and ▼ to reorder exercises. Changes apply immediately.
        </Text>

        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text variant="caption" tone="textTertiary">
              No exercises yet. Add one below.
            </Text>
          </View>
        ) : (
          sorted.map((exercise, index) => (
            <ExerciseRow
              key={`${exercise.sessionId}-${exercise.position}-${exercise.exerciseId}`}
              exercise={exercise}
              isCurrent={exercise.position === currentPosition}
              isFirst={index === 0}
              isLast={index === sorted.length - 1}
              isReordering={reordering}
              onMoveUp={() => {
                const target = sorted[index - 1];
                if (target) {
                  void handleMove(exercise.position, target.position);
                }
              }}
              onMoveDown={() => {
                const target = sorted[index + 1];
                if (target) {
                  void handleMove(exercise.position, target.position);
                }
              }}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.footerActions}>
        <Button
          label="Add exercise"
          variant="secondary"
          size="md"
          onPress={() => setPickerOpen(true)}
          testID="add-exercise-sheet"
          style={styles.actionBtn}
        />
        <Button
          label="Done"
          size="md"
          onPress={onClose}
          testID="close-edit-sheet"
          style={styles.actionBtn}
        />
      </View>

      {pickerOpen ? (
        <ExercisePicker
          visible={pickerOpen}
          excludeIds={exercises.map((e) => e.exerciseId)}
          onClose={() => setPickerOpen(false)}
          onSelect={(exercise) => {
            setPickerOpen(false);
            onAddExercise(exercise);
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 440,
  },
  listContent: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  hint: {
    paddingVertical: spacing.xxs,
    paddingBottom: spacing.sm,
  },
  emptyCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  rowCurrent: {
    backgroundColor: colors.inverted,
    borderColor: colors.inverted,
  },
  rowCompleted: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.75,
  },
  rowContent: {
    flex: 1,
    gap: spacing.xxs,
    paddingRight: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowName: {
    color: colors.text,
    flexShrink: 1,
  },
  rowNameCurrent: {
    color: colors.textOnInverted,
  },
  rowNameDone: {
    textDecorationLine: 'line-through',
  },
  rowCaption: {
    color: colors.textSecondary,
  },
  rowCaptionCurrent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOnInverted,
    letterSpacing: 0.4,
  },
  reorderPill: {
    width: 36,
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  reorderButton: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonPressed: {
    backgroundColor: colors.border,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  reorderDivider: {
    width: 20,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  reorderDividerInverted: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
