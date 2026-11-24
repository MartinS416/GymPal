import { useMemo, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { formatShortDate } from '@/lib/calendar';
import type { MeasurementSystem } from '@/lib/units';
import {
  clampWindow,
  formatAxisValue,
  formatMeasureValue,
  isZoomed,
  nearestPoint,
  panWindow,
  plotSeries,
  zoomWindow,
  type Measure,
  type SeriesPoint,
  type TimeWindow,
} from '@/workouts/progress';

export type ProgressChartProps = {
  points: SeriesPoint[];
  /** The window the selected timeframe covers; pinch and pan stay inside it. */
  base: TimeWindow;
  /** A zoomed window, or null for the whole timeframe. */
  window: TimeWindow | null;
  onWindowChange?: (window: TimeWindow | null) => void;
  measure: Measure;
  system: MeasurementSystem;
  height?: number;
  emptyLabel?: string;
  testID?: string;
};

const PADDING = { paddingTop: 26, paddingBottom: 26, paddingLeft: 46, paddingRight: 12 };

type PinchState = {
  active: boolean;
  distance: number;
  centerX: number;
  window: TimeWindow;
};

/**
 * The detail chart.
 *
 * One finger drags a crosshair through the series — the value under the finger
 * follows it. Two fingers pinch to zoom and drag to pan, like a photo: the
 * gestures that change what is shown never fight the gesture that reads it.
 */
export function ProgressChart({
  points,
  base,
  window,
  onWindowChange,
  measure,
  system,
  height = 232,
  emptyLabel = 'Nothing recorded in this period.',
  testID,
}: ProgressChartProps) {
  const haptics = useHaptics();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [pinch, setPinch] = useState<PinchState | null>(null);

  const activeWindow = window ? clampWindow(window, base) : base;
  const plot = width > 0 ? plotSeries(points, activeWindow, { width, height, ...PADDING }) : null;

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const responder = useMemo(() => {
    const select = (index: number | null) => {
      if (index === selected) {
        return;
      }
      setSelected(index);
      if (index !== null) {
        haptics.tick();
      }
    };

    const scrub = (x: number) => {
      select(nearestPoint(plot, x));
    };

    const touchDistance = (event: GestureResponderEvent) => {
      const [first, second] = event.nativeEvent.touches;
      return Math.max(1, Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY));
    };

    const touchCenter = (event: GestureResponderEvent) => {
      const [first, second] = event.nativeEvent.touches;
      return (first.locationX + second.locationX) / 2;
    };

    const start = (event: GestureResponderEvent): PinchState => ({
      active: true,
      distance: touchDistance(event),
      centerX: touchCenter(event),
      window: activeWindow,
    });

    const innerWidth = Math.max(1, width - PADDING.paddingLeft - PADDING.paddingRight);

    return PanResponder.create({
      // A tap does nothing; a horizontal drag reads the chart, and two fingers
      // zoom it. Vertical drags stay with the scroll view.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event, gesture) =>
        event.nativeEvent.touches.length >= 2 ||
        (Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        if (event.nativeEvent.touches.length >= 2) {
          setPinch(start(event));
          select(null);
          return;
        }
        scrub(event.nativeEvent.locationX);
      },
      onPanResponderMove: (event) => {
        if (event.nativeEvent.touches.length >= 2) {
          if (!pinch) {
            setPinch(start(event));
            return;
          }
          const centerX = touchCenter(event);
          const anchor = (centerX - PADDING.paddingLeft) / innerWidth;

          let next = zoomWindow(
            base,
            pinch.window,
            touchDistance(event) / pinch.distance,
            anchor
          );
          next = panWindow(base, next, -(centerX - pinch.centerX) / innerWidth);

          onWindowChange?.(isZoomed(next, base) ? next : null);
          return;
        }
        scrub(event.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setPinch(null);
        select(null);
      },
      onPanResponderTerminate: () => {
        setPinch(null);
        select(null);
      },
    });
  }, [activeWindow, base, haptics, onWindowChange, pinch, plot, selected, width]);

  const summary = describe(points, measure, system);
  const selectedPoint =
    plot && selected !== null ? plot.points[Math.min(selected, plot.points.length - 1)] : null;

  return (
    <View
      onLayout={handleLayout}
      style={[styles.container, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      testID={testID}
      {...responder.panHandlers}>
      {plot ? (
        <>
          <Svg width={width} height={height}>
            {plot.area ? <Path d={plot.area} fill="rgba(0, 0, 0, 0.05)" /> : null}

            {plot.yTicks.map((tick) => (
              <Line
                key={`grid-${tick.y}`}
                x1={PADDING.paddingLeft}
                y1={tick.y}
                x2={width - PADDING.paddingRight}
                y2={tick.y}
                stroke={colors.border}
                strokeWidth={StyleSheet.hairlineWidth}
              />
            ))}

            {plot.yTicks.map((tick) => (
              <SvgText
                key={`label-${tick.y}`}
                x={0}
                y={tick.y + 3.5}
                fontSize={10}
                fontWeight="500"
                fill={colors.textTertiary}>
                {formatAxisValue(measure, tick.value, system)}
              </SvgText>
            ))}

            {plot.xTicks.map((tick, index) => (
              <SvgText
                key={`x-${tick.at}-${index}`}
                x={tick.x}
                y={height - 6}
                fontSize={10}
                fill={colors.textTertiary}
                textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>
                {formatShortDate(tick.at)}
              </SvgText>
            ))}

            {plot.line ? (
              <Path
                d={plot.line}
                stroke={colors.text}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            ) : null}

            {plot.points.length <= 24
              ? plot.points.map((dot, index) => (
                  <Circle
                    key={`dot-${index}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={2.4}
                    fill={colors.text}
                  />
                ))
              : null}

            {selectedPoint ? (
              <>
                <Line
                  x1={selectedPoint.x}
                  y1={plot.inner.y}
                  x2={selectedPoint.x}
                  y2={plot.baselineY}
                  stroke={colors.text}
                  strokeWidth={StyleSheet.hairlineWidth * 2}
                  strokeOpacity={0.35}
                />
                <Circle cx={selectedPoint.x} cy={selectedPoint.y} r={5} fill={colors.background} />
                <Circle cx={selectedPoint.x} cy={selectedPoint.y} r={3.6} fill={colors.text} />
              </>
            ) : null}
          </Svg>

          {selectedPoint ? (
            <View
              pointerEvents="none"
              style={[
                styles.bubble,
                { left: Math.max(0, Math.min(width - 132, selectedPoint.x - 66)) },
              ]}>
              <Text variant="caption" tone="textOnInverted" style={styles.bubbleValue}>
                {formatMeasureValue(measure, selectedPoint.point.value, system).text}
                <Text variant="caption" tone="textOnInverted" style={styles.bubbleUnit}>
                  {' '}
                  {formatMeasureValue(measure, selectedPoint.point.value, system).unit}
                </Text>
              </Text>
              <Text variant="caption" style={styles.bubbleDate}>
                {formatShortDate(selectedPoint.point.at)}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <Text variant="caption" tone="textTertiary" align="center">
            {emptyLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

function describe(points: SeriesPoint[], measure: Measure, system: MeasurementSystem): string {
  if (points.length === 0) {
    return 'Chart with no data';
  }
  const latest = points[points.length - 1];
  const value = formatMeasureValue(measure, latest.value, system);
  return `Chart of ${points.length} points. Latest ${value.text} ${value.unit}.`;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  bubble: {
    position: 'absolute',
    top: 0,
    minWidth: 92,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.inverted,
  },
  bubbleValue: {
    fontWeight: '600',
  },
  bubbleUnit: {
    fontWeight: '400',
  },
  bubbleDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
  },
});
