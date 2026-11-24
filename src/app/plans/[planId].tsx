import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { BottomSheet } from '@/components/bottom-sheet';
import { ExercisePicker } from '@/components/exercise-picker';
import { SetStyleSheet } from '@/components/set-style-sheet';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { StepContent } from '@/components/step-content';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { Field } from '@/components/text-input';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import type { Exercise } from '@/db/repositories/exercises';
import type { SplitType } from '@/db/repositories/plans';
import { useProfile } from '@/state/profile-context';
import {
  addExercise,
  createDraftForSplit,
  draftFromPlan,
  generateWorkoutExercises,
  moveExercise,
  removeExercise,
  replaceExercise,
  groupExercises,
  expandSupersetSelection,
  removeSupersetMember,
  ungroupExercise,
  updateSetConfiguration,
  toNewPlan,
  updateExercise,
  updateWorkout,
  validatePlanDraft,
  type ExerciseDraft,
  type PlanDraft,
} from '@/workouts/plan-draft';
import { formatRestDuration } from '@/workouts/timer';
import { defaultPlanName, templateFor } from '@/workouts/templates';

type BuilderStep =
  | { kind: 'split' }
  | { kind: 'name' }
  | { kind: 'workout'; index: number };

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'full_body', label: 'Full body' },
  { value: 'upper_lower', label: 'Upper / lower' },
  { value: 'push_pull_legs', label: 'Push / pull / legs' },
  { value: 'bro_split', label: 'Bro split' },
  { value: 'custom', label: 'Custom' },
];

/**
 * The plan builder.
 *
 * A short flow: pick the split, name the plan, then build one workout at a
 * time. Every workout of a split is its own step, so a push/pull/legs plan is
 * built as push, then pull, then legs.
 */
