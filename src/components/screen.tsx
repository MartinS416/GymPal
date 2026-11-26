import { useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/constants/theme';

export type ScreenProps = {
  children: ReactNode;
  /**
   * Pinned footer, rendered outside the scroll area (and above the keyboard).
   * Use it for the single primary action of a screen.
   */
  footer?: ReactNode;
  /** Set to `false` for screens that should never scroll. */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Bottom safe-area padding for the scroll content.
   * Defaults to the device inset. Pass `0` when a tab bar already owns the
   * home indicator area.
   */
  bottomInset?: number;
  /**
   * Whether the view allows bounce when pulled past its edge.
   * Defaults to false to prevent rubber-band up-and-down movement.
   */
  bounces?: boolean;
  /** Called as the scroll view moves; use it to trigger infinite loading. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Test handle for the scroll view. */
  testID?: string;
};

/**
 * Screen chrome shared by every route.
 *
 * Handles safe areas, dynamic scrolling (automatically disabled when content
 * fits comfortably on the screen to prevent unwanted up-and-down movement),
 * keyboard avoidance, and a maximum content width for larger devices.
 */
export function Screen({
  children,
  footer,
  scroll = true,
  contentContainerStyle,
  bottomInset,
  bounces = false,
  onScroll,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [containerHeight, setContainerHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const topPadding = insets.top + spacing.lg;
  const bottomPadding = footer ? 0 : (bottomInset ?? insets.bottom) + spacing.xxl;
  const totalContentHeight = contentHeight + topPadding + bottomPadding;

  // Content only scrolls if it genuinely exceeds the available viewport.
  // When content fits, scrolling is disabled to eliminate up-and-down movement.
  const canScroll = scroll && containerHeight > 0 && totalContentHeight > containerHeight + 2;

  const content = (
    <View
      style={[styles.inner, isWide ? styles.innerWide : null]}
      onLayout={(e) => {
        setContentHeight(e.nativeEvent.layout.height);
      }}>
      {children}
    </View>
  );

  const scrollStyle = [
    styles.content,
    { paddingTop: topPadding },
    footer ? null : { paddingBottom: bottomPadding },
    contentContainerStyle,
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={scrollStyle}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            bounces={bounces}
            alwaysBounceVertical={false}
            overScrollMode="never"
            scrollEnabled={canScroll}
            onScroll={onScroll}
            scrollEventThrottle={100}
            testID={testID}
            onLayout={(e) => {
              setContainerHeight(e.nativeEvent.layout.height);
            }}>
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.flex, scrollStyle]}>{content}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.base }]}>
            <View style={styles.inner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.gutter,
    flexGrow: 1,
  },
  inner: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  innerWide: {
    maxWidth: layout.maxWidthWide,
  },
  footer: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
