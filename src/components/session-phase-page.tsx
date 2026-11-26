import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/text-input';
import { Text } from '@/components/text';
import { TimerRing } from '@/components/timer-ring';
import { colors, spacing } from '@/constants/theme';
import type { SessionPhaseView } from '@/workouts/session-view';

export type SessionPhasePageProps = {
  view: SessionPhaseView;
  /** Fades the overdue rest countdown. A previewed page passes a still value. */
  blink: Animated.Value;
  /** Distance to the top of the safe area, for the scroll padding. */
  topInset: number;
  menuOpen: boolean;
  dotsRotate: ReturnType<Animated.Value['interpolate']>;
  onToggleMenu: () => void;
  onOpenPicker: () => void;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onSkipSupersetMember: () => void;
  onSkipWarmup: () => void;
  onSkipRemainingDrops: () => void;
  inputError: string | null;
  saving: boolean;
  confirmingFinish: boolean;
  onCancelFinish: () => void;
  onShowFinish: () => void;
  onFinish: () => void;
};

/**
 * One phase of the workout, drawn full screen.
 *
 * The screen renders this twice while a swipe is in flight — once for the phase
 * being left and once for the phase arriving — so the incoming phase is already
 * drawn as it slides in, instead of an empty gap that fills in after loading.
 */
