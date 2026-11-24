import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryIcon, HomeIcon, ProgressIcon, SettingsIcon } from '@/components/tab-icons';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';

const ICONS: Record<string, (props: { color: string; size?: number }) => ReactNode> = {
  home: HomeIcon,
  history: HistoryIcon,
  progress: ProgressIcon,
  settings: SettingsIcon,
};

/**
 * The bottom tab bar.
 *
 * GymPal draws its own so the bar matches the rest of the interface: a white
 * surface, a hairline rule, monochrome glyphs and small labels. The selected
 * tab is the only black element in the row.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) {
    return null;
  }

  return (
    <View
      style={[
        styles.bar,
        { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const focused = state.index === index;
        const title = typeof options?.title === 'string' ? options.title : route.name;
        const Icon = ICONS[route.name];
        const tint = focused ? colors.text : colors.textTertiary;

        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        return (
          <Pressable
            key={route.key}
            testID={options?.tabBarButtonTestID ?? `tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options?.tabBarAccessibilityLabel ?? title}
            onPress={onPress}
            style={({ pressed }) => [styles.item, pressed ? styles.itemPressed : null]}>
            {Icon ? <Icon color={tint} /> : null}
            <Text variant="label" tone={focused ? 'text' : 'textTertiary'} style={styles.label}>
              {title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TAB_BAR_HEIGHT = 58;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + spacing.xxs,
    paddingTop: spacing.sm,
  },
  itemPressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
