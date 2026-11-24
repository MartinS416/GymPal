import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  monospacedDigit,
  padding,
  shapes,
  textCase,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { WorkoutActivityProps } from '@/workouts/workout-activity';

/**
 * The workout Live Activity card.
 *
 * iOS renders this inside the Lock Screen banner and the Dynamic Island, and
 * ticks the timer from the range handed in through the props — so the card stays
 * live without the app re-rendering once a second. The app only sends new props
 * when the phase changes.
 *
 * The design is the GymPal look in its most condensed form: monochrome, tracked
 * out uppercase eyebrow, tabular monospace timer so the digits never jitter.
 */
const WorkoutLiveActivity = (props: WorkoutActivityProps, environment: LiveActivityEnvironment) => {
  'widget';

  const dark = environment.colorScheme === 'dark';
  const ink = dark ? '#FFFFFF' : '#000000';
  const restingFill = dark ? '#FFFFFF' : '#000000';
  const restingText = dark ? '#000000' : '#FFFFFF';
  const quiet = dark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)';

  const resting = props.phase === 'rest';
  const phase = resting ? 'Rest' : 'Working';
  const lower = new Date(props.timerLower);
  const upper = new Date(props.timerUpper);

  const phaseLabel = resting ? (
    <Text
      modifiers={[
        font({ size: 11, weight: 'semibold' }),
        kerning(1.4),
        textCase('uppercase'),
        foregroundStyle(restingText),
        padding({ horizontal: 8, vertical: 3 }),
        background(restingFill, shapes.capsule()),
      ]}>
      {phase}
    </Text>
  ) : (
    <Text
      modifiers={[
        font({ size: 11, weight: 'semibold' }),
        kerning(1.4),
        textCase('uppercase'),
        foregroundStyle(quiet),
      ]}>
      {phase}
    </Text>
  );

  const timer = (size: number, weight: 'semibold' | 'bold' = 'semibold') => (
    <Text
      timerInterval={{ lower, upper }}
      countsDown={props.countsDown}
      modifiers={[
        font({ size, weight }),
        kerning(-0.5),
        monospacedDigit(),
        foregroundStyle(ink),
        lineLimit(1),
      ]}
    />
  );

  const progress = (
    <ProgressView
      value={resting ? null : props.progress}
      timerInterval={{ lower, upper }}
      countsDown={false}
      modifiers={[tint(ink), frame({ height: 4 })]}
    />
  );

  const setAndWorkout = (
    <Text
      modifiers={[
        font({ size: 13 }),
        foregroundStyle(quiet),
        lineLimit(1),
      ]}>
      {props.setLabel} · {props.workout}
    </Text>
  );

  const phaseSummary = (
    <HStack alignment="center" spacing={8}>
      {setAndWorkout}
      <Spacer />
      <Text
        modifiers={[
          font({ size: 13, weight: 'semibold' }),
          foregroundStyle(ink),
          lineLimit(1),
        ]}>
        {resting ? 'Resting' : `${Math.round(props.progress * 100)}%`}
      </Text>
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}>
        <HStack alignment="center" spacing={8}>
          {phaseLabel}
          <Spacer />
          {timer(34, 'bold')}
        </HStack>
        <Text
          modifiers={[
            font({ size: 19, weight: 'semibold' }),
            foregroundStyle(ink),
            lineLimit(1),
          ]}>
          {props.exercise}
        </Text>
        {setAndWorkout}
        {progress}
      </VStack>
    ),
    compactLeading: <Image systemName="dumbbell.fill" color={ink} size={16} />,
    compactTrailing: timer(15, 'semibold'),
    minimal: <Image systemName="dumbbell.fill" color={ink} size={16} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 12 })]}>
        {phaseLabel}
        <Text
          modifiers={[
            font({ size: 15, weight: 'semibold' }),
            foregroundStyle(ink),
            lineLimit(1),
          ]}>
          {props.exercise}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ all: 12 })]}>
        {timer(26, 'bold')}
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle(ink),
            lineLimit(1),
          ]}>
          {props.setLabel}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={8} modifiers={[padding({ horizontal: 12, bottom: 12 })]}>
        {phaseSummary}
        {progress}
      </VStack>
    ),
  };
};

export default createLiveActivity<WorkoutActivityProps>('GymPalWorkout', WorkoutLiveActivity);
