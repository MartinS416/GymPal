import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState, LoadingState } from '@/components/states';
import { WorkoutListItem } from '@/components/workout-list-item';
import { spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useProfile } from '@/state/profile-context';

/**
 * The workouts the user has built.
 *
 * Reached from the home menu. Every workout lives on this device, encrypted,
 * and opens its own overview from here.
 */
export default function WorkoutsScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();

  const loader = useCallback(() => database.listWorkouts(), [database]);
  const { data, loading, reload } = useAsyncData(loader);
  useRefreshOnFocus(reload);

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const workouts = data ?? [];

  return (
    <Screen
      footer={
        <Button
          label="New workout"
          onPress={() => router.push('/plans/new?returnTo=workouts')}
          testID="workouts-new"
        />
      }>
      <BackButton onPress={() => router.back()} testID="workouts-back" />

      <View style={styles.header}>
        <ScreenHeader title="Your workouts" />
      </View>

      <View style={styles.list}>
        {loading ? (
          <LoadingState lines={3} />
        ) : workouts.length === 0 ? (
          <EmptyState
            title="Nothing built yet"
            description="Your workouts will be listed here once you create one."
          />
        ) : (
          workouts.map((workout) => (
            <WorkoutListItem
              key={workout.id}
              workout={workout}
              showPlan
              onPress={() => router.push(`/workouts/${workout.id}`)}
            />
          ))
        )}
      </View>

      <View style={styles.privacy}>
        <Button
          label="Privacy & local data"
          variant="ghost"
          size="md"
          onPress={() => router.push('/privacy')}
          testID="workouts-privacy"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  privacy: {
    marginTop: spacing.xxl,
    alignItems: 'flex-start',
  },
});
