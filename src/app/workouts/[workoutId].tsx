import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Card, Divider } from '@/components/card';

import { LoadingScreen } from '@/components/loading-screen';
import { MuscleChips, MuscleDiagram } from '@/components/muscle-diagram';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/states';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import type { WorkoutSession } from '@/db/repositories/sessions';

import { useAsyncData } from '@/hooks/use-async-data';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useProfile } from '@/state/profile-context';
import { muscleSummary, musclesForWorkout } from '@/workouts/muscles';
import { formatRestDuration, formatSessionDate } from '@/workouts/timer';

/**
 * The workout overview.
 *
 * What the session will look like: every exercise with its targets, and the
 * button that starts it. Picking a workout to train ends here, so the last
 * thing before the workout begins is a clear look at what it contains.
 */
export default function WorkoutOverviewScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const [starting, setStarting] = useState(false);

  const loader = useCallback(async () => {
    const id = Number(workoutId);
    if (!workoutId || Number.isNaN(id)) {
      return { workout: null, activeSession: null };
    }
    try {
      const [found, active] = await Promise.all([
        database.getWorkout(id),
        database.getActiveSession(),
      ]);
      return { workout: found, activeSession: active };
    } catch (error) {
      console.error('getWorkout failed', error);
      return { workout: null, activeSession: null };
    }
  }, [database, workoutId]);

  const { data, loading, reload } = useAsyncData(loader);
  useRefreshOnFocus(reload);

  const handleStart = async () => {
    if (!data?.workout) {
      return;
    }
    setStarting(true);
    try {
      const session = await database.startSession({
        workoutId: data.workout.id,
        planId: data.workout.planId,
        title: data.workout.name,
      });
      // Pushed, not replaced: backing out of the session returns to the
      // workout, which then offers to resume it.
      router.push(`/session/${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const workout = data?.workout ?? null;
  const activeSession: WorkoutSession | null = data?.activeSession ?? null;

  if (loading && !workout) {
    return <LoadingScreen label="Opening the workout" />;
  }

  if (!workout || Number.isNaN(Number(workoutId))) {
    return (
      <Screen>
        <BackButton />
        <View style={styles.missing}>
          <EmptyState
            title="Workout not found"
            description="It may have been removed from the plan."
          />
        </View>
      </Screen>
    );
  }

  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
  const exerciseCount = workout.exercises.length;
  const muscles = musclesForWorkout(workout.exercises);

  return (
    <Screen
      footer={
        workout.exercises.length === 0 ? null : activeSession ? (
          <Button
            label="Resume workout"
            onPress={() => router.replace(`/session/${activeSession.id}`)}
            testID="workout-resume"
          />
        ) : (
          <Button
            label="Start workout"
            onPress={handleStart}
            loading={starting}
            testID="workout-start"
          />
        )
      }>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} testID="workout-back" />
        <Button
          label="Edit"
          variant="ghost"
          size="md"
          onPress={() => router.push(`/plans/${workout.planId}?workout=${workout.position}`)}
          testID="workout-edit"
        />
      </View>

      <View style={styles.header}>
        <ScreenHeader
          title={workout.name}
          subtitle={`${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} · ${totalSets} set${
            totalSets === 1 ? '' : 's'
          }`}
        />
      </View>

      {activeSession ? (
        <View style={styles.resume}>
          <Text variant="subheading">Workout in progress</Text>
          <Text variant="caption">Started {formatSessionDate(activeSession.startedAt)}.</Text>
        </View>
      ) : null}

      {muscles.length > 0 ? (
        <Card style={styles.muscleCard}>
          <Text variant="eyebrow">Muscles worked</Text>
          <MuscleDiagram muscles={muscles} />
          <MuscleChips muscles={muscles} />
        </Card>
      ) : null}

      <View style={styles.exercises}>
        {workout.exercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            description="Add exercises to this workout in the plan builder."
          />
        ) : (
          workout.exercises.map((exercise, index) => (
            <Card key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text variant="label" tone="textTertiary">
                  {index + 1}
                </Text>
                <View style={styles.exerciseText}>
                  <Text variant="bodyStrong">{exercise.name}</Text>
                  <Text variant="caption">
                    {exercise.muscleGroup} · {exercise.equipment}
                  </Text>
                  <Text variant="caption" tone="textTertiary">
                    {muscleSummary(exercise)}
                  </Text>
                </View>
              </View>
              <Divider style={styles.divider} />
              <View style={styles.targets}>
                <Text variant="caption">
                  {exercise.targetSets} × {exercise.repRangeMin}–{exercise.repRangeMax} reps
                </Text>
                <Text variant="caption" tone="textTertiary">
                  rest {formatRestDuration(exercise.restSeconds)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  header: {
    marginTop: spacing.lg,
  },
  missing: {
    marginTop: spacing.xxxl,
  },
  resume: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text,
    gap: spacing.sm,
  },
  muscleCard: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  exercises: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  exerciseCard: {
    gap: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    marginVertical: spacing.xs,
  },
  targets: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
});