export function SessionPhasePage({
  view,
  blink,
  topInset,
  menuOpen,
  dotsRotate,
  onToggleMenu,
  onOpenPicker,
  onWeightChange,
  onRepsChange,
  onAddSet,
  onRemoveSet,
  onSkipSupersetMember,
  onSkipWarmup,
  onSkipRemainingDrops,
  inputError,
  saving,
  confirmingFinish,
  onCancelFinish,
  onShowFinish,
  onFinish,
}: SessionPhasePageProps) {
  const isRest = view.isRest;

  return (
    <View style={[styles.container, isRest ? styles.containerInverted : null]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topInset + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never">
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap exercise"
              onPress={onOpenPicker}
              style={styles.namePress}>
              <Text
                variant="title"
                color={isRest ? colors.textOnInverted : colors.text}
                numberOfLines={2}
                style={styles.exerciseName}>
                {view.title}
              </Text>
            </Pressable>
            <View style={styles.headerMeta}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={menuOpen ? 'Close options' : 'More options'}
                accessibilityState={{ expanded: menuOpen }}
                onPress={onToggleMenu}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.dotsTrigger,
                  pressed ? styles.dotsTriggerPressed : null,
                ]}
                testID="edit-workout">
                <Animated.View style={[styles.dots, { transform: [{ rotate: dotsRotate }] }]}>
                  <View style={[styles.dot, isRest ? styles.dotInverted : null]} />
                  <View style={[styles.dot, isRest ? styles.dotInverted : null]} />
                  <View style={[styles.dot, isRest ? styles.dotInverted : null]} />
                </Animated.View>
              </Pressable>
            </View>
          </View>
          <Text
            variant="caption"
            color={isRest ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary}
            style={styles.underName}>
            {view.subtitle}
          </Text>
          {view.nextHint ? (
            <Text
              variant="caption"
              color={isRest ? 'rgba(255, 255, 255, 0.55)' : colors.textTertiary}
              style={styles.nextExercise}>
              {view.nextHint}
            </Text>
          ) : null}
          {view.instruction ? (
            <Text
              variant="caption"
              color={isRest ? 'rgba(255, 255, 255, 0.55)' : colors.textSecondary}
              style={styles.phaseInstruction}>
              {view.instruction}
            </Text>
          ) : null}

          {view.phase ? (
            <>
              <View style={styles.ringRow}>
                <View style={styles.ringButtonGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove set"
                    onPress={onRemoveSet}
                    disabled={!view.canRemoveSet}
                    style={[styles.ringButton, !view.canRemoveSet ? styles.ringButtonDisabled : null]}
                    testID="remove-set">
                    <Text style={styles.ringButtonText}>−</Text>
                  </Pressable>
                  <Text
                    variant="caption"
                    color={isRest ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary}
                    style={styles.ringButtonLabel}>
                    Remove set
                  </Text>
                </View>
                <View style={styles.ring}>
                  <TimerRing
                    value={view.ringValue}
                    label={view.ringLabel}
                    progress={view.ringProgress}
                    inverted={isRest}
                    valueColor={view.restOverdue ? colors.dangerBright : undefined}
                    valueOpacity={view.restOverdue ? blink : undefined}
                  />
                </View>
                <View style={styles.ringButtonGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add set"
                    onPress={onAddSet}
                    disabled={!view.canAddSet}
                    style={[styles.ringButton, !view.canAddSet ? styles.ringButtonDisabled : null]}
                    testID="add-set">
                    <Text style={styles.ringButtonText}>+</Text>
                  </Pressable>
                  <Text
                    variant="caption"
                    color={isRest ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary}
                    style={styles.ringButtonLabel}>
                    Add set
                  </Text>
                </View>
              </View>

              <View style={styles.clocks}>
                <Clock label="Exercise" value={view.exerciseClock} inverted={isRest} />
                <Clock label="Rest" value={view.restClock} inverted={isRest} />
              </View>
            </>
          ) : view.summary ? (
            <View style={styles.summary} testID="session-summary">
              <View style={styles.summaryRow}>
                <SummaryStat
                  label="Total weight moved"
                  value={view.summary.volume}
                  testID="summary-volume"
                />
                <SummaryStat
                  label="Active time"
                  value={view.summary.activeTime}
                  testID="summary-active"
                />
              </View>
              <View style={styles.summaryRow}>
                <SummaryStat
                  label="Rest time"
                  value={view.summary.restTime}
                  testID="summary-rest"
                />
                <SummaryStat
                  label="Total time"
                  value={view.summary.totalTime}
                  testID="summary-total"
                />
              </View>
            </View>
          ) : null}

          {/*
            The fields stay live through the rest, so the set that was just
            logged can still be corrected.
          */}
          {view.phase ? (
            <View style={styles.inputs}>
              <Field
                label={`Weight (${view.weightUnit})`}
                value={view.weightValue}
                onChangeText={onWeightChange}
                keyboardType="decimal-pad"
                placeholder="0"
                inverted={isRest}
                style={styles.input}
                testID="set-weight"
              />
              <Field
                label={view.isAmrap ? 'Actual reps' : 'Reps'}
                value={view.repsValue}
                onChangeText={onRepsChange}
                keyboardType="number-pad"
                placeholder="0"
                inverted={isRest}
                style={styles.input}
                testID="set-reps"
              />
            </View>
          ) : null}

          {view.isAmrap && view.minReps !== null ? (
            <Text variant="caption" tone={isRest ? 'textOnInverted' : 'textSecondary'}>
              Minimum guidance: {view.minReps} reps
            </Text>
          ) : null}
          {inputError ? <Text variant="caption" tone="danger">{inputError}</Text> : null}
          {view.showSkipSuperset ? (
            <Button
              label="Skip this exercise"
              variant="secondary"
              size="md"
              onPress={onSkipSupersetMember}
              testID="skip-superset-member"
            />
          ) : null}
          {view.showSkipWarmup ? (
            <Button
              label="Skip warm-up"
              variant="secondary"
              size="md"
              onPress={onSkipWarmup}
              testID="skip-warmup"
            />
          ) : null}
          {view.hasRemainingDropSteps ? (
            <Button
              label="Skip remaining drops"
              variant="secondary"
              size="md"
              disabled={saving}
              onPress={onSkipRemainingDrops}
              testID="skip-remaining-drops"
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {confirmingFinish ? (
          <View style={styles.confirm}>
            <Text
              variant="subheading"
              color={isRest ? colors.textOnInverted : colors.text}>
              Finish workout?
            </Text>
            <View style={styles.confirmActions}>
              <Button
                label="Keep training"
                variant="secondary"
                size="md"
                inverted={isRest}
                onPress={onCancelFinish}
                style={styles.confirmButton}
                testID="cancel-finish"
              />
              <Button
                label="Finish"
                size="md"
                inverted={isRest}
                onPress={onFinish}
                loading={saving}
                style={styles.confirmButton}
                testID="confirm-finish"
              />
            </View>
          </View>
        ) : (
          <Button
            label="Finish Workout"
            variant="secondary"
            size="md"
            inverted={isRest}
            onPress={onShowFinish}
            testID="finish-workout"
          />
        )}
      </View>
    </View>
  );
}

function SummaryStat({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View style={styles.summaryStat} testID={testID}>
      <Text variant="eyebrow">{label}</Text>
      <Text variant="metric" style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

function Clock({
  label,
  value,
  inverted,
}: {
  label: string;
  value: string;
  inverted: boolean;
}) {
  return (
    <View style={styles.clock}>
      <Text
        variant="eyebrow"
        color={inverted ? 'rgba(255, 255, 255, 0.55)' : colors.textTertiary}>
        {label}
      </Text>
      <Text
        variant="metric"
        color={inverted ? colors.textOnInverted : colors.text}
        style={styles.clockValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    // The screen is driven by swipes, so a drag must not select text.
    userSelect: 'none',
  },
  containerInverted: {
    backgroundColor: colors.inverted,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  namePress: {
    flex: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dotsTrigger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
  dotsTriggerPressed: {
    opacity: 0.5,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  dotInverted: {
    backgroundColor: colors.textOnInverted,
  },
  exerciseName: {
    letterSpacing: -0.4,
  },
  underName: {
    marginTop: spacing.xs,
  },
  nextExercise: {
    marginTop: spacing.xs,
  },
  phaseInstruction: {
    marginTop: spacing.xs,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  ring: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  ringButtonGroup: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  ringButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringButtonDisabled: {
    opacity: 0.35,
  },
  ringButtonText: {
    fontSize: 26,
    lineHeight: 44,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text,
  },
  ringButtonLabel: {
    fontSize: 11,
  },
  clocks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  summary: {
    marginTop: spacing.xxl,
    gap: spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryStat: {
    flex: 1,
    gap: spacing.xxs,
  },
  summaryValue: {
    fontVariant: ['tabular-nums'],
  },
  clock: {
    alignItems: 'center',
    gap: 2,
  },
  clockValue: {
    fontVariant: ['tabular-nums'],
  },
  inputs: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  input: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  confirm: {
    gap: spacing.md,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmButton: {
    flex: 1,
  },
});
