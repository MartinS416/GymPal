import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { Chevron } from '@/components/chevron';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useProfile } from '@/state/profile-context';
import { formatDuration, formatSessionDate, formatTimeOfDay } from '@/workouts/timer';

/**
 * The workout history.
 *
 * Every session that was started on this device, newest first.
 */
export default function HistoryTab() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();

  const loader = useCallback(
    () => database.listSessions({ limit: 100 }),
    [database]
  );
  const { data: sessions, loading, reload } = useAsyncData(loader);
  useRefreshOnFocus(reload);

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const items = sessions ?? [];

  return (
    <Screen bottomInset={0}>
      <ScreenHeader title="Workout history" subtitle="Everything you have completed" />

      <View style={styles.list}>
        {loading ? (
          <LoadingState lines={3} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No workouts logged"
            description="Completed sessions are kept here so you can look back."
          />
        ) : (
          items.map((session) => (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={`${session.title ?? 'Workout'}, ${formatSessionDate(session.startedAt)}, ${formatDuration(session.durationSeconds ?? 0)}`}
              onPress={() => router.push(`/sessions/${session.id}`)}
              style={({ pressed }) => [styles.session, pressed ? styles.sessionPressed : null]}
              testID={`session-${session.id}`}>
              <View style={styles.sessionText}>
                <Text variant="bodyStrong">{session.title ?? 'Workout'}</Text>
                <Text variant="caption">
                  {formatSessionDate(session.startedAt)} · {formatTimeOfDay(session.startedAt)}
                </Text>
                <Text variant="caption" tone="textTertiary">
                  {session.setsLogged} sets
                  {session.status === 'in_progress' ? ' · in progress' : ''}
                  {session.status === 'abandoned' ? ' · abandoned' : ''}
                </Text>
              </View>
              <View style={styles.sessionMeta}>
                <Text variant="label">{formatDuration(session.durationSeconds ?? 0)}</Text>
                <Chevron direction="right" />
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  session: {
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
  sessionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  sessionText: {
    flex: 1,
    gap: 2,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