export default function PlanBuilderScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();
  const params = useLocalSearchParams<{
    planId: string;
    returnTo?: string;
    workout?: string;
  }>();
  const planId = params.planId ?? 'new';
  const isNew = planId === 'new';
  /**
   * Where to go after a new plan is saved.
   *
   * The builder is reached from several places — the workouts list, the start
   * screen — and each of them wants the user back once the plan exists.
   */
  const returnTo =
    params.returnTo === 'start' ? '/start' : params.returnTo === 'workouts' ? '/workouts' : null;

  const [step, setStep] = useState<BuilderStep>({ kind: 'split' });
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [library, setLibrary] = useState<Map<string, Exercise>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<{
    workoutKey: string;
    exerciseKey: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [setStyleFor, setSetStyleFor] = useState<string | null>(null);
  const [supersetSelection, setSupersetSelection] = useState<string[]>([]);
  const [groupChoice, setGroupChoice] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const exercises = await database.listExercises();
      if (cancelled) {
        return;
      }
      const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]));
      setLibrary(byName);

      if (isNew) {
        setDraft(createDraftForSplit('full_body', byName));
        return;
      }

      const id = Number(planId);
      const plan = await database.getPlan(id);
      if (!plan) {
        setError('That plan could not be found.');
        return;
      }
      const workouts = await database.listWorkoutsForPlan(id);
      const withExercises = [];
      for (const workout of workouts) {
        const details = await database.getWorkout(workout.id);
        if (details) {
          withExercises.push(details);
        }
      }
      if (cancelled) {
        return;
      }
      setDraft(draftFromPlan(plan, withExercises, plan.schedule));
      // An existing plan opens on one of its workouts — the one asked for, or
      // its first one.
      const requested = Number(params.workout ?? 0);
      const index =
        Number.isInteger(requested) && requested >= 0
          ? Math.min(requested, Math.max(0, withExercises.length - 1))
          : 0;
      setStep({ kind: 'workout', index });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [database, isNew, params.workout, planId]);

  const go = useCallback((next: BuilderStep, way: 'forward' | 'back' = 'forward') => {
    setDirection(way);
    setStep(next);
    setHint(null);
  }, []);

  const handleSplit = useCallback(
    (splitType: SplitType) => {
      if (!draft) {
        return;
      }
      if (splitType === draft.splitType) {
        go({ kind: 'name' });
        return;
      }
      setDraft(createDraftForSplit(splitType, library));
      go({ kind: 'name' });
    },
    [draft, go, library]
  );

  const handleSave = useCallback(async () => {
    if (!draft) {
      return;
    }
    const problems = validatePlanDraft(draft);
    if (Object.keys(problems).length > 0) {
      setError(problems.workouts ?? problems.exercises ?? problems.name ?? null);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = toNewPlan(draft);
      const saved = isNew
        ? await database.createPlan(payload)
        : await database.updatePlan(Number(planId), payload);
      if (saved && isNew && returnTo) {
        // Back to wherever the builder was opened from. `dismissTo` pops that
        // screen back into view when it is already underneath, so the flow
        // never leaves a second copy of it on the stack.
        router.dismissTo(returnTo);
      } else if (saved && isNew) {
        router.replace(`/plans/${saved.id}`);
      } else {
        router.back();
      }
    } catch {
      setError('The plan could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [database, draft, isNew, planId, returnTo, router]);

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  if (!draft) {
    return <LoadingScreen label={error ? 'Opening the plan' : 'Loading the plan'} />;
  }

  const currentWorkout =
    step.kind === 'workout' ? (draft.workouts[step.index] ?? null) : null;
  const isLastWorkout =
    step.kind === 'workout' && step.index >= draft.workouts.length - 1;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {step.kind === 'workout' ? (
            <>
              {draft.splitType === 'custom' ? (
                <Button
                  label="Add workout"
                  variant="secondary"
                  onPress={() => {
                    const next = {
                      ...draft,
                      workouts: [
                        ...draft.workouts,
                        {
                          key: `w${draft.workouts.length}`,
                          name: `Workout ${draft.workouts.length + 1}`,
                          exercises: [],
                        },
                      ],
                    };
                    setDraft(next);
                    go({ kind: 'workout', index: draft.workouts.length });
                  }}
                  style={styles.footerSecondary}
                  testID="builder-add-workout"
                />
              ) : null}
              <Button
                label={isLastWorkout ? 'Save plan' : 'Next'}
                onPress={() => {
                  if (isLastWorkout) {
                    void handleSave();
                    return;
                  }
                  go({ kind: 'workout', index: step.index + 1 });
                }}
                loading={saving}
                style={styles.footerPrimary}
                testID="builder-next"
              />
            </>
          ) : step.kind === 'name' ? (
            <Button
              label="Continue"
              onPress={() => go({ kind: 'workout', index: 0 })}
              style={styles.footerPrimary}
              testID="builder-continue"
            />
          ) : null}
        </View>
      }>
      <View style={styles.topBar}>
        <BackButton
          onPress={() => {
            if (step.kind === 'split') {
              router.back();
              return;
            }
            if (step.kind === 'name') {
              go({ kind: 'split' }, 'back');
              return;
            }
            if (step.index === 0) {
              go({ kind: 'name' }, 'back');
              return;
            }
            go({ kind: 'workout', index: step.index - 1 }, 'back');
          }}
          testID="builder-back"
        />
      </View>

      {error ? (
        <Text variant="caption" tone="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {step.kind === 'split' ? (
        <StepContent key="split" direction={direction}>
          <View style={styles.step}>
            <Text variant="title">Split</Text>
            <View style={styles.options}>
              {SPLIT_OPTIONS.map((option) => {
                const selected = draft.splitType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                    onPress={() => handleSplit(option.value)}
                    style={({ pressed }) => [
                      styles.option,
                      selected ? styles.optionSelected : null,
                      pressed ? styles.optionPressed : null,
                    ]}
                    testID={`split-${option.value}`}>
                    <Text variant="bodyStrong" tone={selected ? 'text' : 'textSecondary'}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!isNew ? (
              <Text variant="caption" style={styles.note}>
                Changing the split replaces the workouts in this plan.
              </Text>
            ) : null}
          </View>
        </StepContent>
      ) : null}

      {step.kind === 'name' ? (
        <StepContent key="name" direction={direction}>
          <View style={styles.step}>
            <Text variant="title">Name</Text>
            <Field
              label=""
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder={defaultPlanName(draft.splitType)}
              autoCapitalize="words"
              testID="builder-name"
            />
          </View>
        </StepContent>
      ) : null}

      {step.kind === 'workout' && currentWorkout ? (
        <StepContent key={`workout-${currentWorkout.key}`} direction={direction}>
          <View style={styles.step}>
            <Field
              label="Workout"
              value={currentWorkout.name}
              onChangeText={(name) =>
                setDraft(updateWorkout(draft, currentWorkout.key, { name }))
              }
              placeholder="Push"
              autoCapitalize="words"
              testID="builder-workout-name"
            />

            {currentWorkout.exercises.length === 0 ? (
              <View style={styles.emptyActions}>
                {templateFor(draft.splitType) ? (
                  <Button
                    label="Generate"
                    onPress={() => {
                      setDraft({
                        ...draft,
                        workouts: draft.workouts.map((workout) =>
                          workout.key === currentWorkout.key
                            ? generateWorkoutExercises(
                                workout,
                                draft.splitType,
                                step.index,
                                library
                              )
                            : workout
                        ),
                      });
                      setHint('A starting point, not a prescription.');
                    }}
                    testID="builder-generate"
                  />
                ) : null}
                <Button
                  label="Add exercise"
                  variant={templateFor(draft.splitType) ? 'secondary' : 'primary'}
                  onPress={() => setPickerFor(currentWorkout.key)}
                  testID="builder-add-exercise"
                />
              </View>
            ) : (
              <>
                <View style={styles.list}>
                  {currentWorkout.exercises.map((exercise) => (
                    <ExerciseRow
                      key={exercise.key}
                      exercise={exercise}
                      supersetLabel={getSupersetLabel(currentWorkout.exercises, exercise.supersetGroup)}
                      selectedForSuperset={supersetSelection.includes(exercise.key)}
                      selectingSuperset={supersetSelection.length > 0}
                      onSelectForSuperset={() => setSupersetSelection((selected) =>
                        selected.includes(exercise.key)
                          ? selected.filter((key) => key !== exercise.key)
                          : [...selected, exercise.key]
                      )}
                      onSetStyle={() => setSetStyleFor(exercise.key)}
                      onUngroup={() => setDraft({
                        ...draft,
                        workouts: draft.workouts.map((workout) =>
                          workout.key === currentWorkout.key
                            ? ungroupExercise(workout, exercise.key)
                            : workout
                        ),
                      })}
                      onRemoveFromSuperset={() => setDraft({
                        ...draft,
                        workouts: draft.workouts.map((workout) =>
                          workout.key === currentWorkout.key
                            ? removeSupersetMember(workout, exercise.key)
                            : workout
                        ),
                      })}
                      expanded={expanded === `${currentWorkout.key}:${exercise.key}`}
                      onToggle={() =>
                        setExpanded((current) =>
                          current === `${currentWorkout.key}:${exercise.key}`
                            ? null
                            : `${currentWorkout.key}:${exercise.key}`
                        )
                      }
                      onDelete={() => {
                        setDraft({
                          ...draft,
                          workouts: draft.workouts.map((workout) =>
                            workout.key === currentWorkout.key
                              ? removeExercise(workout, exercise.key)
                              : workout
                          ),
                        });
                        setExpanded(null);
                        setSupersetSelection((selected) => selected.filter((key) => key !== exercise.key));
                      }}
                      onChange={(patch) =>
                        setDraft({
                          ...draft,
                          workouts: draft.workouts.map((workout) =>
                            workout.key === currentWorkout.key
                              ? updateExercise(workout, exercise.key, patch)
                              : workout
                          ),
                        })
                      }
                      onMove={(direction) =>
                        setDraft({
                          ...draft,
                          workouts: draft.workouts.map((workout) =>
                            workout.key === currentWorkout.key
                              ? moveExercise(workout, exercise.key, direction)
                              : workout
                          ),
                        })
                      }
                      onReplace={() => {
                        setReplacing({
                          workoutKey: currentWorkout.key,
                          exerciseKey: exercise.key,
                        });
                        setPickerFor(currentWorkout.key);
                      }}
                    />
                  ))}
                </View>

                <View style={styles.listActions}>
                  {supersetSelection.length > 0 ? (
                    <>
                      <Button
                        label={`Group ${supersetSelection.length} exercises`}
                        variant="primary"
                        size="md"
                        disabled={supersetSelection.length < 2}
                        onPress={() => {
                          if (supersetSelection.length < 2) return;
                          const expandedSelection = expandSupersetSelection(currentWorkout, supersetSelection);
                          const selected = currentWorkout.exercises.filter((item) => expandedSelection.includes(item.key));
                          const counts = new Set(selected.map((item) => item.targetSets));
                          if (counts.size > 1) {
                            setGroupChoice(expandedSelection);
                            return;
                          }
                          setDraft({
                            ...draft,
                            workouts: draft.workouts.map((workout) =>
                              workout.key === currentWorkout.key
                                ? groupExercises(workout, expandedSelection, false)
                                : workout
                            ),
                          });
                          setSupersetSelection([]);
                        }}
                        testID="group-selected-exercises"
                      />
                      <Button
                        label="Cancel selection"
                        variant="ghost"
                        size="md"
                        onPress={() => setSupersetSelection([])}
                      />
                    </>
                  ) : (
                    <Button
                      label="Create superset"
                      variant="ghost"
                      size="md"
                      onPress={() => setSupersetSelection([currentWorkout.exercises[0]?.key ?? ''].filter(Boolean))}
                      disabled={currentWorkout.exercises.length < 2}
                      testID="start-superset-selection"
                    />
                  )}
                  <Button
                    label="Add exercise"
                    variant="secondary"
                    size="md"
                    onPress={() => setPickerFor(currentWorkout.key)}
                    testID="builder-add-exercise"
                  />
                  {templateFor(draft.splitType) ? (
                    <Button
                      label="Regenerate"
                      variant="ghost"
                      size="md"
                      onPress={() => {
                        setDraft({
                          ...draft,
                          workouts: draft.workouts.map((workout) =>
                            workout.key === currentWorkout.key
                              ? generateWorkoutExercises(
                                  workout,
                                  draft.splitType,
                                  step.index,
                                  library
                                )
                              : workout
                          ),
                        });
                        setHint('A starting point, not a prescription.');
                      }}
                      testID="builder-regenerate"
                    />
                  ) : null}
                  {currentWorkout.id ? (
                    <Button
                      label="Open workout"
                      variant="ghost"
                      size="md"
                      onPress={() => router.push(`/workouts/${currentWorkout.id}`)}
                      testID="builder-open-workout"
                    />
                  ) : null}
                </View>
              </>
            )}

            {hint ? (
              <Text variant="caption" style={styles.note}>
                {hint}
              </Text>
            ) : null}
          </View>
        </StepContent>
      ) : null}

      <ExercisePicker
        visible={pickerFor !== null}
        excludeIds={
          pickerFor
            ? (draft.workouts.find((workout) => workout.key === pickerFor)?.exercises ?? []).map(
                (exercise) => exercise.exerciseId
              )
            : []
        }
        onClose={() => {
          setPickerFor(null);
          setReplacing(null);
        }}
        onSelect={(exercise) => {
          if (!pickerFor) {
            return;
          }
          setDraft({
            ...draft,
            workouts: draft.workouts.map((workout) => {
              if (workout.key !== pickerFor) {
                return workout;
              }
              return replacing && replacing.workoutKey === workout.key
                ? replaceExercise(workout, replacing.exerciseKey, exercise)
                : addExercise(workout, exercise);
            }),
          });
          setPickerFor(null);
          setReplacing(null);
        }}
        onCreate={(exercise) => {
          if (!pickerFor) {
            return;
          }
          setDraft({
            ...draft,
            workouts: draft.workouts.map((workout) =>
              workout.key === pickerFor ? addExercise(workout, exercise) : workout
            ),
          });
          setPickerFor(null);
        }}
      />
      {currentWorkout && setStyleFor ? (
        <SetStyleSheet
          visible
          exerciseName={currentWorkout.exercises.find((item) => item.key === setStyleFor)?.name ?? ''}
          targetSets={currentWorkout.exercises.find((item) => item.key === setStyleFor)?.targetSets ?? 1}
          configuration={currentWorkout.exercises.find((item) => item.key === setStyleFor)?.setConfig ?? { warmups: [], workSets: [] }}
          system={profile?.system ?? 'metric'}
          onClose={() => setSetStyleFor(null)}
          onSave={(configuration) => {
            setDraft({
              ...draft,
              workouts: draft.workouts.map((workout) =>
                workout.key === currentWorkout.key
                  ? updateSetConfiguration(workout, setStyleFor, configuration)
                  : workout
              ),
            });
            setSetStyleFor(null);
          }}
        />
      ) : null}
      {groupChoice ? (
        <BottomSheet
          visible
          title="Set superset rounds"
          onClose={() => setGroupChoice(null)}
          testID="superset-round-choice">
          <Text variant="body">
            These exercises have different set counts. Match all to {Math.max(...currentWorkout!.exercises.filter((item) => groupChoice.includes(item.key)).map((item) => item.targetSets))} rounds, or superset the shared rounds and keep extra sets afterward?
          </Text>
          <Button
            label={`Match all to ${Math.max(...currentWorkout!.exercises.filter((item) => groupChoice.includes(item.key)).map((item) => item.targetSets))} rounds`}
            onPress={() => {
              setDraft({ ...draft, workouts: draft.workouts.map((workout) => workout.key === currentWorkout?.key ? groupExercises(workout, groupChoice, true) : workout) });
              setSupersetSelection([]);
              setGroupChoice(null);
            }}
            testID="superset-match-rounds"
          />
          <Button
            label="Keep extra sets afterward"
            variant="secondary"
            onPress={() => {
              setDraft({ ...draft, workouts: draft.workouts.map((workout) => workout.key === currentWorkout?.key ? groupExercises(workout, groupChoice, false) : workout) });
              setSupersetSelection([]);
              setGroupChoice(null);
            }}
            testID="superset-keep-extra-sets"
          />
          <Button label="Cancel" variant="ghost" onPress={() => setGroupChoice(null)} />
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

function ExerciseRow({
  exercise,
  supersetLabel,
  expanded,
  onToggle,
  onDelete,
  onChange,
  onMove,
  onReplace,
  selectingSuperset,
  selectedForSuperset,
  onSelectForSuperset,
  onSetStyle,
  onUngroup,
  onRemoveFromSuperset,
}: {
  exercise: ExerciseDraft;
  supersetLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<ExerciseDraft>) => void;
  onMove: (direction: -1 | 1) => void;
  onReplace: () => void;
  selectingSuperset: boolean;
  selectedForSuperset: boolean;
  onSelectForSuperset: () => void;
  onSetStyle: () => void;
  onUngroup: () => void;
  onRemoveFromSuperset: () => void;
}) {
  const advancedStyles = exercise.setConfig.workSets.filter((set) => set.style !== 'straight');
  return (
    <View>
      <SwipeToDelete
        onDelete={onDelete}
        accessibilityLabel={`${exercise.name}, swipe to remove`}
        testID={`swipe-${exercise.key}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${exercise.name}, ${exercise.targetSets} sets of ${exercise.repRangeMin} to ${exercise.repRangeMax} reps`}
          onPress={onToggle}
          style={({ pressed }) => [styles.exercise, pressed ? styles.exercisePressed : null]}>
          <View style={styles.exerciseText}>
            <Text variant="bodyStrong">{exercise.name}</Text>
            <Text variant="caption">
              {exercise.targetSets} × {exercise.repRangeMin}–{exercise.repRangeMax} ·{' '}
              {formatRestDuration(exercise.restSeconds)}
            </Text>
            {exercise.supersetGroup ? <Text variant="caption">Superset {supersetLabel ?? ''} · {exercise.targetSets} rounds</Text> : null}
            {exercise.setConfig.warmups.length > 0 || advancedStyles.length > 0 ? (
              <Text variant="caption" tone="textSecondary">
                {[
                  exercise.setConfig.warmups.length > 0 ? `${exercise.setConfig.warmups.length} warm-up${exercise.setConfig.warmups.length === 1 ? '' : 's'}` : null,
                  advancedStyles.length > 0 ? advancedStyles.map((set) => set.style === 'amrap' ? 'AMRAP' : 'Drop set').filter((value, index, all) => all.indexOf(value) === index).join(', ') : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          {selectingSuperset ? (
            <Text variant="caption" tone={selectedForSuperset ? 'text' : 'textTertiary'}>
              {selectedForSuperset ? 'Selected' : 'Select'}
            </Text>
          ) : <Text variant="caption" tone="textTertiary">{expanded ? 'Close' : 'Edit'}</Text>}
        </Pressable>
      </SwipeToDelete>

      {selectingSuperset ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selectedForSuperset }}
          accessibilityLabel={`${selectedForSuperset ? 'Remove' : 'Add'} ${exercise.name} ${selectedForSuperset ? 'from' : 'to'} superset selection`}
          onPress={onSelectForSuperset}
          style={styles.supersetToggle}>
          <Text variant="caption">{selectedForSuperset ? '✓ Selected for superset' : 'Select for superset'}</Text>
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={styles.editor}>
          <View style={styles.editorRow}>
            <Field
              label="Sets"
              value={String(exercise.targetSets)}
              onChangeText={(value) => onChange({ targetSets: clampInt(value, 1, 20, exercise.targetSets) })}
              keyboardType="number-pad"
              style={styles.editorField}
            />
            <Field
              label="From"
              value={String(exercise.repRangeMin)}
              onChangeText={(value) => onChange({ repRangeMin: clampInt(value, 0, 100, exercise.repRangeMin) })}
              keyboardType="number-pad"
              style={styles.editorField}
            />
            <Field
              label="To"
              value={String(exercise.repRangeMax)}
              onChangeText={(value) => onChange({ repRangeMax: clampInt(value, 0, 100, exercise.repRangeMax) })}
              keyboardType="number-pad"
              style={styles.editorField}
            />
          </View>
          <Field
            label="Rest (seconds)"
            value={String(exercise.restSeconds)}
            onChangeText={(value) => onChange({ restSeconds: clampInt(value, 0, 1800, exercise.restSeconds) })}
            keyboardType="number-pad"
          />
          <View style={styles.editorActions}>
            <Button
              label="Set style"
              variant="secondary"
              size="md"
              onPress={onSetStyle}
              testID={`set-style-${exercise.key}`}
            />
            {exercise.supersetGroup ? (
              <>
                <Button label="Remove from superset" variant="secondary" size="md" onPress={onRemoveFromSuperset} />
                <Button label="Ungroup all" variant="ghost" size="md" onPress={onUngroup} />
              </>
            ) : null}
            <Button
              label="Up"
              variant="ghost"
              size="md"
              onPress={() => onMove(-1)}
              style={styles.editorAction}
              testID="row-up"
            />
            <Button
              label="Down"
              variant="ghost"
              size="md"
              onPress={() => onMove(1)}
              style={styles.editorAction}
              testID="row-down"
            />
            <Button
              label="Replace"
              variant="ghost"
              size="md"
              onPress={onReplace}
              style={styles.editorAction}
              testID="row-replace"
            />
            <Button
              label="Remove"
              variant="ghost"
              size="md"
              onPress={onDelete}
              style={styles.editorAction}
              testID="row-remove"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function getSupersetLabel(exercises: ExerciseDraft[], group: string | null): string | undefined {
  if (!group) return undefined;
  const groups = [...new Set(
    exercises.map((exercise) => exercise.supersetGroup)
      .filter((value): value is string => Boolean(value))
  )];
  const index = groups.indexOf(group);
  return index >= 0 ? String.fromCharCode(65 + (index % 26)) : undefined;
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  optionSelected: {
    borderColor: colors.text,
  },
  optionPressed: {
    opacity: 0.6,
  },
  note: {
    marginTop: spacing.xs,
  },
  error: {
    marginTop: spacing.sm,
  },
  emptyActions: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  listActions: {
    gap: spacing.xs,
  },
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 56,
  },
  exercisePressed: {
    opacity: 0.6,
  },
  supersetToggle: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  editor: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  editorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editorField: {
    flex: 1,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  editorAction: {
    paddingHorizontal: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  footerPrimary: {
    flex: 1,
  },
  footerSecondary: {
    flexGrow: 0,
    flexBasis: 120,
  },
});
