import { useCallback, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { LoadingScreen } from '@/components/loading-screen';
import { ProgressChart } from '@/components/progress-chart';
import { ProgressEntrySheet } from '@/components/progress-entry-sheet';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/states';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { Text } from '@/components/text';
import { TimeframeChips } from '@/components/timeframe-chips';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import { useHaptics } from '@/hooks/use-haptics';
import { useProgressSnapshot } from '@/hooks/use-progress-snapshot';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { formatLongDate, formatRelativeDate } from '@/lib/calendar';
import { useProfile } from '@/state/profile-context';
import {
  filterByWindow,
  formatAxisValue,
  formatChange,
  formatMeasureValue,
  isZoomed,
  measureUnit,
  MEASURE_LABELS,
  shiftTimeframe,
  summarize,
  timeframeWindow,
  TIMEFRAMES,
  type Measure,
  type SeriesPoint,
  type Timeframe,
  type TimeWindow,
} from '@/workouts/progress';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * One metric, expanded.
 *
 * The value and the date on top, the chart in the middle, and every entry that
 * made the line underneath. Swiping the header moves through the ranges; one
 * finger on the chart reads it, two fingers zoom it.
 */
export default function ProgressDetailScreen() {
  const params = useLocalSearchParams<{ metricKey?: string }>();
  const metricKey = typeof params.metricKey === 'string' ? params.metricKey : '';

  const database = useDatabase();
  const haptics = useHaptics();
  const { status, profile } = useProfile();
  const { data, loading, reload } = useProgressSnapshot();

  const [measureChoice, setMeasureChoice] = useState<Measure | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('3M');
  const [chartWindow, setChartWindow] = useState<TimeWindow | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<{
    id: number;
    valueKg: number;
    recordedAt: number;
    note: string | null;
  } | null>(null);

  const [fade] = useState(() => new Animated.Value(1));
  const [shift] = useState(() => new Animated.Value(0));

  const animate = useCallback(
    (direction: -1 | 1) => {
      fade.setValue(0);
      shift.setValue(direction * 24);
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(shift, {
          toValue: 0,
          duration: 220,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    },
    [fade, shift]
  );

  const goTimeframe = useCallback(
    (direction: -1 | 1) => {
      const next = shiftTimeframe(timeframe, direction);
      if (next === timeframe) {
        return;
      }
      setTimeframe(next);
      setChartWindow(null);
      animate(direction);
    },
    [timeframe, animate]
  );

  const { gestureHandlers: swipe } = useSwipeNavigation({
    onNext: () => goTimeframe(1),
    onBack: () => goTimeframe(-1),
  });

  const metric = data?.metrics.find((entry) => entry.metric.key === metricKey) ?? null;
  const system = profile?.system ?? 'metric';

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  if (loading && !data) {
    return <LoadingScreen label="Loading your progress" />;
  }

  if (!metric) {
    return (
      <Screen>
        <BackButton testID="progress-detail-back" />
        <EmptyState
          title="This metric has no data"
          description="Finish a workout or log an entry and it will appear here."
        />
      </Screen>
    );
  }

  const measure: Measure =
    measureChoice && metric.metric.measures.includes(measureChoice)
      ? measureChoice
      : metric.defaultMeasure;

  const series = metric.series[measure] ?? [];
  const now = data?.now ?? 0;
  const window = timeframeWindow(timeframe, now);
  const points = filterByWindow(series, window);
  const stats = summarize(points);
  const allStats = summarize(series);
  const unit = measureUnit(measure, system);
  const latest = allStats ? formatMeasureValue(measure, allStats.latest, system) : null;
  const zoomed = chartWindow !== null && isZoomed(chartWindow, window);

  const measureOptions = metric.metric.measures
    .filter((option) => (metric.series[option]?.length ?? 0) > 0)
    .map((option) => ({ value: option, label: MEASURE_LABELS[option] }));

  const selectTimeframe = (next: Timeframe) => {
    if (next === timeframe) {
      return;
    }
    const from = TIMEFRAMES.findIndex((option) => option.value === timeframe);
    const to = TIMEFRAMES.findIndex((option) => option.value === next);
    setTimeframe(next);
    setChartWindow(null);
    animate(to > from ? 1 : -1);
  };

  const selectMeasure = (next: Measure) => {
    if (next === measure) {
      return;
    }
    setMeasureChoice(next);
    setChartWindow(null);
    animate(1);
  };

  const openNew = () => {
    setEditing(null);
    setEntryOpen(true);
  };

  const openEdit = (point: SeriesPoint) => {
    if (point.entryId === undefined) {
      return;
    }
    setEditing({
      id: point.entryId,
      valueKg: point.value,
      recordedAt: point.at,
      note: point.note ?? null,
    });
    setEntryOpen(true);
  };

  const removeEntry = async (id: number) => {
    await database.deleteProgressEntry(id);
    haptics.warning();
    reload();
  };

  const entries = [...points].reverse();

  return (
    <Screen
      footer={<Button label="Log entry" onPress={openNew} testID="log-entry" />}>
      <BackButton testID="progress-detail-back" />

      <View {...swipe}>
        <ScreenHeader
          title={metric.metric.name}
          subtitle={metric.metric.detail ?? undefined}
        />

        <View style={styles.hero}>
          <View style={styles.valueRow}>
            <Text variant="display">{latest ? latest.text : '—'}</Text>
            {latest ? (
              <Text variant="subheading" tone="textTertiary" style={styles.unit}>
                {latest.unit}
              </Text>
            ) : null}
          </View>

          <Text variant="caption" tone="textTertiary">
            {allStats
              ? `${formatRelativeDate(allStats.latestAt, now)}${
                  stats?.change ? ` · ${formatChange(measure, stats.change, system)}` : ''
                }`
              : 'No entries yet'}
          </Text>
        </View>
      </View>

      {measureOptions.length > 1 ? (
        <ChipRow
          options={measureOptions}
          value={measure}
          onChange={selectMeasure}
          label="Measure"
          testIDPrefix="measure"
          testID="measure-chips"
        />
      ) : null}

      <TimeframeChips value={timeframe} onChange={selectTimeframe} testID="timeframe-chips" />

      <Animated.View
        style={[styles.chart, { opacity: fade, transform: [{ translateX: shift }] }]}>
        <ProgressChart
          points={points}
          base={window}
          window={chartWindow}
          onWindowChange={setChartWindow}
          measure={measure}
          system={system}
          height={244}
          testID="progress-chart"
        />
      </Animated.View>

      {zoomed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset zoom"
          onPress={() => setChartWindow(null)}
          style={({ pressed }) => [styles.reset, pressed ? styles.pressed : null]}
          testID="reset-zoom">
          <Text variant="caption" tone="textSecondary">
            Reset zoom
          </Text>
        </Pressable>
      ) : null}

      {stats ? (
        <View style={styles.stats}>
          <Stat
            label="Lowest"
            value={formatAxisValue(measure, stats.min, system)}
            unit={unit}
          />
          <Stat
            label="Average"
            value={formatAxisValue(measure, stats.average, system)}
            unit={unit}
          />
          <Stat
            label="Highest"
            value={formatAxisValue(measure, stats.max, system)}
            unit={unit}
          />
        </View>
      ) : null}

      <Text variant="caption" tone="textTertiary" style={styles.sectionLabel}>
        {entries.length > 0 ? `Entries · ${entries.length}` : 'Entries'}
      </Text>

      {entries.length === 0 ? (
        <EmptyState
          compact
          title="Nothing in this period"
          description="Choose a longer range, or log an entry."
        />
      ) : (
        <View style={styles.entries}>
          {entries.map((point, index) => {
            const formatted = formatMeasureValue(measure, point.value, system);
            const editable = point.entryId !== undefined;

            const content = (
              <View style={styles.entryContent}>
                <View style={styles.entryText}>
                  <Text variant="subheading">{formatLongDate(point.at)}</Text>
                  <Text variant="caption" tone="textTertiary" numberOfLines={1}>
                    {sourceLabel(point)}
                    {point.note ? ` · ${point.note}` : ''}
                  </Text>
                </View>
                <View style={styles.entryValue}>
                  <Text variant="bodyStrong">{formatted.text}</Text>
                  <Text variant="caption" tone="textTertiary">
                    {formatted.unit}
                  </Text>
                </View>
              </View>
            );

            return (
              <SwipeToDelete
                key={`${point.at}-${point.sessionId ?? point.entryId ?? index}`}
                disabled={!editable}
                onDelete={() => {
                  if (point.entryId !== undefined) {
                    void removeEntry(point.entryId);
                  }
                }}
                accessibilityLabel={
                  editable ? `Delete entry from ${formatLongDate(point.at)}` : undefined
                }>
                {editable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit entry from ${formatLongDate(point.at)}`}
                    onPress={() => openEdit(point)}>
                    {content}
                  </Pressable>
                ) : (
                  content
                )}
              </SwipeToDelete>
            );
          })}
        </View>
      )}

      <ProgressEntrySheet
        visible={entryOpen}
        onClose={() => setEntryOpen(false)}
        metric={metric.metric}
        system={system}
        entry={editing}
        onSave={async (input) => {
          if (editing) {
            await database.updateProgressEntry(editing.id, input);
          } else if (metric.metric.kind === 'body') {
            await database.addProgressEntry({
              kind: 'body_weight',
              valueKg: input.valueKg,
              recordedAt: input.recordedAt,
              note: input.note,
            });
          } else {
            await database.addProgressEntry({
              kind: 'exercise',
              exerciseId: metric.metric.exerciseId,
              valueKg: input.valueKg,
              recordedAt: input.recordedAt,
              note: input.note,
            });
          }
          haptics.success();
          reload();
        }}
        onDelete={
          editing
            ? async () => {
                await removeEntry(editing.id);
              }
            : undefined
        }
        testID="progress-entry-sheet"
      />
    </Screen>
  );
}

function sourceLabel(point: SeriesPoint): string {
  if (point.source === 'manual') {
    return 'Manual entry';
  }
  if (point.source === 'profile') {
    return 'From your profile';
  }
  return 'Workout';
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" tone="textTertiary">
        {label}
      </Text>
      <Text variant="subheading">
        {value}
        <Text variant="caption" tone="textTertiary">
          {' '}
          {unit}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  unit: {
    marginBottom: 8,
  },
  chart: {
    marginTop: spacing.sm,
  },
  reset: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.6,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.base,
    paddingVertical: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  stat: {
    flex: 1,
    gap: spacing.xxs,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  entries: {
    gap: spacing.sm,
  },
  entryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  entryText: {
    flex: 1,
    gap: spacing.xxs,
  },
  entryValue: {
    alignItems: 'flex-end',
  },
});
