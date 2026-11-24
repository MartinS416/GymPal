import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
};

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const SHEET_TRAVEL = 480;

/**
 * A sheet that rises from the bottom of the screen.
 *
 * The native pattern for a short task — log a weight, edit the order of the
 * dashboard — without leaving the screen the user is reading. The backdrop
 * fades in at the same time the sheet slides, and a tap anywhere outside
 * dismisses it.
 */
export function BottomSheet({ visible, onClose, title, children, testID }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      // Reset while hidden, so the next sheet rises from the bottom again.
      progress.setValue(0);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [visible, progress]);

  if (!visible) {
    return null;
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_TRAVEL, 0],
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID={testID ? `${testID}-backdrop` : undefined}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.keyboard}>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.base },
              { transform: [{ translateY }] },
            ]}>
            <View style={styles.grabber} />
            {title ? (
              <Text variant="heading" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  keyboard: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.base,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.xxs,
  },
});
