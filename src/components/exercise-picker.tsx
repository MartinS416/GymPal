import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/text-input';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import type { Exercise } from '@/db/repositories/exercises';

export type ExercisePickerProps = {
  visible: boolean;
  /** Exercises already in the workout, so they can be hidden. */
  excludeIds?: number[];
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** Called when the user creates an exercise that is not in the library. */
  onCreate?: (exercise: Exercise) => void;
};

/**
 * The exercise library.
 *
 * Everything is local: the seeded library plus any exercise the user has
 * added. Searching covers the name, the muscle group and the equipment.
 */
export function ExercisePicker({
  visible,
  excludeIds = [],
  onClose,
  onSelect,
  onCreate,
}: ExercisePickerProps) {
  const database = useDatabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState('');
  const [newEquipment, setNewEquipment] = useState('');

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    const search = async () => {
      const found = await database.searchExercises(query);
      if (!cancelled) {
        setResults(found);
      }
    };
    void search();
    return () => {
      cancelled = true;
    };
  }, [database, query, visible]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (name.length === 0) {
      return;
    }
    const created = await database.createExercise({
      name,
      muscleGroup: newMuscleGroup.trim() || 'Other',
      equipment: newEquipment.trim() || 'Other',
    });
    setCreating(false);
    setNewName('');
    setNewMuscleGroup('');
    setNewEquipment('');
    onCreate?.(created);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="title">Exercise library</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed ? styles.closePressed : null]}
            testID="exercise-picker-close">
            <Text variant="subheading">Done</Text>
          </Pressable>
        </View>

        <View style={styles.search}>
          <Field
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Bench, quads, barbell…"
            autoCapitalize="none"
            autoCorrect={false}
            testID="exercise-search"
          />
        </View>

        {creating ? (
          <View style={styles.form}>
            <Field
              label="Exercise name"
              value={newName}
              onChangeText={setNewName}
              placeholder="Cable Y Raise"
              testID="custom-exercise-name"
            />
            <Field
              label="Muscle group"
              value={newMuscleGroup}
              onChangeText={setNewMuscleGroup}
              placeholder="Shoulders"
            />
            <Field
              label="Equipment"
              value={newEquipment}
              onChangeText={setNewEquipment}
              placeholder="Cable"
            />
            <View style={styles.formActions}>
              <Button
                label="Cancel"
                variant="secondary"
                size="md"
                onPress={() => setCreating(false)}
                style={styles.formButton}
              />
              <Button
                label="Add exercise"
                size="md"
                onPress={handleCreate}
                style={styles.formButton}
                testID="custom-exercise-save"
              />
            </View>
          </View>
        ) : (
          <FlatList
            data={results.filter((exercise) => !excluded.has(exercise.id))}
            keyExtractor={(exercise) => String(exercise.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text variant="caption" style={styles.empty}>
                Nothing in the library matches “{query}”.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.muscleGroup}, ${item.equipment}`}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
                testID={`exercise-option-${item.id}`}>
                <View style={styles.rowText}>
                  <Text variant="bodyStrong">{item.name}</Text>
                  <Text variant="caption">
                    {item.muscleGroup} · {item.equipment}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}

        {!creating ? (
          <View style={styles.footer}>
            <Button
              label="Add a custom exercise"
              variant="secondary"
              size="md"
              onPress={() => setCreating(true)}
              testID="exercise-create"
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.base,
  },
  close: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  closePressed: {
    opacity: 0.6,
  },
  search: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xxs,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowText: {
    gap: 2,
  },
  empty: {
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.base,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formButton: {
    flex: 1,
  },
});
