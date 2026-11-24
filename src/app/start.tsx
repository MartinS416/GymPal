import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { WorkoutListItem } from '@/components/workout-list-item';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useProfile } from '@/state/profile-context';
import { formatSessionDate } from '@/workouts/timer';

/**
 * Start a workout.
 *
 * The workouts the user has built, newest plan last, ready to pick. If there
 * are none yet, the way forward is to build one; if a session is already
 * running, that session is the way forward instead.
 */
export default function StartScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();

  const loader = useCallback(async () => {
    const [workouts, active] = await Promise.all([
      database.listWorkouts(),
      database.getActiveSession(),
    ]);
    return { workouts, activeSession: active };
  }, [database]);

  const { data, loading, reload } = useAsyncData(loader);
  useRefreshOnFocus(reload);

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const workouts = data?.workouts ?? [];
  const activeSession = data?.activeSession ?? null;

  return (
    <Screen
      footer={
        !activeSession && !loading && workouts.length === 0 ? (
          <Button
            label="Create a workout"
            onPress={() => router.push('/plans/new?returnTo=start')}
            testID="start-create"
          />
        ) : null
      }>
      <BackButton onPress={() => router.back()} testID="start-back" />

      <View style={styles.header}>
        <ScreenHeader title="Start a workout" />
      </View>

      <View style={styles.body}>
        {activeSession ? (
          <View style={styles.resume}>
            <View style={styles.resumeText}>
              <Text variant="subheading">Workout in progress</Text>
              <Text variant="caption">
                {activeSession.title ?? 'Workout'} · started{' '}
                {formatSessionDate(activeSession.startedAt)}
              </Text>
            </View>
            <Button
              label="Resume workout"
              onPress={() => router.replace(`/session/${activeSession.id}`)}
              testID="start-resume"
            />
          </View>
        ) : loading ? (
          <LoadingState lines={3} />
        ) : workouts.length === 0 ? (
          <EmptyState
            title="No workouts yet"
            description="Build one and it will be ready to start."
          />
        ) : (
          <View style={styles.list}>
            {workouts.map((workout) => (
              <WorkoutListItem
                key={workout.id}
                workout={workout}
                onPress={() => router.push(`/workouts/${workout.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
  },
  body: {
    marginTop: spacing.xl,
  },
  list: {
    gap: spacing.sm,
  },
  resume: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text,
    gap: spacing.base,
  },
  resumeText: {
    gap: spacing.xs,
  },
});
