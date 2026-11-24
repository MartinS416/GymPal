import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Divider } from '@/components/card';
import { MonthlyActivity } from '@/components/widgets/monthly-activity';
import { WorkoutCount } from '@/components/widgets/workout-count';
import { Highlights } from '@/components/widgets/highlights';
import { OptionsMenu } from '@/components/options-menu';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { formatHeight, formatWeight } from '@/lib/units';
import { formatLongDate, startOfDay } from '@/lib/calendar';
import { useAsyncData } from '@/hooks/use-async-data';
import { useDatabase } from '@/db/database-provider';
import { useProfile } from '@/state/profile-context';
import { useTrainedDays } from '@/hooks/use-trained-days';

/**
 * Home.
 *
 * Four things only: the name, a greeting, the measurements from onboarding and
 * the button that starts a workout. Everything else lives behind the "..."
 * menu, which slides its options in from the right. Under that: the last few
 * months of training as a strip of dots.
 */
export default function HomeTab() {
  const router = useRouter();
  const database = useDatabase();
  const { profile } = useProfile();
  const { days, loading } = useTrainedDays();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const dayLoader = useCallback(async () => {
    if (selectedDay === null) return [];
    const sessions = await database.listSessions({ limit: 100 });
    return sessions.filter((session) => startOfDay(session.startedAt) === selectedDay);
  }, [database, selectedDay]);
  const { data: daySessions, loading: dayLoading } = useAsyncData(dayLoader);

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <Screen
      bottomInset={0}
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

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text variant="eyebrow">Height</Text>
          <Text variant="metric">{formatHeight(profile.heightCm, profile.system)}</Text>
        </View>
        <Divider style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text variant="eyebrow">Weight</Text>
          <Text variant="metric">{formatWeight(profile.weightKg, profile.system)}</Text>
        </View>
      </View>

      {loading ? null : (
        <View style={styles.activity}>
          <MonthlyActivity trainedDays={new Set(days)} onDayPress={(day) => setSelectedDay(day)} />
          <View style={styles.widgetRow}>
            <WorkoutCount />
            <Highlights />
          </View>
        </View>
      )}

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
  summary: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  summaryItem: {
    gap: spacing.xs,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
  },
  activity: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  widgetRow: {
    flexDirection: 'row',
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
