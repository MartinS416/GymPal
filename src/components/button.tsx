import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  /** Renders for use on an inverted (dark) surface, e.g. the rest screen. */
  inverted?: boolean;
  /** Optional secondary line under the label. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean; expanded?: boolean; selected?: boolean };
};

/**
 * The single button primitive.
 *
 * `primary` is the inverted (black) call to action, `secondary` is an outlined
 * action and `ghost` is a low-emphasis text action. There is exactly one
 * primary button per screen.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  inverted = false,
  hint,
  style,
  testID,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // On the dark rest surface the palette flips: the filled primary becomes a
  // light fill with dark text, and outlined/ghost actions take light text.
  const lightLabel = variant === 'primary' ? !inverted : inverted;
  const invertedSurface = inverted
    ? variant === 'primary'
      ? styles.invertedPrimary
      : variant === 'secondary'
        ? styles.invertedSecondary
        : null
    : null;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        invertedSurface,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={lightLabel ? colors.textOnInverted : colors.text}
            style={styles.spinner}
          />
        ) : null}
        <Text
          variant={size === 'lg' ? 'bodyStrong' : 'label'}
          tone={lightLabel ? 'textOnInverted' : 'text'}
          numberOfLines={1}>
          {label}
        </Text>
      </View>
      {hint ? (
        <Text variant="caption" align="center" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  lg: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  primary: {
    backgroundColor: colors.inverted,
    borderColor: colors.inverted,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    paddingHorizontal: spacing.xs,
  },
  invertedPrimary: {
    backgroundColor: colors.textOnInverted,
    borderColor: colors.textOnInverted,
  },
  invertedSecondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spinner: {
    marginRight: spacing.xxs,
  },
  hint: {
    marginTop: spacing.sm,
  },
});
