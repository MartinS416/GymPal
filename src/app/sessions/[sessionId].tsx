import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { BackButton } from '@/components/back-button';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Card, Divider } from '@/components/card';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/states';
import { Text } from '@/components/text';
import { Field } from '@/components/text-input';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import type { SessionDetail } from '@/db/repositories/sessions';

import { useAsyncData } from '@/hooks/use-async-data';
import { useProfile } from '@/state/profile-context';
import { formatDuration, formatSessionDate, formatTimeOfDay } from '@/workouts/timer';
import { formatDecimal, kgToLb } from '@/lib/units';
import { normalizeSetConfiguration } from '@/workouts/set-types';

/**
 * A finished session.
 *
 * The summary of what was done: the exercises, the sets, the reps and the
 * volume.
 */
export default function SessionDetailScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();
  const system = profile?.system ?? 'metric';
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [editing, setEditing] = useState<{
    exercise: SessionDetail['exercises'][number];
    set: SessionDetail['sets'][number] | null;
    setNumber: number;
  } | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const openEditor = useCallback((
    exercise: SessionDetail['exercises'][number],
    set: SessionDetail['sets'][number] | null
  ) => {
    setEditing({
      exercise,
      set,
      setNumber: set?.setNumber ?? 1,
    });
    setWeight(set?.weightKg == null ? '' : String(
      system === 'imperial' ? Number(kgToLb(set.weightKg).toFixed(1)) : set.weightKg
    ));
    setReps(set?.reps == null ? '' : String(set.reps));
    setRpe(set?.rpe == null ? '' : String(set.rpe));
    setEditError(null);
    setConfirmDelete(false);
  }, [system]);

  const saveSet = useCallback(async () => {
    if (!editing || !detail) {
      return;
    }
    const displayedWeight = weight.trim() === '' ? null : Number(weight.replace(',', '.'));
    const parsedWeight = displayedWeight === null
      ? null
      : system === 'imperial'
        ? displayedWeight / 2.2046226218
        : displayedWeight;
    const parsedReps = reps.trim() === '' ? null : Number(reps);
    const parsedRpe = rpe.trim() === '' ? null : Number(rpe);
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 500)) {
      setEditError(system === 'imperial'
        ? 'Enter a weight between 0 and 1,102 lb.'
        : 'Enter a weight between 0 and 500 kg.');
      return;
    }
    if (parsedReps !== null && (!Number.isInteger(parsedReps) || parsedReps < 0 || parsedReps > 500)) {
      setEditError('Enter a whole number of reps between 0 and 500.');
      return;
    }
    if (parsedRpe !== null && (!Number.isFinite(parsedRpe) || parsedRpe < 1 || parsedRpe > 10)) {
      setEditError('RPE must be between 1 and 10.');
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await database.logSet({
        sessionId: detail.id,
        exerciseId: editing.exercise.exerciseId,
        setNumber: editing.setNumber,
        weightKg: parsedWeight,
        reps: parsedReps,
        rpe: parsedRpe,
        isCompleted: true,
        completedAt: editing.set?.completedAt ?? Date.now(),
        setKind: editing.set?.setKind ?? 'straight',
        plannedSetNumber: editing.set?.plannedSetNumber ?? editing.setNumber,
        segmentNumber: editing.set?.segmentNumber ?? 1,
        supersetRound: editing.set?.supersetRound ?? null,
      });
      await database.recalculateRecordsForSession(detail.id);
      setEditing(null);
      reload();
    } catch {
      setEditError('This set could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [database, detail, editing, reload, reps, rpe, system, weight]);

  const deleteSet = useCallback(async () => {
    if (!editing?.set || !detail) return;
    setSaving(true);
    try {
      await database.deleteSet(editing.set.id);
      await database.recalculatePersonalRecords(editing.exercise.exerciseId);
      setEditing(null);
      setConfirmDelete(false);
      reload();
    } catch {
      setEditError('This set could not be deleted. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [database, detail, editing, reload]);

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

  return (
    <Screen>
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
                      {exerciseSets.map((set) => (
                        <Pressable
                          key={set.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${setStyleLabel(set)}, ${formatSet(set.weightKg, set.reps, system)}`}
                          onPress={() => openEditor(exercise, set)}
                          style={({ pressed }) => [styles.setRow, pressed ? styles.pressed : null]}
                          testID={`edit-set-${set.id}`}>
                          <Text variant="caption" tone="textTertiary" style={styles.setNumber}>
                            {set.setKind === 'warmup'
                              ? `W${set.segmentNumber}`
                              : set.setKind === 'drop'
                                ? `${set.plannedSetNumber ?? set.setNumber}.${set.segmentNumber}`
                                : set.plannedSetNumber ?? set.setNumber}
                          </Text>
                          <Text variant="body" style={styles.setValue}>
                            {set.isCompleted ? formatSet(set.weightKg, set.reps, system) : 'Skipped'}
                          </Text>
                          <Text variant="caption" tone="textTertiary" style={styles.setRpe}>
                            {setRowHint(set)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
                <Button
                  label={exerciseSets.length > 0 ? 'Add set' : 'Log a set'}
                  variant="secondary"
                  size="md"
                  onPress={() => {
                    const nextSetNumber = exerciseSets.reduce(
                      (max, set) => Math.max(max, set.setNumber),
                      0
                    ) + 1;
                    openEditor(exercise, null);
                    setEditing({ exercise, set: null, setNumber: nextSetNumber });
                  }}
                  testID={`add-session-set-${exercise.id}`}
                />
              </Card>
            );
          })}
        </View>
      )}

      <BottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.set ? `Edit set ${editing.setNumber}` : `Log set ${editing?.setNumber ?? ''}`}
        testID="session-set-editor">
        <Text variant="caption" tone="textSecondary">
          {editing?.exercise.name} · Changes update this workout summary and your progress records.
        </Text>
        <View style={styles.editFields}>
          <Field
            label="Weight"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            suffix={system === 'imperial' ? 'lb' : 'kg'}
            placeholder="0"
            testID="session-edit-weight"
            style={styles.editField}
          />
          <Field
            label="Reps"
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder="0"
            testID="session-edit-reps"
            style={styles.editField}
          />
        </View>
        <Field
          label="RPE"
          value={rpe}
          onChangeText={setRpe}
          keyboardType="decimal-pad"
          placeholder="Optional"
          helper="Rate of perceived exertion, from 1 to 10."
          testID="session-edit-rpe"
        />
        {confirmDelete ? (
          <View style={styles.deleteConfirm}>
            <Text variant="caption" tone="danger">
              Delete this logged set? This cannot be undone.
            </Text>
            <Button
              label="Delete set"
              variant="secondary"
              loading={saving}
              onPress={() => void deleteSet()}
              testID="confirm-delete-session-set"
            />
            <Button
              label="Keep set"
              variant="ghost"
              disabled={saving}
              onPress={() => setConfirmDelete(false)}
            />
          </View>
        ) : null}
        {editError ? <Text variant="caption" tone="danger">{editError}</Text> : null}
        <Button
          label="Save set"
          onPress={() => void saveSet()}
          loading={saving}
          testID="save-session-set"
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setEditing(null)}
          disabled={saving}
          testID="cancel-session-set-edit"
        />
        {editing?.set && !confirmDelete ? (
          <Button
            label="Delete set"
            variant="ghost"
            onPress={() => setConfirmDelete(true)}
            testID="delete-session-set"
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/** A set, the way it is written in a log book: `60 kg × 8`. */
function formatSet(weightKg: number | null, reps: number | null, system: 'metric' | 'imperial'): string {
  const weight = weightKg === null
    ? null
    : system === 'imperial'
      ? `${Math.round(kgToLb(weightKg))} lb`
      : `${formatDecimal(weightKg)} kg`;
  if (weightKg === null && reps === null) {
    return '—';
  }
  if (weightKg === null) {
    return `× ${reps}`;
  }
  if (reps === null) {
    return weight ?? '—';
  }
  return `${weight} × ${reps}`;
}

function setStyleLabel(set: SessionDetail['sets'][number]): string {
  if (set.setKind === 'warmup') return `warm-up set ${set.segmentNumber}`;
  if (set.setKind === 'amrap') return `AMRAP set ${set.plannedSetNumber ?? set.setNumber}`;
  if (set.setKind === 'drop') return set.segmentNumber === 1
    ? `drop set main effort ${set.plannedSetNumber ?? set.setNumber}`
    : `drop ${set.segmentNumber - 1} for set ${set.plannedSetNumber ?? set.setNumber}`;
  return `set ${set.plannedSetNumber ?? set.setNumber}`;
}

function setRowHint(set: SessionDetail['sets'][number]): string {
  if (!set.isCompleted) return 'Skipped';
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
  return labels.join(' · ') || 'Edit';
}

function Stat({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {  return (
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
    gap: spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  setNumber: {
    width: 20,
  },
  setRpe: {
    marginLeft: 'auto',
  },
  setValue: {
    flex: 1,
  },
  pressed: {
    opacity: 0.55,
  },
  editFields: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editField: {
    flex: 1,
  },
  deleteConfirm: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  radius: {
    borderRadius: radius.pill,
  },
  colors: {
    backgroundColor: colors.background,
  },
});
