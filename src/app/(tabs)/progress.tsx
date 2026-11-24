import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { Button } from '@/components/button';
import { LoadingScreen } from '@/components/loading-screen';
import { MetricCard } from '@/components/metric-card';
import { MetricPickerSheet } from '@/components/metric-picker-sheet';
import { ProgressEntrySheet } from '@/components/progress-entry-sheet';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import { useHaptics } from '@/hooks/use-haptics';
import { useProgressSnapshot } from '@/hooks/use-progress-snapshot';
import type { ProgressSnapshot } from '@/hooks/use-progress-snapshot';
import { useProfile } from '@/state/profile-context';
import {
  BODY_WEIGHT_KEY,
  resolvePinnedMetrics,
  type Metric,
  type MetricData,
} from '@/workouts/progress';

const BODY_WEIGHT: Metric = {
  key: BODY_WEIGHT_KEY,
  kind: 'body',
  exerciseId: null,
  name: 'Body weight',
  detail: null,
  measures: ['weight'],
};

/**
 * Progress.
 *
 * Everything the user has done, on one page: body weight, and every exercise
 * they have logged, derived from the finished sessions. Pinned metrics sit on
 * top; the rest follow.
 */
export default function ProgressTab() {
  const router = useRouter();
  const database = useDatabase();
  const haptics = useHaptics();
  const { status, profile } = useProfile();

  const [pinnedEdit, setPinnedEdit] = useState<{
    snapshot: ProgressSnapshot;
    keys: string[];
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);

  const { data, loading, reload } = useProgressSnapshot();
  const now = data?.now ?? 0;

  const applyPinned = (keys: string[]) => {
    if (data) {
      // Shown immediately; the next reload replaces this with the stored list.
      setPinnedEdit({ snapshot: data, keys });
    }
    void database.savePinnedMetrics(keys).catch(() => {
      reload();
    });
  };

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const metrics = data?.metrics ?? [];
  const hasData = metrics.some((entry) => Object.keys(entry.series).length > 0);
  const resolved = data ? resolvePinnedMetrics(data.preferences, data.metrics) : [];
  const pinned = pinnedEdit && pinnedEdit.snapshot === data ? pinnedEdit.keys : resolved;
  const pinnedMetrics = pinned
    .map((key) => metrics.find((entry) => entry.metric.key === key))
    .filter((entry): entry is MetricData => Boolean(entry));
  const otherMetrics = metrics.filter((entry) => !pinned.includes(entry.metric.key));
  const bodyMetric = metrics.find((entry) => entry.metric.key === BODY_WEIGHT_KEY)?.metric ?? BODY_WEIGHT;

  return (
    <Screen
      bottomInset={0}
      footer={
        <Button
          label="Log weight"
          onPress={() => setEntryOpen(true)}
          testID="log-weight"
        />
      }>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ScreenHeader title="Progress" subtitle="Weight and strength, over time." />
        </View>
        {hasData ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit metrics"
            onPress={() => setPickerOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.edit, pressed ? styles.pressed : null]}
            testID="edit-metrics">
            <Text variant="label">Edit</Text>
          </Pressable>
        ) : null}
      </View>

      {loading && !data ? (
        <LoadingState lines={3} />
      ) : metrics.length === 0 || !hasData ? (
        <EmptyState
          title="Nothing to track yet"
          description="Log your weight, or finish a workout, and it will show up here."
        />
      ) : (
        <View style={styles.sections}>
          <View style={styles.list}>
            {pinnedMetrics.map((entry) => (
              <MetricCard
                key={entry.metric.key}
                data={entry}
                system={profile.system}
                now={now}
                onPress={() => {
                  haptics.tap();
                  router.push({
                    pathname: '/progress/[metricKey]',
                    params: { metricKey: entry.metric.key },
                  });
                }}
                testID={`metric-${entry.metric.key}`}
              />
            ))}
          </View>

          {otherMetrics.length > 0 ? (
            <View style={styles.list}>
              <Text variant="caption" tone="textTertiary" style={styles.sectionLabel}>
                {pinnedMetrics.length > 0 ? 'All metrics' : 'Metrics'}
              </Text>
              {otherMetrics.map((entry) => (
                <MetricCard
                  key={entry.metric.key}
                  data={entry}
                  system={profile.system}
                  now={now}
                  compact
                  onPress={() => {
                    haptics.tap();
                    router.push({
                      pathname: '/progress/[metricKey]',
                      params: { metricKey: entry.metric.key },
                    });
                  }}
                  testID={`metric-${entry.metric.key}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}

      <MetricPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        metrics={metrics}
        pinned={pinned}
        onChange={applyPinned}
      />

      <ProgressEntrySheet
        visible={entryOpen}
        onClose={() => setEntryOpen(false)}
        metric={bodyMetric}
        system={profile.system}
        entry={null}
        onSave={async (input) => {
          await database.addProgressEntry({
            kind: 'body_weight',
            valueKg: input.valueKg,
            recordedAt: input.recordedAt,
            note: input.note,
          });
          haptics.success();
          reload();
        }}
        testID="log-weight-sheet"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
  },
  headerText: {
    flex: 1,
  },
  edit: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  sections: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingBottom: spacing.xxs,
  },
});
