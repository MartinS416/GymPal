/**
 * The progress model.
 *
 * Every number on the progress screens is derived here, from the sets the user
 * logged and the entries they recorded by hand. Nothing in this file touches
 * the database or React, so the charts, the dashboard and the tests all work
 * from the same arithmetic.
 */

import { formatDecimal } from '@/lib/units';
import type { MeasurementSystem } from '@/lib/units';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The measures an exercise can be tracked by. */
export type Measure = 'weight' | 'reps' | 'sets' | 'volume' | 'oneRepMax';

/** The time ranges offered above a chart. */
export type Timeframe = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

const TIMEFRAME_DAYS: Record<Timeframe, number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 182,
  '1Y': 365,
  ALL: null,
};

/** The measures tried, in order, when choosing what a card shows first. */
const MEASURE_PRIORITY: Measure[] = ['weight', 'oneRepMax', 'volume', 'reps', 'sets'];

export const MEASURE_LABELS: Record<Measure, string> = {
  weight: 'Weight',
  reps: 'Reps',
  sets: 'Sets',
  volume: 'Volume',
  oneRepMax: 'Est. 1RM',
};

/** A time span on the x axis. */
export type TimeWindow = { start: number; end: number };

export type MetricKind = 'body' | 'exercise';

/** The identity of one metric on the dashboard. */
export type Metric = {
  /** `body_weight`, or `exercise:<id>`. Stored, so it must be stable. */
  key: string;
  kind: MetricKind;
  exerciseId: number | null;
  name: string;
  /** Muscle group, shown under the title in the detail screen. */
  detail: string | null;
  /** The measures this metric supports, in the order they are offered. */
  measures: Measure[];
};

/** A single dot on a chart. */
export type SeriesPoint = {
  at: number;
  value: number;
  source: 'workout' | 'manual' | 'profile';
  /** Manual entries can be edited and removed; workout points cannot. */
  entryId?: number;
  sessionId?: number;
  note?: string | null;
};

/** One exercise, in one completed session, reduced to its best numbers. */
export type SessionAggregate = {
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string | null;
  sessionId: number;
  at: number;
  maxWeightKg: number | null;
  maxReps: number | null;
  sets: number;
  volumeKg: number;
  oneRepMaxKg: number | null;
};

/** An entry the user recorded by hand. */
export type ManualEntry = {
  id: number;
  kind: 'body_weight' | 'exercise';
  exerciseId: number | null;
  exerciseName: string | null;
  muscleGroup: string | null;
  valueKg: number;
  recordedAt: number;
  note: string | null;
};

/** A stored pin, including metrics the user has unpinned. */
export type MetricPreference = {
  key: string;
  pinned: boolean;
  position: number;
};

/** A metric plus every series it can draw. */
export type MetricData = {
  metric: Metric;
  series: Partial<Record<Measure, SeriesPoint[]>>;
  /** What the dashboard card shows until the user picks another measure. */
  defaultMeasure: Measure;
  /** The most recent point across all measures, used to order the dashboard. */
  lastActiveAt: number;
};

// Identity -----------------------------------------------------------------

export const BODY_WEIGHT_KEY = 'body_weight';

export function exerciseKey(exerciseId: number): string {
  return `exercise:${exerciseId}`;
}

export function parseMetricKey(key: string): {
  kind: MetricKind;
  exerciseId: number | null;
} {
  if (key === BODY_WEIGHT_KEY) {
    return { kind: 'body', exerciseId: null };
  }
  const match = /^exercise:(\d+)$/.exec(key);
  if (match) {
    return { kind: 'exercise', exerciseId: Number(match[1]) };
  }
  return { kind: 'body', exerciseId: null };
}

// Series -------------------------------------------------------------------

function measureValue(aggregate: SessionAggregate, measure: Measure): number | null {
  switch (measure) {
    case 'weight':
      return aggregate.maxWeightKg;
    case 'reps':
      return aggregate.maxReps;
    case 'sets':
      return aggregate.sets;
    case 'volume':
      return aggregate.volumeKg;
    case 'oneRepMax':
      return aggregate.oneRepMaxKg;
  }
}

/**
 * Turns the raw rows into one series per exercise and measure.
 *
 * Manual entries join the series as extra points, marked so they can be
 * edited. Rows are grouped by calendar day: two sessions on the same day would
 * otherwise draw two points on one vertical line.
 */
