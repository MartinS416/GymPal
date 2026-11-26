import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
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
 * Native Lock Screen and Dynamic Island views for an active workout.
 *
 * The banner reads in two columns: the exercise and its set keep the left edge,
 * while the clock and the phase share a right-hand rail on the same two lines.
 * The workout name and its total sit in a quiet footer above the progress bar.
 *
 * The timer ranges are rendered by SwiftUI, so both clocks keep ticking while
 * JavaScript is suspended. Active uses the app's white canvas; rest uses its
 * black inverted canvas. The Dynamic Island remains Apple's black system
 * surface and uses the app's high-contrast ink treatment.
 */
const WorkoutLiveActivity = (
  props: WorkoutActivityProps,
  _environment: LiveActivityEnvironment
) => {
  'widget';

  const resting = props.phase === 'rest';
  const phase = resting ? 'Rest' : 'Active';
  const cardBackground = resting ? '#000000' : '#FFFFFF';
  const cardInk = resting ? '#FFFFFF' : '#000000';
  const cardQuiet = resting ? 'rgba(255, 255, 255, 0.58)' : 'rgba(0, 0, 0, 0.48)';
  const islandInk = '#FFFFFF';
  const islandQuiet = 'rgba(255, 255, 255, 0.62)';
  const islandAccent = resting ? '#FFFFFF' : '#D9FF57';
  const lower = new Date(props.timerLower);
  const upper = new Date(props.timerUpper);
  const workoutLower = new Date(props.workoutTimerLower);
  const workoutUpper = new Date(props.workoutTimerUpper);

  const phaseLabel = (ink: string, quiet: string, island = false) => {
    if (resting || island) {
      return (
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            kerning(1.4),
            textCase('uppercase'),
            foregroundStyle('#000000'),
            padding({ horizontal: 8, vertical: 3 }),
            background(island ? islandAccent : ink, shapes.capsule()),
          ]}>
          {phase}
        </Text>
      );
    }

    return (
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
  };

  const totalLabel = (ink: string) => (
    <Text
      modifiers={[
        font({ size: 10, weight: 'semibold' }),
        kerning(0.9),
        textCase('uppercase'),
        foregroundStyle(ink),
      ]}>
      Total
    </Text>
  );

  const phaseTimer = (
    size: number,
    ink: string,
    weight: 'semibold' | 'bold' = 'semibold'
  ) => (
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

  const workoutTimer = (size: number, ink: string) => (
    <Text
      timerInterval={{ lower: workoutLower, upper: workoutUpper }}
      countsDown={false}
      modifiers={[
        font({ size, weight: 'semibold' }),
        monospacedDigit(),
        foregroundStyle(ink),
        lineLimit(1),
      ]}
    />
  );

  const progress = (ink: string) => (
    <ProgressView
      value={resting ? null : props.progress}
      timerInterval={{ lower, upper }}
      countsDown={false}
      modifiers={[tint(ink), frame({ height: 4 })]}
    />
  );

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={9}
        modifiers={[
          padding({ all: 16 }),
          activityBackgroundTint(cardBackground),
        ]}>
        <HStack alignment="firstTextBaseline" spacing={14}>
          <VStack alignment="leading" spacing={3}>
            <Text
              modifiers={[
                font({ size: 19, weight: 'semibold' }),
                kerning(-0.2),
                foregroundStyle(cardInk),
                lineLimit(1),
              ]}>
              {props.exercise}
            </Text>
            <Text
              modifiers={[
                font({ size: 13 }),
                foregroundStyle(cardQuiet),
                lineLimit(1),
              ]}>
              {props.setLabel} · {props.setsRepsLabel}
            </Text>
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={4}>
            {phaseTimer(34, cardInk, 'bold')}
            {phaseLabel(cardInk, cardQuiet)}
          </VStack>
        </HStack>
        <HStack alignment="firstTextBaseline" spacing={6}>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(cardQuiet), lineLimit(1)]}>
            {props.workout}
          </Text>
          <Spacer />
          {totalLabel(cardQuiet)}
          {workoutTimer(12, cardInk)}
        </HStack>
        {progress(cardInk)}
      </VStack>
    ),
    compactLeading: <Image systemName="dumbbell.fill" color={islandAccent} size={16} />,
    compactTrailing: workoutTimer(14, islandInk),
    minimal: <Image systemName="dumbbell.fill" color={islandAccent} size={16} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 12 })]}>
        {phaseLabel(islandInk, islandQuiet, true)}
        <Text
          modifiers={[
            font({ size: 15, weight: 'semibold' }),
            kerning(-0.2),
            foregroundStyle(islandInk),
            lineLimit(2),
          ]}>
          {props.exercise}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ all: 12 })]}>
        {phaseTimer(26, islandInk, 'bold')}
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle(islandQuiet),
            lineLimit(1),
          ]}>
          {props.setLabel}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ horizontal: 12, bottom: 12 })]}>
        <HStack alignment="firstTextBaseline" spacing={6}>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(islandQuiet), lineLimit(1)]}>
            {props.setsRepsLabel}
          </Text>
          <Spacer />
          {totalLabel(islandQuiet)}
          {workoutTimer(12, islandInk)}
        </HStack>
        {progress(islandAccent)}
      </VStack>
    ),
  };
};

export default createLiveActivity<WorkoutActivityProps>('GymPalWorkout', WorkoutLiveActivity);
