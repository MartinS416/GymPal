import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type MenuOption = {
  label: string;
  onPress: () => void;
  testID: string;
};

export type OptionsMenuProps = {
  options: MenuOption[];
  open: boolean;
  onToggle: () => void;
  testID?: string;
  inverted?: boolean;
};

/**
 * The "..." menu.
 *
 * Tapping the dots slides the options in from the right — they travel left
 * into place — and turns the dots upright while they are showing. The panel
 * is only as wide as its longest option, so it reads as an aside rather than
 * a screen of its own.
 */
export function OptionsMenu({ options, open, onToggle, testID, inverted }: OptionsMenuProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // The panel animates its own layout, which the native driver cannot do.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [open, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close options' : 'More options'}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        hitSlop={10}
        style={({ pressed }) => [styles.trigger, pressed ? styles.pressed : null]}
        testID={testID ?? 'home-menu'}>
        <Animated.View style={[styles.dots, { transform: [{ rotate }] }]}>
          <View style={[styles.dot, inverted ? styles.dotInverted : null]} />
          <View style={[styles.dot, inverted ? styles.dotInverted : null]} />
          <View style={[styles.dot, inverted ? styles.dotInverted : null]} />
        </Animated.View>
      </Pressable>

      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={[styles.panel, { opacity: progress, transform: [{ translateX }] }]}>
        {options.map((option, index) => (
          <Pressable
            key={option.testID}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={option.onPress}
            style={({ pressed }) => [
              styles.option,
              index > 0 ? styles.optionDivided : null,
              pressed ? styles.optionPressed : null,
            ]}
            testID={option.testID}>
            <Text variant="body">{option.label}</Text>
            <Chevron direction="right" />
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // The panel hangs under the trigger, above the rest of the screen.
    position: 'relative',
    zIndex: 20,
  },
  trigger: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
  pressed: {
    opacity: 0.5,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  dotInverted: {
    backgroundColor: colors.textOnInverted,
  },
  panel: {
    position: 'absolute',
    top: 36,
    right: 0,
    minWidth: 208,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      // A very soft drop shadow lifts the panel off the greeting without
      // introducing a colour.
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  optionDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  optionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
