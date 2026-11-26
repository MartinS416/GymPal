import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import androidMedium from 'expo-symbols/androidWeights/medium';
import androidRegular from 'expo-symbols/androidWeights/regular';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';

/** The native SF Symbol and its Material Symbols counterparts. */
type SymbolNames = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

type TabIcon = {
  idle: SymbolNames;
  selected: SymbolNames;
};

/**
 * iOS tab bars use the filled variant of a symbol for the selected tab. On
 * Android and the web the Material Symbols font has one outline glyph, so the
 * selected icon is drawn a little heavier instead.
 */
const ICONS: Record<string, TabIcon> = {
  home: {
    idle: { ios: 'house', android: 'home', web: 'home' },
    selected: { ios: 'house.fill', android: 'home', web: 'home' },
  },
  history: {
    idle: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
    selected: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  },
  progress: {
    idle: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
    selected: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  },
  settings: {
    idle: { ios: 'gearshape', android: 'settings', web: 'settings' },
    selected: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  },
};

/**
 * The bottom tab bar.
 *
 * GymPal draws its own so the bar matches the rest of the interface: a white
 * surface, a hairline rule, native tab glyphs and small labels. The selected
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
        const icon = ICONS[route.name];
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
            {icon ? (
              <SymbolView
                name={focused ? icon.selected : icon.idle}
                size={25}
                tintColor={tint}
                weight={focused
                  ? { ios: 'regular', android: androidMedium }
                  : { ios: 'regular', android: androidRegular }}
                testID={`tab-icon-${route.name}`}
              />
            ) : null}
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
