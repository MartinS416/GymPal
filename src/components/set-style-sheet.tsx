import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Field } from '@/components/text-input';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { kgToLb, lbToKg } from '@/lib/units';
import type { MeasurementSystem } from '@/lib/units';
import type {
  ExerciseSetConfiguration,
  SetStyle,
} from '@/workouts/set-types';
import { defaultWorkSet, normalizeSetConfiguration } from '@/workouts/set-types';

const STYLE_OPTIONS: { value: SetStyle; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'drop', label: 'Drop set' },
];

export function SetStyleSheet({
  visible,
  exerciseName,
  targetSets,
  configuration,
  system,
  onClose,
  onSave,
}: {
  visible: boolean;
  exerciseName: string;
  targetSets: number;
  configuration: ExerciseSetConfiguration;
  system: MeasurementSystem;
  onClose: () => void;
  onSave: (configuration: ExerciseSetConfiguration) => void;
}) {
  const [draft, setDraft] = useState(() => normalizeSetConfiguration(configuration, targetSets));
  const [error, setError] = useState<string | null>(null);
  const weightUnit = system === 'imperial' ? 'lb' : 'kg';

  const setWarmupCount = (count: number) => {
    const warmups = [...draft.warmups];
    while (warmups.length < count) {
      warmups.push({ weightKg: null, reps: null });
    }
    setDraft({ ...draft, warmups: warmups.slice(0, count) });
  };

  const setWorkStyle = (index: number, style: SetStyle) => {
    const workSets = [...draft.workSets];
    const previous = workSets[index] ?? defaultWorkSet();
    workSets[index] = {
      ...previous,
      style,
      dropSteps: style === 'drop'
        ? previous.dropSteps.length > 0 ? previous.dropSteps : [{ weightKg: null, reps: null }]
        : [],
    };
    setDraft({ ...draft, workSets });
  };

  const changeWarmup = (index: number, patch: Partial<(typeof draft.warmups)[number]>) => {
    const warmups = [...draft.warmups];
    warmups[index] = { ...warmups[index], ...patch };
    setDraft({ ...draft, warmups });
  };

  const changeDrop = (
    setIndex: number,
    dropIndex: number,
    patch: Partial<(typeof draft.workSets)[number]['dropSteps'][number]>
  ) => {
    const workSets = [...draft.workSets];
    const workSet = { ...(workSets[setIndex] ?? defaultWorkSet()) };
    const dropSteps = [...workSet.dropSteps];
    dropSteps[dropIndex] = { ...dropSteps[dropIndex], ...patch };
    workSets[setIndex] = { ...workSet, dropSteps };
    setDraft({ ...draft, workSets });
  };

  const save = () => {
    const values = [
      ...draft.warmups,
      ...draft.workSets.flatMap((set) => set.dropSteps),
    ];
    if (values.some((item) => item.weightKg !== null && item.weightKg > 500)) {
      setError('Loads must be 500 kg or less.');
      return;
    }
    if (values.some((item) => item.reps !== null && item.reps > 500) ||
        draft.workSets.some((set) => set.minReps !== null && set.minReps > 500)) {
      setError('Rep targets must be 500 or less.');
      return;
    }
    setError(null);
    onSave(normalizeSetConfiguration(draft, targetSets));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => onSave(normalizeSetConfiguration(draft, targetSets))}
      title="Set style"
      testID="set-style-sheet">
      <Text variant="caption" tone="textSecondary">
        {exerciseName} · Optional. Straight sets are the default.
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingText}>
              <Text variant="subheading">Warm-up sets</Text>
              <Text variant="caption" tone="textTertiary">Optional preparation before work sets</Text>
            </View>
            <View style={styles.counter}>
              <Button
                label="−"
                variant="secondary"
                size="md"
                accessibilityLabel="Remove a warm-up set"
                disabled={draft.warmups.length === 0}
                onPress={() => setWarmupCount(draft.warmups.length - 1)}
                testID="warmup-remove"
              />
              <Text variant="bodyStrong">{draft.warmups.length}</Text>
              <Button
                label="+"
                variant="secondary"
                size="md"
                accessibilityLabel="Add a warm-up set"
                disabled={draft.warmups.length >= 10}
                onPress={() => setWarmupCount(draft.warmups.length + 1)}
                testID="warmup-add"
              />
            </View>
          </View>
          {draft.warmups.map((warmup, index) => (
            <View key={`warmup-${index}`} style={styles.subset}>
              <Text variant="label">Warm-up {index + 1}</Text>
              <View style={styles.fields}>
                <Field
                  label="Load"
                  value={warmup.weightKg == null ? '' : formatWeightInput(warmup.weightKg, system)}
                  onChangeText={(value) => changeWarmup(index, { weightKg: parseWeight(value, system) })}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  suffix={weightUnit}
                  style={styles.field}
                  testID={`warmup-${index + 1}-weight`}
                />
                <Field
                  label="Reps"
                  value={warmup.reps == null ? '' : String(warmup.reps)}
                  onChangeText={(value) => changeWarmup(index, { reps: parseOptionalInt(value) })}
                  keyboardType="number-pad"
                  placeholder="Optional"
                  style={styles.field}
                  testID={`warmup-${index + 1}-reps`}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text variant="subheading">Work sets</Text>
          {Array.from({ length: targetSets }, (_, index) => {
            const workSet = draft.workSets[index] ?? defaultWorkSet();
            return (
              <View key={`work-${index}`} style={styles.subset}>
                <Text variant="label">Set {index + 1}</Text>
                <View style={styles.styleOptions} accessibilityRole="radiogroup">
                  {STYLE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      label={option.label}
                      variant={workSet.style === option.value ? 'primary' : 'secondary'}
                      size="md"
                      accessibilityRole="radio"
                      accessibilityState={{ checked: workSet.style === option.value }}
                      onPress={() => setWorkStyle(index, option.value)}
                      style={styles.styleButton}
                      testID={`work-set-${index + 1}-style-${option.value}`}
                    />
                  ))}
                </View>
                {workSet.style === 'amrap' ? (
                  <Field
                    label="Minimum reps (optional)"
                    value={workSet.minReps == null ? '' : String(workSet.minReps)}
                    onChangeText={(value) => {
                      const workSets = [...draft.workSets];
                      workSets[index] = { ...workSet, minReps: parseOptionalInt(value) };
                      setDraft({ ...draft, workSets });
                    }}
                    keyboardType="number-pad"
                    placeholder="Guidance only"
                    testID={`work-set-${index + 1}-amrap-min`}
                  />
                ) : null}
                {workSet.style === 'drop' ? (
                  <View style={styles.dropSection}>
                    <Text variant="caption" tone="textSecondary">
                      Drops happen after the main effort, without rest. Leave targets blank if you prefer to enter them during the workout.
                    </Text>
                    {workSet.dropSteps.map((step, dropIndex) => (
                      <View key={`drop-${dropIndex}`} style={styles.subset}>
                        <Text variant="label">Drop {dropIndex + 1}</Text>
                        <View style={styles.fields}>
                          <Field
                            label="Load"
                            value={step.weightKg == null ? '' : formatWeightInput(step.weightKg, system)}
                            onChangeText={(value) => changeDrop(index, dropIndex, { weightKg: parseWeight(value, system) })}
                            keyboardType="decimal-pad"
                            placeholder="Optional"
                            suffix={weightUnit}
                            style={styles.field}
                          />
                          <Field
                            label="Reps"
                            value={step.reps == null ? '' : String(step.reps)}
                            onChangeText={(value) => changeDrop(index, dropIndex, { reps: parseOptionalInt(value) })}
                            keyboardType="number-pad"
                            placeholder="Optional"
                            style={styles.field}
                          />
                        </View>
                      </View>
                    ))}
                    <Button
                      label="Add drop"
                      variant="secondary"
                      size="md"
                      disabled={workSet.dropSteps.length >= 5}
                      onPress={() => {
                        const workSets = [...draft.workSets];
                        workSets[index] = {
                          ...workSet,
                          dropSteps: [...workSet.dropSteps, { weightKg: null, reps: null }],
                        };
                        setDraft({ ...draft, workSets });
                      }}
                      testID={`work-set-${index + 1}-add-drop`}
                    />
                    {workSet.dropSteps.length > 1 ? (
                      <Button
                        label="Remove last drop"
                        variant="ghost"
                        size="md"
                        onPress={() => {
                          const workSets = [...draft.workSets];
                          workSets[index] = { ...workSet, dropSteps: workSet.dropSteps.slice(0, -1) };
                          setDraft({ ...draft, workSets });
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
      <Button label="Done" onPress={save} testID="save-set-style" />
      <Button label="Cancel" variant="ghost" onPress={onClose} testID="cancel-set-style" />
    </BottomSheet>
  );
}

function parseOptionalInt(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function parseWeight(value: string, system: MeasurementSystem): number | null {
  if (value.trim() === '') return null;
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) return null;
  return system === 'imperial' ? lbToKg(number) : number;
}

function formatWeightInput(weightKg: number, system: MeasurementSystem): string {
  const value = system === 'imperial' ? kgToLb(weightKg) : weightKg;
  return Number(value.toFixed(1)).toString();
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 520 },
  content: { gap: spacing.lg, paddingBottom: spacing.md },
  section: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headingText: { flex: 1, gap: spacing.xs },
  counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subset: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  fields: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  styleOptions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  styleButton: { flexGrow: 1, minWidth: 88 },
  dropSection: { gap: spacing.sm },
});
