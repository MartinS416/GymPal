import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label?: string;
  testID?: string;
};

/**
 * Restrained segmented control.
 *
 * The selected option is a white pill lifted out of a light grey track — no
 * colour, no shadow, no animation.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected ? styles.optionSelected : null,
              pressed && !selected ? styles.optionPressed : null,
            ]}>
            <Text
              variant="subheading"
              tone={selected ? 'text' : 'textSecondary'}
              numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm + 1,
    paddingHorizontal: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  optionPressed: {
    opacity: 0.6,
  },
});