export function buildMetrics(
  aggregates: SessionAggregate[],
  entries: ManualEntry[],
  options: { profileWeightKg: number | null; now: number }
): MetricData[] {
  const byExercise = new Map<number, SessionAggregate[]>();
  for (const aggregate of aggregates) {
    const list = byExercise.get(aggregate.exerciseId) ?? [];
    list.push(aggregate);
    byExercise.set(aggregate.exerciseId, list);
  }

  const manualExerciseEntries = entries.filter(
    (entry) => entry.kind === 'exercise' && entry.exerciseId !== null
  );
  for (const entry of manualExerciseEntries) {
    const exerciseId = entry.exerciseId as number;
    if (!byExercise.has(exerciseId)) {
      byExercise.set(exerciseId, []);
    }
  }

  const metrics: MetricData[] = [buildBodyWeight(entries, options.profileWeightKg, options.now)];

  for (const [exerciseId, rows] of byExercise) {
    const first = rows[0];
    const manual = manualExerciseEntries.filter((entry) => entry.exerciseId === exerciseId);

    const name = first?.exerciseName ?? manual[0]?.exerciseName ?? 'Exercise';
    const detail = first?.muscleGroup ?? manual[0]?.muscleGroup ?? null;

    const series: Partial<Record<Measure, SeriesPoint[]>> = {};
    const measures: Measure[] = ['weight', 'oneRepMax', 'volume', 'reps', 'sets'];

    for (const measure of measures) {
      const points: SeriesPoint[] = [];

      for (const row of rows) {
        const value = measureValue(row, measure);
        if (value === null || !Number.isFinite(value) || value <= 0) {
          continue;
        }
        points.push({
          at: row.at,
          value,
          source: 'workout',
          sessionId: row.sessionId,
        });
      }

      // A hand-recorded weight is a weight point and nothing else: it says
      // nothing about reps, volume or a one rep max.
      if (measure === 'weight') {
        for (const entry of manual) {
          points.push({
            at: entry.recordedAt,
            value: entry.valueKg,
            source: 'manual',
            entryId: entry.id,
            note: entry.note,
          });
        }
      }

      const collapsed = collapseByDay(points);
      if (collapsed.length > 0) {
        series[measure] = collapsed;
      }
    }

    const defaultMeasure =
      MEASURE_PRIORITY.find((measure) => (series[measure]?.length ?? 0) > 0) ?? 'weight';

    metrics.push({
      metric: {
        key: exerciseKey(exerciseId),
        kind: 'exercise',
        exerciseId,
        name,
        detail,
        measures,
      },
      series,
      defaultMeasure,
      lastActiveAt: latestAt(series),
    });
  }

  return metrics.sort((a, b) => {
    if (a.metric.kind !== b.metric.kind) {
      return a.metric.kind === 'body' ? -1 : 1;
    }
    return b.lastActiveAt - a.lastActiveAt;
  });
}

function buildBodyWeight(
  entries: ManualEntry[],
  profileWeightKg: number | null,
  now: number
): MetricData {
  const points: SeriesPoint[] = entries
    .filter((entry) => entry.kind === 'body_weight')
    .map((entry) => ({
      at: entry.recordedAt,
      value: entry.valueKg,
      source: 'manual' as const,
      entryId: entry.id,
      note: entry.note,
    }));

  // An install from before progress existed has a profile weight but no
  // entries. That weight is still the truth, so it is the starting point.
  if (points.length === 0 && profileWeightKg !== null) {
    points.push({ at: now, value: profileWeightKg, source: 'profile' });
  }

  const series = collapseByDay(points);

  return {
    metric: {
      key: BODY_WEIGHT_KEY,
      kind: 'body',
      exerciseId: null,
      name: 'Body weight',
      detail: null,
      measures: ['weight'],
    },
    series: series.length > 0 ? { weight: series } : {},
    defaultMeasure: 'weight',
    lastActiveAt: series.length > 0 ? series[series.length - 1].at : 0,
  };
}

/**
 * Keeps the last point of each day.
 *
 * A day with two sessions is still one day on the chart; the later of the two
 * wins, and a manual entry beats a workout because the user typed it
 * deliberately.
 */
