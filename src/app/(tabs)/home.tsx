import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { MonthlyActivity } from '@/components/widgets/monthly-activity';
import { WorkoutCount } from '@/components/widgets/workout-count';
import { WorkoutFeedCard } from '@/components/workout-feed-card';
import { OptionsMenu } from '@/components/options-menu';
import { Screen } from '@/components/screen';
import { EmptyState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { formatLongDate, startOfDay } from '@/lib/calendar';
import { useAsyncData } from '@/hooks/use-async-data';
import { useDatabase } from '@/db/database-provider';
import { useProfile } from '@/state/profile-context';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useTrainedDays } from '@/hooks/use-trained-days';
import { useWorkoutFeed } from '@/hooks/use-workout-feed';

/**
 * Home.
 *
 * The name, a greeting, the week's lift count and the training calendar, then
 * the feed of finished workouts, with the button that starts a workout pinned
 * below. The feed starts with ten sessions and appends more as the screen is
 * scrolled. Everything else lives behind the "..." menu.
 */
export default function HomeTab() {
  const router = useRouter();
  const database = useDatabase();
  const { profile } = useProfile();
  const { days, loading } = useTrainedDays();
  const {
    items: feed,
    loading: feedLoading,
    loadingMore,
    error: feedError,
    loadMore,
    reload: reloadFeed,
  } = useWorkoutFeed();
  useRefreshOnFocus(reloadFeed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const dayLoader = useCallback(async () => {
    if (selectedDay === null) return [];
    const sessions = await database.listSessions({ limit: 100 });
    return sessions.filter((session) => startOfDay(session.startedAt) === selectedDay);
  }, [database, selectedDay]);
  const { data: daySessions, loading: dayLoading } = useAsyncData(dayLoader);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 240) {
        loadMore();
      }
    },
    [loadMore]
  );

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <Screen
      bottomInset={0}
      onScroll={handleScroll}
      testID="home-scroll"
      footer={
        <Button
          label="Start workout"
          onPress={() => router.push('/start')}
          testID="home-start-workout"
        />
      }>
      {menuOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close options"
          onPress={closeMenu}
          style={styles.backdrop}
          testID="home-menu-backdrop"
        />
      ) : null}

      <View style={styles.header}>
        <Text variant="title" style={styles.brand}>
          GymPal
        </Text>
        <OptionsMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((open) => !open)}
          options={[
            {
              label: 'Your workouts',
              testID: 'home-menu-workouts',
              onPress: () => {
                closeMenu();
                router.push('/workouts');
              },
            },
            {
              label: 'New workout',
              testID: 'home-menu-new',
              onPress: () => {
                closeMenu();
                router.push('/plans/new?returnTo=workouts');
              },
            },
          ]}
        />
      </View>

      <View style={styles.greeting}>
        <Text variant="title">Hello, {profile.name}</Text>
      </View>

      {loading ? null : (
        <View style={styles.activity}>
          <WorkoutCount />
          <MonthlyActivity trainedDays={new Set(days)} onDayPress={(day) => setSelectedDay(day)} />
        </View>
      )}

      <View style={styles.feed} testID="home-feed">
        <Text variant="heading">Workout feed</Text>

        {feedLoading ? (
          <LoadingState lines={3} />
        ) : feed.length === 0 ? (
          <EmptyState
            title="No workouts yet"
            description="Finished workouts will appear here."
            compact
          />
        ) : (
          <View style={styles.feedList}>
            {feed.map((session) => (
              <WorkoutFeedCard
                key={session.id}
                session={session}
                profileName={profile.name}
                onPress={() => router.push(`/sessions/${session.id}`)}
              />
            ))}
          </View>
        )}

        {loadingMore ? (
          <Text variant="caption" tone="textTertiary" align="center" testID="feed-loading-more">
            Loading more…
          </Text>
        ) : null}
        {feedError ? (
          <Text variant="caption" tone="danger" align="center">
            Some workouts could not be loaded.
          </Text>
        ) : null}
      </View>

      <BottomSheet
        visible={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatLongDate(selectedDay) : undefined}
        testID="day-detail">
        {dayLoading ? (
          <Text variant="caption" tone="textTertiary">
            Loading…
          </Text>
        ) : (daySessions ?? []).length === 0 ? (
          <Text variant="caption" tone="textTertiary">
            No workouts logged this day.
          </Text>
        ) : (
          <View style={styles.dayList}>
            {(daySessions ?? []).map((session) => (
              <Pressable
                key={session.id}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedDay(null);
                  router.push(`/sessions/${session.id}`);
                }}
                style={({ pressed }) => [styles.daySession, pressed ? styles.daySessionPressed : null]}
                testID={`day-session-${session.id}`}>
                <View style={styles.daySessionText}>
                  <Text variant="bodyStrong">{session.title ?? 'Workout'}</Text>
                  <Text variant="caption" tone="textTertiary">
                    {session.setsLogged} sets
                    {session.status === 'in_progress' ? ' · in progress' : ''}
                    {session.status === 'abandoned' ? ' · abandoned' : ''}
                  </Text>
                </View>
                <Text variant="label">{session.durationSeconds ? `${Math.round(session.durationSeconds / 60)} min` : ''}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    // Washes the greeting back while the menu is open, so the options read as
    // the only thing in focus.
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  header: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    zIndex: 20,
  },
  brand: {
    flexShrink: 1,
  },
  greeting: {
    marginTop: spacing.xxl,
  },
  activity: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  feed: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  feedList: {
    gap: spacing.md,
  },
  dayList: {
    gap: spacing.sm,
  },
  daySession: {
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
  daySessionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  daySessionText: {
    flex: 1,
    gap: 2,
  },
});
