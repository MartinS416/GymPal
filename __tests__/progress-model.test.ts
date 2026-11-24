import { describe, expect, it } from '@jest/globals';

import {
  addMonths,
  dayOfMonth,
  formatRelativeDate,
  isSameDay,
  monthGrid,
  startOfDay,
} from '@/lib/calendar';
import {
  BODY_WEIGHT_KEY,
  buildMetrics,
  clampWindow,
  DEFAULT_CHART_PADDING,
  exerciseKey,
  filterByWindow,
  formatAxisValue,
  formatChange,
  formatMeasureValue,
  isZoomed,
  measureUnit,
  moveKey,
  nearestPoint,
  panWindow,
  parseMetricKey,
  plotSeries,
  resolvePinnedMetrics,
  shiftTimeframe,
  sparklinePath,
  summarize,
  timeframeWindow,
  zoomWindow,
  type ManualEntry,
  type MetricPreference,
  type SessionAggregate,
  type SeriesPoint,
} from '@/workouts/progress';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 23, 12).getTime();

function aggregate(
  overrides: Partial<SessionAggregate> & { exerciseId: number; at: number }
): SessionAggregate {
  return {
    exerciseName: 'Bench Press',
    muscleGroup: 'Chest',
    sessionId: 1,
    maxWeightKg: 60,
    maxReps: 8,
    sets: 3,
    volumeKg: 1440,
    oneRepMaxKg: 76,
    ...overrides,
  };
}

function bodyEntry(id: number, valueKg: number, recordedAt: number): ManualEntry {
  return {
    id,
    kind: 'body_weight',
    exerciseId: null,
    exerciseName: null,
    muscleGroup: null,
    valueKg,
    recordedAt,
    note: null,
  };
}

function exerciseEntry(
  id: number,
  exerciseId: number,
  valueKg: number,
  recordedAt: number
): ManualEntry {
  return {
    id,
    kind: 'exercise',
    exerciseId,
    exerciseName: 'Barbell Row',
    muscleGroup: 'Back',
    valueKg,
    recordedAt,
    note: 'Felt strong',
  };
}

function point(at: number, value: number): SeriesPoint {
  return { at, value, source: 'workout' };
}

describe('metric identity', () => {
  it('round-trips the stored keys', () => {
    expect(exerciseKey(12)).toBe('exercise:12');
    expect(parseMetricKey('exercise:12')).toEqual({ kind: 'exercise', exerciseId: 12 });
    expect(parseMetricKey(BODY_WEIGHT_KEY)).toEqual({ kind: 'body', exerciseId: null });
    expect(parseMetricKey('something-else')).toEqual({ kind: 'body', exerciseId: null });
  });
});

