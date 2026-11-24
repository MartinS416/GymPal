import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Chevron } from '@/components/chevron';
import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';

export type BackButtonProps = {
  /** Where to go back to. Defaults to the previous screen. */
  onPress?: () => void;
  label?: string;
  testID?: string;
};

/** The back affordance used by the pushed screens. */
export function BackButton({ onPress, label = 'Back', testID = 'back' }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
      testID={testID}>
      <Chevron direction="left" size={8} color="text" />
      <Text variant="subheading">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.6,
  },
});
