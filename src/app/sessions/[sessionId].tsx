import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Card, Divider } from '@/components/card';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/states';
import { Text } from '@/components/text';
import { Field } from '@/components/text-input';
import { spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import type { SessionDetail } from '@/db/repositories/sessions';

import { useAsyncData } from '@/hooks/use-async-data';
import { useProfile } from '@/state/profile-context';
import { formatDuration, formatSessionDate, formatTimeOfDay } from '@/workouts/timer';
import { kgToLb } from '@/lib/units';
import { normalizeSetConfiguration } from '@/workouts/set-types';

/**
 * A finished session.
 *
 * The summary of what was done, edited in place: every logged set is an
 * editable weight and reps field, skipped sets stay marked, and adding or
 * removing a set happens right on the card.
 */
export default function SessionDetailScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();
  const system = profile?.system ?? 'metric';
  const unit = system === 'imperial' ? 'lb' : 'kg';
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const loader = useCallback(() => {
    const id = Number(sessionId);
    if (!sessionId || Number.isNaN(id)) {
      return Promise.resolve(null);
    }
    return database.getSessionDetail(id).catch((error) => {
      console.error('getSessionDetail failed', error);
      return null;
    });
  }, [database, sessionId]);
  const { data: detail, loading, reload } = useAsyncData(loader);

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  if (loading) {
    return <LoadingScreen label="Loading the session" />;
  }

  if (!detail || Number.isNaN(Number(sessionId))) {
    return (
      <Screen>
        <BackButton />
        <View style={styles.missing}>
          <EmptyState
            title="Session not found"
            description={`It may have been deleted from this device. (id: ${sessionId ?? 'none'})`}
          />
        </View>
      </Screen>
    );
  }

  const totalReps = detail.sets.reduce(
    (sum, set) => sum + (set.isCompleted ? (set.reps ?? 0) : 0),
    0
  );
  const volume = system === 'imperial' ? kgToLb(detail.totalVolumeKg) : detail.totalVolumeKg;
  const volumeUnit = system === 'imperial' ? 'lb' : 'kg';

  const saveSet = async (
    exercise: SessionDetail['exercises'][number],
    set: SessionDetail['sets'][number],
    values: { weight: string; reps: string }
  ): Promise<string | null> => {
    const displayedWeight = values.weight.trim() === '' ? null : Number(values.weight.replace(',', '.'));
    const parsedWeight = displayedWeight === null
      ? null
      : system === 'imperial'
        ? displayedWeight / 2.2046226218
        : displayedWeight;
    const parsedReps = values.reps.trim() === '' ? null : Number(values.reps);
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 500)) {
      return system === 'imperial'
        ? 'Enter a weight between 0 and 1,102 lb.'
        : 'Enter a weight between 0 and 500 kg.';
    }
    if (parsedReps !== null && (!Number.isInteger(parsedReps) || parsedReps < 0 || parsedReps > 500)) {
      return 'Enter a whole number of reps between 0 and 500.';
    }
    try {
      await database.logSet({
        sessionId: detail.id,
        exerciseId: exercise.exerciseId,
        setNumber: set.setNumber,
        weightKg: parsedWeight,
        reps: parsedReps,
        rpe: set.rpe,
        isCompleted: true,
        completedAt: set.completedAt,
        setKind: set.setKind,
        plannedSetNumber: set.plannedSetNumber,
        segmentNumber: set.segmentNumber,
        supersetRound: set.supersetRound,
      });
      await database.recalculateRecordsForSession(detail.id);
      await reload();
      return null;
    } catch {
      return 'This set could not be saved. Please try again.';
    }
  };

  const deleteSet = async (set: SessionDetail['sets'][number], exerciseId: number) => {
    try {
      await database.deleteSet(set.id);
      await database.recalculatePersonalRecords(exerciseId);
      await reload();
    } catch {
      // The list simply refreshes and the set is still there.
    }
  };

  const addSet = async (exercise: SessionDetail['exercises'][number]) => {
    const setNumber = detail.sets
      .filter((set) => set.exerciseId === exercise.exerciseId)
      .reduce((max, set) => Math.max(max, set.setNumber), 0) + 1;
    try {
      await database.logSet({
        sessionId: detail.id,
        exerciseId: exercise.exerciseId,
        setNumber,
        weightKg: null,
        reps: null,
        rpe: null,
        isCompleted: true,
        setKind: 'straight',
        plannedSetNumber: setNumber,
        segmentNumber: 1,
        supersetRound: null,
      });
      await reload();
    } catch {
      // Adding failed; nothing appears. A retry is available on the card.
    }
  };

  return (
    <Screen
      footer={
        <Button
          label="Finish"
          variant="primary"
          onPress={() => router.replace('/(tabs)/home')}
          testID="session-finish"
        />
      }>
      <BackButton onPress={() => router.back()} testID="session-back" />

      <View style={styles.header}>
        <ScreenHeader
          title={detail.title ?? 'Workout'}
          subtitle={`${formatSessionDate(detail.startedAt)} · ${formatTimeOfDay(detail.startedAt)}`}
        />
      </View>

      <View style={styles.stats}>
        <Stat
          label="Duration"
          value={formatDuration(detail.durationSeconds ?? 0)}
          testID="stat-duration"
        />
        <Stat label="Sets" value={String(detail.setsLogged)} testID="stat-sets" />
        <Stat label="Reps" value={String(totalReps)} testID="stat-reps" />
        <Stat
          label="Volume"
          value={`${Math.round(volume)} ${volumeUnit}`}
          testID="stat-volume"
        />
      </View>

      {detail.exercises.length === 0 ? (
        <View style={styles.missing}>
          <EmptyState
            title="Nothing logged"
            description="This session has no exercises recorded against it."
          />
        </View>
      ) : (
        <View style={styles.exercises}>
          {detail.exercises.map((exercise) => {
            const setConfig = normalizeSetConfiguration(exercise.setConfig, exercise.targetSets);
            const exerciseSets = detail.sets.filter(
              (set) => set.exerciseId === exercise.exerciseId
            );
            const completedExerciseSets = exerciseSets.filter((set) => set.isCompleted);
            const skippedExerciseSets = exerciseSets.length - completedExerciseSets.length;
            return (
              <Card key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseText}>
                    <Text variant="bodyStrong">{exercise.name}</Text>
                    <Text variant="caption">
                    {completedExerciseSets.length > 0
                        ? setConfig.warmups.length > 0 || setConfig.workSets.some((set) => set.style !== 'straight')
                          ? `${completedExerciseSets.length} sets logged${skippedExerciseSets > 0 ? ` · ${skippedExerciseSets} skipped` : ''}`
                          : `${completedExerciseSets.length} of ${exercise.targetSets} sets${skippedExerciseSets > 0 ? ` · ${skippedExerciseSets} skipped` : ''}`
                        : skippedExerciseSets > 0
                          ? `${skippedExerciseSets} skipped`
                        : exercise.status === 'skipped'
                          ? 'Skipped'
                          : 'Not logged'}
                    </Text>
                  </View>
                  <Text variant="caption" tone="textTertiary">
                    {exercise.muscleGroup}
                  </Text>
                </View>
                {exerciseSets.length > 0 ? (
                  <>
                    <Divider style={styles.divider} />
                    <View style={styles.sets}>
                      {exerciseSets.map((set) =>
                        set.isCompleted ? (
                          <EditableSetRow
                            key={set.id}
                            row={set}
                            unit={unit}
                            onSave={(values) => saveSet(exercise, set, values)}
                            onRemove={() => deleteSet(set, exercise.exerciseId)}
                          />
                        ) : (
                          <SkippedSetRow key={set.id} set={set} />
                        )
                      )}
                    </View>
                  </>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void addSet(exercise)}
                  style={({ pressed }) => [styles.addRow, pressed ? styles.addRowPressed : null]}
                  testID={`add-session-set-${exercise.id}`}>
                  <Text variant="label">+ Add set</Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

/**
 * A completed set, edited where it is shown. Weight and reps start from the
 * logged value (or empty if none was entered) and save when the field loses
 * focus. The set stays on screen while its fields remain editable.
 */
function EditableSetRow({
  row,
  unit,
  onSave,
  onRemove,
}: {
  row: SessionDetail['sets'][number];
  unit: 'kg' | 'lb';
  onSave: (values: { weight: string; reps: string }) => Promise<string | null>;
  onRemove: () => void | Promise<void>;
}) {
  const numberLabel = row.setKind === 'warmup'
    ? `W${row.segmentNumber}`
    : row.setKind === 'drop'
      ? `${row.plannedSetNumber ?? row.setNumber}.${row.segmentNumber}`
      : String(row.plannedSetNumber ?? row.setNumber);

  const initialWeight = row.weightKg == null
    ? ''
    : String(unit === 'lb' ? Number(kgToLb(row.weightKg).toFixed(1)) : row.weightKg);
  const initialReps = row.reps == null ? '' : String(row.reps);

  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const commit = async () => {
    if (weight === initialWeight && reps === initialReps) {
      return;
    }
    setError(await onSave({ weight, reps }));
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await onRemove();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <View style={styles.setBlock} testID={`set-${row.id}`}>
      <View style={styles.setHead}>
        <Text variant="caption" tone="textTertiary" style={styles.setNumber}>
          {numberLabel}
        </Text>
        <Text variant="caption" tone="textTertiary" style={styles.setHint}>
          {setKindHint(row)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void remove()}
          disabled={removing}
          style={[styles.setRemove, removing ? styles.setRemoveDisabled : null]}
          testID={`remove-set-${row.id}`}>
          <Text variant="caption" tone="danger">
            {removing ? 'Removing…' : 'Remove'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.setFields}>
        <Field
          label="Weight"
          value={weight}
          onChangeText={(value) => {
            setWeight(value);
            if (error) setError(null);
          }}
          keyboardType="decimal-pad"
          suffix={unit}
          placeholder="0"
          invalid={Boolean(error)}
          onBlur={() => void commit()}
          testID={`session-set-${row.id}-weight`}
          style={styles.setField}
        />
        <Field
          label="Reps"
          value={reps}
          onChangeText={(value) => {
            setReps(value);
            if (error) setError(null);
          }}
          keyboardType="number-pad"
          placeholder="0"
          onBlur={() => void commit()}
          onSubmitEditing={() => void commit()}
          returnKeyType="done"
          testID={`session-set-${row.id}-reps`}
          style={styles.setField}
        />
      </View>
      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
    </View>
  );
}

/** A set that was not completed — shown as a quiet record, never editable. */
function SkippedSetRow({ set }: { set: SessionDetail['sets'][number] }) {
  const numberLabel = set.setKind === 'warmup'
    ? `W${set.segmentNumber}`
    : set.setKind === 'drop'
      ? `${set.plannedSetNumber ?? set.setNumber}.${set.segmentNumber}`
      : String(set.plannedSetNumber ?? set.setNumber);
  return (
    <View style={styles.skippedRow} testID={`skipped-set-${set.id}`}>
      <Text variant="caption" tone="textTertiary" style={styles.setNumber}>
        {numberLabel}
      </Text>
      <Text variant="body" style={styles.skippedValue}>
        Skipped
      </Text>
    </View>
  );
}

function setKindHint(set: SessionDetail['sets'][number]): string {
  const labels = [
    set.setKind === 'warmup'
      ? 'Warm-up'
      : set.setKind === 'amrap'
        ? 'AMRAP'
        : set.setKind === 'drop'
          ? set.segmentNumber === 1 ? 'Main effort' : `Drop ${set.segmentNumber - 1}`
          : null,
    set.supersetRound !== null ? `Round ${set.supersetRound}` : null,
    set.rpe !== null ? `RPE ${set.rpe}` : null,
  ].filter((value): value is string => value !== null);
  return labels.join(' · ');
}

function Stat({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View style={styles.stat} testID={testID}>
      <Text variant="eyebrow">{label}</Text>
      <Text variant="metric">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
  },
  missing: {
    marginTop: spacing.xxxl,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  stat: {
    minWidth: 72,
    gap: 2,
  },
  exercises: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  exerciseCard: {
    gap: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    marginVertical: spacing.xs,
  },
  sets: {
    gap: spacing.md,
  },
  setBlock: {
    gap: spacing.sm,
  },
  setHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setNumber: {
    width: 24,
  },
  setHint: {
    flex: 1,
  },
  setRemove: {
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
  },
  setRemoveDisabled: {
    opacity: 0.5,
  },
  setFields: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  setField: {
    flex: 1,
  },
  skippedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.sm,
  },
  skippedValue: {
    color: '#A1A1A7',
  },
  addRow: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addRowPressed: {
    opacity: 0.55,
  },
});
