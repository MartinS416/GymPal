import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
};

export type ChipRowProps<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testID?: string;
  /** Prefix for each chip's test id: `${testIDPrefix}-${value}`. */
  testIDPrefix?: string;
};

/** A horizontal row of single-choice pills. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
  testIDPrefix,
}: ChipRowProps<T>) {
  const haptics = useHaptics();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!selected) {
                haptics.tick();
                onChange(option.value);
              }
            }}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.selected : null,
              pressed && !selected ? styles.pressed : null,
            ]}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}>
            <Text variant="caption" style={[styles.label, selected ? styles.labelSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.inverted,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelSelected: {
    color: colors.textOnInverted,
  },
});
