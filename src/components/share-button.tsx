import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, spacing } from '@/constants/theme';

export type ShareButtonProps = {
  testID?: string;
};

/**
 * The share affordance.
 *
 * Sharing is intentionally not wired up yet. The button is here so the feed
 * has the same anatomy as the rest of the workout cards, but pressing it does
 * nothing and never interrupts the workout.
 */
export function ShareButton({ testID = 'share-workout' }: ShareButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Share workout"
      accessibilityHint="Sharing is not available yet."
      hitSlop={8}
      onPress={() => {}}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}>
      <Svg width={19} height={19} viewBox="0 0 24 24">
        <Path
          d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9"
          stroke={colors.text}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  pressed: {
    opacity: 0.5,
  },
});
