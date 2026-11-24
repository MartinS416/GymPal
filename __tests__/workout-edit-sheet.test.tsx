import { act, fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WorkoutEditSheet, type WorkoutEditSheetProps } from '@/components/workout-edit-sheet';
import type { SessionExercise } from '@/db/repositories/sessions';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderSheet(props: WorkoutEditSheetProps) {
  return await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <WorkoutEditSheet {...props} />
    </SafeAreaProvider>
  );
}

const mockExercises: SessionExercise[] = [
  {
    id: 1,
    sessionId: 1,
    workoutExerciseId: null,
    exerciseId: 101,
    position: 0,
    name: 'Bench Press',
    muscleGroup: 'chest',
    equipment: 'barbell',
    targetSets: 3,
    repRangeMin: 8,
    repRangeMax: 12,
    restSeconds: 90,
    status: 'completed',
  },
  {
    id: 2,
    sessionId: 1,
    workoutExerciseId: null,
    exerciseId: 102,
    position: 1,
    name: 'Incline Dumbbell Press',
    muscleGroup: 'chest',
    equipment: 'dumbbell',
    targetSets: 3,
    repRangeMin: 10,
    repRangeMax: 12,
    restSeconds: 60,
    status: 'pending',
  },
  {
    id: 3,
    sessionId: 1,
    workoutExerciseId: null,
    exerciseId: 103,
    position: 2,
    name: 'Tricep Pushdown',
    muscleGroup: 'triceps',
    equipment: 'cable',
    targetSets: 3,
    repRangeMin: 12,
    repRangeMax: 15,
    restSeconds: 60,
    status: 'pending',
  },
  {
    id: 4,
    sessionId: 1,
    workoutExerciseId: null,
    exerciseId: 104,
    position: 3,
    name: 'Lateral Raise',
    muscleGroup: 'shoulders',
    equipment: 'dumbbell',
    targetSets: 4,
    repRangeMin: 12,
    repRangeMax: 15,
    restSeconds: 60,
    status: 'pending',
  },
];

describe('WorkoutEditSheet queue reordering', () => {
  it('shows all exercises in a single flat list regardless of status', async () => {
    const { getByText } = await renderSheet({
      visible: true,
      onClose: jest.fn<() => void>(),
      exercises: mockExercises,
      currentPosition: 1,
      workoutTitle: 'Chest & Triceps',
      onAddExercise: jest.fn(),
      onReorder: jest.fn<(from: number, to: number) => void>(),
    });

    // All exercises appear — no section gating
    expect(getByText('Bench Press')).toBeTruthy();
    expect(getByText('Incline Dumbbell Press')).toBeTruthy();
    expect(getByText('Tricep Pushdown')).toBeTruthy();
    expect(getByText('Lateral Raise')).toBeTruthy();
  });

  it('every exercise has reorder controls; first row up and last row down are disabled', async () => {
    const { getByTestId } = await renderSheet({
      visible: true,
      onClose: jest.fn<() => void>(),
      exercises: mockExercises,
      currentPosition: 1,
      workoutTitle: 'Chest & Triceps',
      onAddExercise: jest.fn(),
      onReorder: jest.fn<(from: number, to: number) => void>(),
    });

    // All four exercises have both buttons
    for (const pos of [0, 1, 2, 3]) {
      expect(getByTestId(`move-up-${pos}`)).toBeTruthy();
      expect(getByTestId(`move-down-${pos}`)).toBeTruthy();
    }

    // First row: up disabled, down enabled
    expect(getByTestId('move-up-0').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('move-down-0').props.accessibilityState.disabled).toBe(false);

    // Last row: up enabled, down disabled
    expect(getByTestId('move-up-3').props.accessibilityState.disabled).toBe(false);
    expect(getByTestId('move-down-3').props.accessibilityState.disabled).toBe(true);

    // Middle rows: both enabled
    expect(getByTestId('move-up-1').props.accessibilityState.disabled).toBe(false);
    expect(getByTestId('move-down-1').props.accessibilityState.disabled).toBe(false);
  });

  it('invokes onReorder immediately when chevron buttons are pressed', async () => {
    const handleReorder = jest.fn<(from: number, to: number) => void>();

    const { getByTestId } = await renderSheet({
      visible: true,
      onClose: jest.fn<() => void>(),
      exercises: mockExercises,
      currentPosition: 1,
      workoutTitle: 'Chest & Triceps',
      onAddExercise: jest.fn(),
      onReorder: handleReorder,
    });

    // Move Tricep Pushdown (pos 2) down past Lateral Raise (pos 3)
    await act(async () => {
      fireEvent.press(getByTestId('move-down-2'));
    });
    expect(handleReorder).toHaveBeenCalledWith(2, 3);

    // Move Bench Press (pos 0, completed) down into the active position
    await act(async () => {
      fireEvent.press(getByTestId('move-down-0'));
    });
    expect(handleReorder).toHaveBeenCalledWith(0, 1);
  });

  it('closes the sheet when Done is pressed', async () => {
    const handleClose = jest.fn<() => void>();

    const { getByTestId } = await renderSheet({
      visible: true,
      onClose: handleClose,
      exercises: mockExercises,
      currentPosition: 1,
      workoutTitle: 'Chest & Triceps',
      onAddExercise: jest.fn(),
      onReorder: jest.fn<(from: number, to: number) => void>(),
    });

    await act(async () => {
      fireEvent.press(getByTestId('close-edit-sheet'));
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
