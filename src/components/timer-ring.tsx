import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/text';
import { colors } from '@/constants/theme';

export type TimerRingProps = {
  /** The time to show, already formatted. */
  value: string;
  /** What the clock is measuring, e.g. "EXERCISE TIME". */
  label: string;
  /** How full the ring is, 0 to 1. */
  progress?: number;
  /** White on black, for the rest timer. */
  inverted?: boolean;
  /** Overrides the colour of the time. */
  valueColor?: string;
  /** Fades the time, used to flag a rest that has run over. */
  valueOpacity?: Animated.Value;
  size?: number;
};

/**
 * The clock.
 *
 * A ring that fills as the clock runs, with the time in the middle. It is the
 * largest thing on the active workout screen, because it is the one thing the
 * user looks at between sets.
 */
export function TimerRing({
  value,
  label,
  progress = 0,
  inverted = false,
  valueColor,
  valueOpacity,
  size = 190,
}: TimerRingProps) {
  const strokeWidth = Math.round(size * 0.035);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  const track = inverted ? 'rgba(255, 255, 255, 0.16)' : colors.border;
  const arc = inverted ? colors.textOnInverted : colors.text;
  const text = inverted ? colors.textOnInverted : colors.text;
  const muted = inverted ? 'rgba(255, 255, 255, 0.6)' : colors.textTertiary;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arc}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>

      <View style={styles.centre} pointerEvents="none">
        <Animated.View
          style={valueOpacity ? { opacity: valueOpacity } : undefined}
          pointerEvents="none">
          <Text variant="timer" color={valueColor ?? text}>
            {value}
          </Text>
        </Animated.View>
        <Text variant="label" color={muted} style={styles.label}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    letterSpacing: 1.6,
  },
});