describe('building the metrics', () => {
  const aggregates: SessionAggregate[] = [
    aggregate({ exerciseId: 7, exerciseName: 'Bench Press', at: NOW - 30 * DAY, sessionId: 1, maxWeightKg: 60 }),
    aggregate({ exerciseId: 7, at: NOW - 2 * DAY, sessionId: 2, maxWeightKg: 70, maxReps: 6, oneRepMaxKg: 84 }),
    aggregate({ exerciseId: 9, exerciseName: 'Back Squat', muscleGroup: 'Quads', at: NOW - 10 * DAY, sessionId: 3, maxWeightKg: 100 }),
  ];

  const entries: ManualEntry[] = [
    bodyEntry(1, 81, NOW - 20 * DAY),
    bodyEntry(2, 80.2, NOW - 2 * DAY),
    exerciseEntry(3, 7, 72.5, NOW - 1 * DAY),
    exerciseEntry(4, 11, 55, NOW - 5 * DAY),
  ];

  const metrics = buildMetrics(aggregates, entries, { profileWeightKg: 82, now: NOW });

  it('always starts with body weight', () => {
    expect(metrics[0].metric.key).toBe(BODY_WEIGHT_KEY);
    expect(metrics[0].metric.name).toBe('Body weight');
    expect(metrics[0].series.weight?.map((entry) => entry.value)).toEqual([81, 80.2]);
  });

  it('orders exercises by the most recent activity', () => {
    const keys = metrics.map((entry) => entry.metric.key);
    expect(keys).toContain(exerciseKey(7));
    expect(keys).toContain(exerciseKey(9));
    expect(keys).toContain(exerciseKey(11));
    expect(keys.indexOf(exerciseKey(7))).toBeLessThan(keys.indexOf(exerciseKey(9)));
  });

  it('derives every measure from the sessions', () => {
    const bench = metrics.find((entry) => entry.metric.key === exerciseKey(7))!;

    expect(bench.series.weight?.map((entry) => entry.value)).toEqual([60, 70, 72.5]);
    expect(bench.series.reps?.map((entry) => entry.value)).toEqual([8, 6]);
    expect(bench.series.sets?.map((entry) => entry.value)).toEqual([3, 3]);
    expect(bench.series.volume?.map((entry) => entry.value)).toEqual([1440, 1440]);
    expect(bench.series.oneRepMax?.map((entry) => entry.value)).toEqual([76, 84]);
    expect(bench.defaultMeasure).toBe('weight');
  });

  it('marks manual points so they can be edited', () => {
    const bench = metrics.find((entry) => entry.metric.key === exerciseKey(7))!;
    const manual = bench.series.weight?.find((entry) => entry.source === 'manual');

    expect(manual?.entryId).toBe(3);
    expect(manual?.note).toBe('Felt strong');
  });

  it('keeps a metric for an exercise that was only logged by hand', () => {
    const row = metrics.find((entry) => entry.metric.key === exerciseKey(11))!;

    expect(row.metric.name).toBe('Barbell Row');
    expect(row.series.weight).toHaveLength(1);
    expect(row.series.reps).toBeUndefined();
    expect(row.defaultMeasure).toBe('weight');
  });

  it('falls back to the profile weight when nothing has been logged', () => {
    const bodyOnly = buildMetrics([], [], { profileWeightKg: 79.5, now: NOW });
    const body = bodyOnly.find((entry) => entry.metric.key === BODY_WEIGHT_KEY)!;

    expect(body.series.weight).toHaveLength(1);
    expect(body.series.weight?.[0].source).toBe('profile');
    expect(body.series.weight?.[0].value).toBe(79.5);
  });

  it('prefers the measure that has data', () => {
    const bodyweight = buildMetrics(
      [
        aggregate({
          exerciseId: 20,
          exerciseName: 'Pull Up',
          at: NOW - DAY,
          maxWeightKg: 0,
          maxReps: 12,
          volumeKg: 0,
          oneRepMaxKg: null,
        }),
      ],
      [],
      { profileWeightKg: null, now: NOW }
    ).find((entry) => entry.metric.key === exerciseKey(20))!;

    expect(bodyweight.series.weight).toBeUndefined();
    expect(bodyweight.series.volume).toBeUndefined();
    expect(bodyweight.defaultMeasure).toBe('reps');
  });

  it('collapses two sessions on the same day into one point', () => {
    const sameDay = new Date(2026, 9, 20, 9).getTime();
    const later = new Date(2026, 9, 20, 18).getTime();

    const metric = buildMetrics(
      [
        aggregate({ exerciseId: 7, at: sameDay, sessionId: 1, maxWeightKg: 60 }),
        aggregate({ exerciseId: 7, at: later, sessionId: 2, maxWeightKg: 62.5 }),
      ],
      [],
      { profileWeightKg: null, now: NOW }
    ).find((entry) => entry.metric.key === exerciseKey(7))!;

    expect(metric.series.weight).toHaveLength(1);
    expect(metric.series.weight?.[0].value).toBe(62.5);
  });
});

