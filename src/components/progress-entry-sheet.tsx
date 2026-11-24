import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Chevron } from '@/components/chevron';
import { DatePicker } from '@/components/date-picker';
import { Text } from '@/components/text';
import { Field } from '@/components/text-input';
import { colors, radius, spacing } from '@/constants/theme';
import { formatRelativeDate, startOfDay } from '@/lib/calendar';
import { formatDecimal, kgToLb, lbToKg, parseNumeric } from '@/lib/units';
import type { MeasurementSystem } from '@/lib/units';
import type { Metric } from '@/workouts/progress';

export type ProgressEntryInput = {
  valueKg: number;
  recordedAt: number;
  note: string | null;
};

export type ProgressEntrySheetProps = {
  visible: boolean;
  onClose: () => void;
  metric: Metric;
  system: MeasurementSystem;
  /** The entry being edited, or null to log a new one. */
  entry: { id: number; valueKg: number; recordedAt: number; note: string | null } | null;
  onSave: (input: ProgressEntryInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  testID?: string;
};

/**
 * The form for one measurement.
 *
 * It opens filled in with today, which is what the user wants nine times out of
 * ten; the calendar is there for the tenth. Saving writes straight to the
 * database, so the chart underneath is already updated when the sheet closes.
 */
export function ProgressEntrySheet({
  visible,
  onClose,
  metric,
  system,
  entry,
  onSave,
  onDelete,
  testID,
}: ProgressEntrySheetProps) {
  const title =
    metric.kind === 'body'
      ? entry
        ? 'Edit body weight'
        : 'Log body weight'
      : entry
        ? `Edit ${metric.name}`
        : `Log ${metric.name}`;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} testID={testID}>
      <EntryForm
        system={system}
        entry={entry}
        onSave={onSave}
        onClose={onClose}
        onDelete={onDelete}
      />
    </BottomSheet>
  );
}

type EntryFormProps = {
  system: MeasurementSystem;
  entry: ProgressEntrySheetProps['entry'];
  onSave: (input: ProgressEntryInput) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
};

function EntryForm({ system, entry, onSave, onClose, onDelete }: EntryFormProps) {
  const unit = system === 'imperial' ? 'lb' : 'kg';

  const [value, setValue] = useState(() =>
    entry
      ? formatDecimal(system === 'imperial' ? kgToLb(entry.valueKg) : entry.valueKg, 1)
      : ''
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [recordedAt, setRecordedAt] = useState(() =>
    startOfDay(entry?.recordedAt ?? Date.now())
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const submit = async () => {
    const parsed = parseNumeric(value);
    if (parsed === null || parsed <= 0) {
      setError('Enter a number above zero.');
      return;
    }
    const valueKg = system === 'imperial' ? lbToKg(parsed) : parsed;
    if (valueKg >= 1000) {
      setError('That is too heavy to record.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({ valueKg, recordedAt, note: note.trim().length > 0 ? note.trim() : null });
      onClose();
    } catch {
      setError('The entry could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <Field
            label="Weight"
            value={value}
            onChangeText={(next) => {
              setValue(next);
              if (error) {
                setError(null);
              }
            }}
            suffix={unit}
            placeholder="0"
            keyboardType="decimal-pad"
            error={error ?? undefined}
            testID="entry-value"
          />

          <View style={styles.calendarBlock}>
            <Text variant="label" tone="textSecondary">
              Date
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change the date"
              accessibilityState={{ expanded: calendarOpen }}
              testID="entry-date-toggle"
              onPress={() => setCalendarOpen((open) => !open)}
              style={({ pressed }) => [styles.dateRow, pressed ? styles.dateRowPressed : null]}>
              <Text variant="body">{formatRelativeDate(recordedAt, now)}</Text>
              <Chevron direction={calendarOpen ? 'up' : 'down'} />
            </Pressable>
            {calendarOpen ? (
              <DatePicker value={recordedAt} onChange={setRecordedAt} testID="entry-date" />
            ) : null}
          </View>

          <Field
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            helper="How it felt, what changed."
            testID="entry-note"
          />
        </View>
      </ScrollView>

      <Button
        label={entry ? 'Save changes' : 'Save entry'}
        onPress={() => {
          void submit();
        }}
        loading={saving}
        testID="entry-save"
      />

      {entry && onDelete ? (
        <Button
          label="Delete entry"
          variant="ghost"
          size="md"
          onPress={() => {
            void onDelete().then(onClose);
          }}
          testID="entry-delete"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 460,
  },
  form: {
    gap: spacing.base,
    paddingBottom: spacing.sm,
  },
  calendarBlock: {
    gap: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.base,
    minHeight: 52,
  },
  dateRowPressed: {
    borderColor: colors.text,
  },
});