export function collapseByDay(points: SeriesPoint[]): SeriesPoint[] {
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const result: SeriesPoint[] = [];

  for (const point of sorted) {
    const previous = result[result.length - 1];
    if (previous && isSameDay(previous.at, point.at)) {
      const previousIsManual = previous.source === 'manual';
      const nextIsManual = point.source === 'manual';
      if (nextIsManual || !previousIsManual) {
        result[result.length - 1] = point;
      }
      continue;
    }
    result.push(point);
  }

  return result;
}

function isSameDay(a: number, b: number): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function latestAt(series: Partial<Record<Measure, SeriesPoint[]>>): number {
  let latest = 0;
  for (const points of Object.values(series)) {
    for (const point of points ?? []) {
      latest = Math.max(latest, point.at);
    }
  }
  return latest;
}

/** The first point of every exercise, in the order they were trained. */
export function exerciseOrder(metrics: MetricData[]): string[] {
  return metrics.filter((data) => data.metric.kind === 'exercise').map((data) => data.metric.key);
}

// Pinned metrics -----------------------------------------------------------

/**
 * The pinned keys, in order.
 *
 * A user who has never opened the edit sheet has no stored rows, so the three
 * strongest metrics are pinned for them: body weight and the two most recently
 * trained exercises. Once they pin or unpin anything, their choice is kept —
 * including unpinning everything.
 */
export function resolvePinnedMetrics(
  preferences: MetricPreference[],
  metrics: MetricData[]
): string[] {
  const available = new Set(metrics.map((data) => data.metric.key));

  if (preferences.length === 0) {
    const defaults = metrics.filter((data) => data.metric.kind === 'body').map((data) => data.metric.key);
    for (const data of metrics) {
      if (defaults.length >= 3) {
        break;
      }
      if (data.metric.kind === 'exercise') {
        defaults.push(data.metric.key);
      }
    }
    return defaults.filter((key) => available.has(key));
  }

  return preferences
    .filter((preference) => preference.pinned && available.has(preference.key))
    .sort((a, b) => a.position - b.position || a.key.localeCompare(b.key))
    .map((preference) => preference.key);
}

/** Moves one key in a list, clamped to its bounds. */
export function moveKey(keys: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= keys.length) {
    return keys;
  }
  const target = Math.max(0, Math.min(keys.length - 1, to));
  const next = [...keys];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

// Timeframes ---------------------------------------------------------------

/** The window a timeframe covers, ending now. */
export function timeframeWindow(timeframe: Timeframe, now: number): TimeWindow {
  const days = TIMEFRAME_DAYS[timeframe];
  if (days === null) {
    return { start: 0, end: now };
  }
  return { start: now - days * DAY_MS, end: now };
}

/** Keeps the points inside a window. */
export function filterByWindow(points: SeriesPoint[], window: TimeWindow): SeriesPoint[] {
  return points.filter((point) => point.at >= window.start && point.at <= window.end);
}

/** Steps a timeframe forwards or backwards through the offered list. */
export function shiftTimeframe(timeframe: Timeframe, direction: -1 | 1): Timeframe {
  const index = TIMEFRAMES.findIndex((option) => option.value === timeframe);
  const next = Math.max(0, Math.min(TIMEFRAMES.length - 1, index + direction));
  return TIMEFRAMES[next].value;
}

// Stats --------------------------------------------------------------------

export type SeriesStats = {
  count: number;
  latest: number;
  latestAt: number;
  first: number;
  firstAt: number;
  change: number | null;
  min: number;
  max: number;
  average: number;
  /** Best value in the window, and when it happened. */
  best: number;
  bestAt: number;
};

/** The numbers under a chart. */
export function summarize(points: SeriesPoint[]): SeriesStats | null {
  if (points.length === 0) {
    return null;
  }

  let min = points[0].value;
  let max = points[0].value;
  let total = 0;
  let best = points[0].value;
  let bestAt = points[0].at;

  for (const point of points) {
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
    total += point.value;
    if (point.value > best) {
      best = point.value;
      bestAt = point.at;
    }
  }

  const first = points[0];
  const latest = points[points.length - 1];

  return {
    count: points.length,
    latest: latest.value,
    latestAt: latest.at,
    first: first.value,
    firstAt: first.at,
    change: points.length > 1 ? latest.value - first.value : null,
    min,
    max,
    average: total / points.length,
    best,
    bestAt,
  };
}