describe('pinned metrics', () => {
  const metrics = buildMetrics(
    [
      aggregate({ exerciseId: 7, at: NOW - DAY, sessionId: 2 }),
      aggregate({ exerciseId: 9, exerciseName: 'Back Squat', at: NOW - 3 * DAY, sessionId: 3 }),
      aggregate({ exerciseId: 12, exerciseName: 'Deadlift', at: NOW - 5 * DAY, sessionId: 4 }),
    ],
    [bodyEntry(1, 80, NOW - DAY)],
    { profileWeightKg: null, now: NOW }
  );

  it('pins body weight and the two most recent exercises by default', () => {
    expect(resolvePinnedMetrics([], metrics)).toEqual([
      BODY_WEIGHT_KEY,
      exerciseKey(7),
      exerciseKey(9),
    ]);
  });

  it('keeps the stored order', () => {
    const preferences: MetricPreference[] = [
      { key: exerciseKey(9), pinned: true, position: 0 },
      { key: BODY_WEIGHT_KEY, pinned: true, position: 1 },
      { key: exerciseKey(7), pinned: false, position: 2 },
    ];

    expect(resolvePinnedMetrics(preferences, metrics)).toEqual([exerciseKey(9), BODY_WEIGHT_KEY]);
  });

  it('does not re-pin the defaults when everything has been unpinned', () => {
    const preferences: MetricPreference[] = metrics.map((entry, index) => ({
      key: entry.metric.key,
      pinned: false,
      position: index,
    }));

    expect(resolvePinnedMetrics(preferences, metrics)).toEqual([]);
  });

  it('ignores keys for metrics that no longer exist', () => {
    const preferences: MetricPreference[] = [
      { key: exerciseKey(999), pinned: true, position: 0 },
      { key: BODY_WEIGHT_KEY, pinned: true, position: 1 },
    ];

    expect(resolvePinnedMetrics(preferences, metrics)).toEqual([BODY_WEIGHT_KEY]);
  });

  it('moves one key without disturbing the others', () => {
    expect(moveKey(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveKey(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveKey(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'c', 'b']);
    expect(moveKey(['a', 'b', 'c'], -1, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('timeframes', () => {
  it('spans the requested number of days', () => {
    const week = timeframeWindow('1W', NOW);
    expect(week.end).toBe(NOW);
    expect(week.end - week.start).toBe(7 * DAY);
    expect(timeframeWindow('ALL', NOW).start).toBe(0);
  });

  it('keeps only the points inside the window', () => {
    const points = [point(NOW - 10 * DAY, 1), point(NOW - DAY, 2), point(NOW + DAY, 3)];
    expect(filterByWindow(points, timeframeWindow('1W', NOW))).toHaveLength(1);
  });

  it('walks the range list and stops at the ends', () => {
    expect(shiftTimeframe('3M', 1)).toBe('6M');
    expect(shiftTimeframe('3M', -1)).toBe('1M');
    expect(shiftTimeframe('1W', -1)).toBe('1W');
    expect(shiftTimeframe('ALL', 1)).toBe('ALL');
  });
});

describe('statistics', () => {
  it('summarises a series', () => {
    const stats = summarize([point(NOW - 2 * DAY, 60), point(NOW - DAY, 70), point(NOW, 65)])!;

    expect(stats.count).toBe(3);
    expect(stats.latest).toBe(65);
    expect(stats.first).toBe(60);
    expect(stats.change).toBe(5);
    expect(stats.min).toBe(60);
    expect(stats.max).toBe(70);
    expect(stats.average).toBe(65);
    expect(stats.best).toBe(70);
  });

  it('has no change for a single point', () => {
    expect(summarize([point(NOW, 60)])?.change).toBeNull();
    expect(summarize([])).toBeNull();
  });
});

describe('chart geometry', () => {
  const box = { width: 320, height: 200, ...DEFAULT_CHART_PADDING };
  const window = { start: NOW - 30 * DAY, end: NOW };

  it('places every point inside the drawing area', () => {
    const plot = plotSeries([point(NOW - 30 * DAY, 60), point(NOW, 80)], window, box)!;

    for (const dot of plot.points) {
      expect(dot.x).toBeGreaterThanOrEqual(plot.inner.x - 0.01);
      expect(dot.x).toBeLessThanOrEqual(plot.inner.x + plot.inner.width + 0.01);
      expect(dot.y).toBeGreaterThanOrEqual(plot.inner.y - 0.01);
      expect(dot.y).toBeLessThanOrEqual(plot.inner.y + plot.inner.height + 0.01);
    }
  });

  it('draws left to right in time order', () => {
    const plot = plotSeries(
      [point(NOW - 20 * DAY, 60), point(NOW - 10 * DAY, 70), point(NOW, 65)],
      window,
      box
    )!;

    expect(plot.points[0].x).toBeLessThan(plot.points[1].x);
    expect(plot.points[1].x).toBeLessThan(plot.points[2].x);
    expect(plot.line.startsWith('M')).toBe(true);
    expect(plot.area.endsWith('Z')).toBe(true);
  });

  it('handles a single point and an empty series', () => {
    const single = plotSeries([point(NOW, 60)], window, box)!;
    expect(single.points).toHaveLength(1);
    expect(single.line).toBe('');
    expect(single.area).toBe('');
    expect(plotSeries([], window, box)).toBeNull();
  });

  it('finds the point closest to a touch', () => {
    const plot = plotSeries([point(NOW - 20 * DAY, 60), point(NOW, 80)], window, box)!;

    expect(nearestPoint(plot, plot.points[0].x + 4)).toBe(0);
    expect(nearestPoint(plot, plot.points[1].x - 4)).toBe(1);
    expect(nearestPoint(null, 10)).toBeNull();
  });

  it('draws a sparkline without a baseline to show', () => {
    const spark = sparklinePath([1, 3, 2], 100, 40);

    expect(spark.line.startsWith('M')).toBe(true);
    expect(spark.area.endsWith('Z')).toBe(true);
    expect(spark.last?.x).toBe(100);
    expect(sparklinePath([], 100, 40)).toEqual({ line: '', area: '', last: null });
  });
});

describe('zooming and panning', () => {
  const base = { start: NOW - 30 * DAY, end: NOW };
  const span = (window: { start: number; end: number }) => window.end - window.start;

  it('zooms around the fingers', () => {
    const zoomed = zoomWindow(base, base, 2, 0.5);
    expect(span(zoomed)).toBe(15 * DAY);
    expect(zoomed.start + span(zoomed) / 2).toBeCloseTo(base.start + span(base) / 2);
    expect(isZoomed(zoomed, base)).toBe(true);
  });

  it('never zooms past the minimum window', () => {
    const zoomed = zoomWindow(base, base, 1e9, 0.5);
    expect(span(zoomed)).toBe(2 * DAY);
  });

  it('pans a zoomed window and clamps it to the range', () => {
    const zoomed = zoomWindow(base, base, 2, 0.5);
    expect(panWindow(base, zoomed, 1).end).toBe(base.end);
    expect(panWindow(base, zoomed, -1).start).toBe(base.start);
    expect(span(panWindow(base, zoomed, 5))).toBe(span(zoomed));
  });

  it('keeps a window inside its base', () => {
    const left = clampWindow({ start: base.start - DAY, end: base.start + DAY }, base);
    expect(left.start).toBe(base.start);
    expect(span(left)).toBe(2 * DAY);

    const right = clampWindow({ start: base.end - DAY, end: base.end + DAY }, base);
    expect(right.end).toBe(base.end);

    expect(isZoomed(base, base)).toBe(false);
  });
});

describe('formatting', () => {
  it('converts weights to the chosen system', () => {
    expect(formatMeasureValue('weight', 80, 'metric')).toEqual({ text: '80', unit: 'kg' });
    expect(formatMeasureValue('weight', 80, 'imperial').text).toBe('176.4');
    expect(formatMeasureValue('weight', 80, 'imperial').unit).toBe('lb');
    expect(measureUnit('weight', 'imperial')).toBe('lb');
  });

  it('formats the counted and grouped measures', () => {
    expect(formatMeasureValue('reps', 8, 'metric')).toEqual({ text: '8', unit: 'reps' });
    expect(formatMeasureValue('volume', 12345, 'metric')).toEqual({ text: '12,345', unit: 'kg' });
    expect(formatMeasureValue('oneRepMax', 102.48, 'metric').text).toBe('102.5');
    expect(formatAxisValue('reps', 7.6, 'metric')).toBe('8');
    expect(measureUnit('sets', 'metric')).toBe('sets');
  });

  it('signs a change', () => {
    expect(formatChange('weight', 2.5, 'metric')).toBe('+2.5 kg');
    expect(formatChange('weight', -0.6, 'metric')).toBe('−0.6 kg');
    expect(formatChange('weight', 0, 'metric')).toBe('0 kg');
  });
});

describe('calendar', () => {
  const october = new Date(2026, 9, 1).getTime();

  it('lays out a month Monday first', () => {
    const cells = monthGrid(october);

    // 1 October 2026 is a Thursday, so three empty cells lead the grid.
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]).toBe(1);
    expect(cells.filter((cell) => cell !== null)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
  });

  it('moves between months and days', () => {
    expect(dayOfMonth(october, 15)).toBe(new Date(2026, 9, 15).getTime());
    expect(isSameDay(dayOfMonth(october, 15), new Date(2026, 9, 15, 23).getTime())).toBe(true);
    expect(new Date(addMonths(october, 1)).getMonth()).toBe(10);
    expect(new Date(addMonths(october, -10)).getFullYear()).toBe(2025);
  });

  it('describes a date by how long ago it was', () => {
    const now = new Date(2026, 9, 23, 12).getTime();

    expect(formatRelativeDate(now, now)).toBe('Today');
    expect(formatRelativeDate(new Date(2026, 9, 22, 12).getTime(), now)).toBe('Yesterday');
    expect(formatRelativeDate(new Date(2026, 9, 20, 12).getTime(), now)).toBe('3 days ago');
    expect(formatRelativeDate(new Date(2026, 8, 1).getTime(), now)).toBe('1 Sep');
    expect(formatRelativeDate(new Date(2025, 8, 1).getTime(), now)).toBe('Mon, 1 Sep 2025');
  });

  it('starts a day at midnight', () => {
    const at = new Date(2026, 9, 23, 18, 45).getTime();
    expect(new Date(startOfDay(at)).getHours()).toBe(0);
    expect(startOfDay(at)).toBeLessThanOrEqual(at);
  });
});
