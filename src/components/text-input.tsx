import { useState } from 'react';
import type { ComponentRef, Ref } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions, StyleProp, TextInputProps, ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Unit suffix rendered inside the field, e.g. "cm" or "lb". */
  suffix?: string;
  /** Validation message. When present the field is marked invalid. */
  error?: string;
  /**
   * Marks the field as invalid without a message of its own.
   * Used by grouped fields where the message is shown under the last field.
   */
  invalid?: boolean;
  /** Non-validating helper text, hidden while an error is shown. */
  helper?: string;
  /** White on black, for the rest timer. */
  inverted?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCorrect?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  maxLength?: number;
  /** Optional wrapper style, used to lay fields out side by side. */
  style?: StyleProp<ViewStyle>;
  /** Allows the host screen to move focus between fields. */
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  testID?: string;
};

/**
 * Labelled text field.
 *
 * The label sits above the field, the unit (if any) sits inside the field on
 * the trailing edge, and validation messages appear underneath. Errors only
 * replace the helper line so the layout never shifts.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  error,
  invalid = false,
  helper,
  inverted = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete = 'off',
  autoCorrect = false,
  returnKeyType,
  onSubmitEditing,
  onBlur,
  maxLength,
  style,
  inputRef,
  testID,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error) || invalid;

  const invertedPalette = {
    label: 'rgba(255, 255, 255, 0.65)',
    placeholder: 'rgba(255, 255, 255, 0.35)',
    text: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.28)',
    fill: 'rgba(255, 255, 255, 0.06)',
    suffix: 'rgba(255, 255, 255, 0.55)',
    focus: '#FFFFFF',
  };

  const palette = inverted
    ? invertedPalette
    : {
        label: hasError ? colors.danger : colors.textSecondary,
        placeholder: colors.textTertiary,
        text: colors.text,
        border: hasError ? colors.danger : colors.border,
        fill: hasError ? colors.dangerSurface : colors.field,
        suffix: colors.textTertiary,
        focus: colors.text,
      };

  return (
    <View style={style}>
      <Text variant="label" color={palette.label} style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          { borderColor: palette.border, backgroundColor: palette.fill },
          focused ? { borderColor: palette.focus } : null,
        ]}>
        <TextInput
          testID={testID}
          ref={inputRef}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={[styles.input, { color: palette.text }]}
        />
        {suffix ? (
          <Text variant="subheading" color={palette.suffix} style={styles.suffix}>
            {suffix}
          </Text>
        ) : null}
      </View>
      {hasError ? (
        <Text variant="caption" tone="danger" style={styles.message}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color={inverted ? 'rgba(255, 255, 255, 0.6)' : undefined} style={styles.message}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.base,
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: colors.text,
  },
  inputWrapperError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  input: {
    flex: 1,
    // Without this the field keeps its intrinsic width and can push a row of
    // fields past the edge of the screen.
    minWidth: 0,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
    paddingVertical: spacing.md,
    // Removes the default focus ring on web.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  suffix: {
    color: colors.textTertiary,
  },
  message: {
    marginTop: spacing.xs + spacing.xxs,
  },
});