// Chart geometry -----------------------------------------------------------

export type ChartBox = {
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
};

export const DEFAULT_CHART_PADDING = {
  paddingTop: 20,
  paddingBottom: 24,
  paddingLeft: 10,
  paddingRight: 10,
};

export type PlottedPoint = {
  x: number;
  y: number;
  point: SeriesPoint;
};

export type ChartPlot = {
  /** Inner drawing area, excluding padding. */
  inner: { x: number; y: number; width: number; height: number };
  points: PlottedPoint[];
  /** `M … L …` path, empty for a single point. */
  line: string;
  /** The line closed down to the baseline. */
  area: string;
  min: number;
  max: number;
  baselineY: number;
  yTicks: { value: number; y: number }[];
  xTicks: { at: number; x: number }[];
};

/**
 * Projects a series onto a canvas.
 *
 * The x axis is time, so a gap between sessions is a gap on the chart. The y
 * axis is padded so points never sit on the edge of the card.
 */
export function plotSeries(
  points: SeriesPoint[],
  window: TimeWindow,
  box: ChartBox
): ChartPlot | null {
  if (points.length === 0) {
    return null;
  }

  const inner = {
    x: box.paddingLeft,
    y: box.paddingTop,
    width: Math.max(0, box.width - box.paddingLeft - box.paddingRight),
    height: Math.max(0, box.height - box.paddingTop - box.paddingBottom),
  };

  const start = window.start;
  const end = Math.max(window.end, start + 1);

  let dataMin = points[0].value;
  let dataMax = points[0].value;
  for (const point of points) {
    dataMin = Math.min(dataMin, point.value);
    dataMax = Math.max(dataMax, point.value);
  }

  const range = dataMax - dataMin;
  const padding = range === 0 ? Math.max(Math.abs(dataMax) * 0.1, 1) : range * 0.14;
  const min = dataMin - padding;
  const max = dataMax + padding;
  const span = max - min;

  const xOf = (at: number) =>
    inner.x + ((Math.max(start, Math.min(end, at)) - start) / (end - start)) * inner.width;
  const yOf = (value: number) => inner.y + inner.height - ((value - min) / span) * inner.height;

  const plotted: PlottedPoint[] = points.map((point) => ({
    x: xOf(point.at),
    y: yOf(point.value),
    point,
  }));

  let line = '';
  if (plotted.length === 1) {
    line = '';
  } else {
    line = plotted
      .map((dot, index) => `${index === 0 ? 'M' : 'L'}${round(dot.x)} ${round(dot.y)}`)
      .join(' ');
  }

  const baselineY = inner.y + inner.height;
  const area =
    plotted.length > 1
      ? `${line} L${round(plotted[plotted.length - 1].x)} ${round(baselineY)} L${round(
          plotted[0].x
        )} ${round(baselineY)} Z`
      : '';

  const mid = min + span / 2;

  return {
    inner,
    points: plotted,
    line,
    area,
    min,
    max,
    baselineY,
    yTicks: [
      { value: max, y: inner.y },
      { value: mid, y: inner.y + inner.height / 2 },
      { value: min, y: inner.y + inner.height },
    ],
    xTicks: [
      { at: start, x: inner.x },
      { at: start + (end - start) / 2, x: inner.x + inner.width / 2 },
      { at: end, x: inner.x + inner.width },
    ],
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The point closest to a touch, or null when there is nothing to touch. */
export function nearestPoint(plot: ChartPlot | null, x: number): number | null {
  if (!plot || plot.points.length === 0) {
    return null;
  }
  let bestIndex = 0;
  let bestDistance = Infinity;
  plot.points.forEach((dot, index) => {
    const distance = Math.abs(dot.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

// Zooming and panning ------------------------------------------------------

/** The narrowest window a pinch can produce, so the axis never collapses. */
export const MIN_WINDOW_MS = 2 * DAY_MS;

/** Keeps a window inside the base range and above the minimum span. */
export function clampWindow(window: TimeWindow, base: TimeWindow): TimeWindow {
  const baseSpan = Math.max(1, base.end - base.start);
  const minSpan = Math.min(MIN_WINDOW_MS, baseSpan);
  const span = Math.min(baseSpan, Math.max(minSpan, window.end - window.start));

  let start = window.start;
  if (start < base.start) {
    start = base.start;
  }
  if (start + span > base.end) {
    start = Math.max(base.start, base.end - span);
  }

  return { start, end: start + span };
}

/**
 * Pinches a window.
 *
 * `factor` above one zooms in; `anchor` is where the fingers are, from 0 (left)
 * to 1 (right), so the data under them stays put.
 */
export function zoomWindow(
  base: TimeWindow,
  current: TimeWindow,
  factor: number,
  anchor: number
): TimeWindow {
  if (!Number.isFinite(factor) || factor <= 0) {
    return current;
  }
  const span = current.end - current.start;
  const nextSpan = Math.min(base.end - base.start, Math.max(MIN_WINDOW_MS, span / factor));
  const anchorAt = current.start + span * Math.max(0, Math.min(1, anchor));
  const start = anchorAt - nextSpan * Math.max(0, Math.min(1, anchor));

  return clampWindow({ start, end: start + nextSpan }, base);
}

/** Slides a window by a fraction of its own span. Positive moves forwards. */
export function panWindow(
  base: TimeWindow,
  current: TimeWindow,
  fraction: number
): TimeWindow {
  const span = current.end - current.start;
  const start = current.start + span * fraction;
  return clampWindow({ start, end: start + span }, base);
}

/** True when the window shows less than the whole range. */
export function isZoomed(window: TimeWindow, base: TimeWindow): boolean {
  return window.end - window.start < (base.end - base.start) * 0.999;
}

// Formatting ---------------------------------------------------------------

export type WeightSystem = MeasurementSystem;

function toDisplayWeight(kg: number, system: WeightSystem): number {
  return system === 'imperial' ? kg / 0.45359237 : kg;
}

export function weightUnit(system: WeightSystem): 'kg' | 'lb' {
  return system === 'imperial' ? 'lb' : 'kg';
}

/** The unit a measure is shown in. */
export function measureUnit(measure: Measure, system: WeightSystem): string {
  if (measure === 'reps') {
    return 'reps';
  }
  if (measure === 'sets') {
    return 'sets';
  }
  return weightUnit(system);
}

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export type FormattedValue = {
  /** The number alone, so it can be rendered large and the unit small. */
  text: string;
  unit: string;
};

/** Formats a value of a measure in the user's units. */
export function formatMeasureValue(
  measure: Measure,
  value: number,
  system: WeightSystem
): FormattedValue {
  switch (measure) {
    case 'reps':
      return { text: String(Math.round(value)), unit: 'reps' };
    case 'sets':
      return { text: String(Math.round(value)), unit: 'sets' };
    case 'volume':
      return {
        text: groupThousands(String(Math.round(toDisplayWeight(value, system)))),
        unit: weightUnit(system),
      };
    case 'weight':
    case 'oneRepMax':
    default:
      return {
        text: formatDecimal(toDisplayWeight(value, system), 1),
        unit: weightUnit(system),
      };
  }
}

/** A signed change, e.g. `+2.5 kg`. */
export function formatChange(
  measure: Measure,
  change: number,
  system: WeightSystem
): string {
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  const formatted = formatMeasureValue(measure, Math.abs(change), system);
  return `${sign}${formatted.text} ${formatted.unit}`;
}

/** The value a rep or set count is displayed as in an axis label. */
export function formatAxisValue(
  measure: Measure,
  value: number,
  system: WeightSystem
): string {
  if (measure === 'reps' || measure === 'sets') {
    return String(Math.round(value));
  }
  if (measure === 'volume') {
    return groupThousands(String(Math.round(toDisplayWeight(value, system))));
  }
  return formatDecimal(toDisplayWeight(value, system), 1);
}

/** Small chart used on the dashboard cards: a plain polyline in a fixed box. */
export function sparklinePath(
  values: number[],
  width: number,
  height: number
): { line: string; area: string; last: { x: number; y: number } | null } {
  if (values.length === 0) {
    return { line: '', area: '', last: null };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : index * step,
    y: height - ((value - min) / span) * (height - 2) - 1,
  }));

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ');

  const area =
    points.length > 1
      ? `${line} L${round(points[points.length - 1].x)} ${height} L${round(points[0].x)} ${height} Z`
      : '';

  return { line, area, last: points[points.length - 1] };
}
