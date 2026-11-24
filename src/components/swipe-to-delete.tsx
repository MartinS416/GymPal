import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import {
  clampSwipe,
  shouldDelete,
  shouldStartSwipe,
  SWIPE_ACTION_WIDTH,
} from '@/components/swipe-gesture';
import { colors, radius } from '@/constants/theme';

export type SwipeToDeleteProps = {
  children: ReactNode;
  /** Called once the row has been swiped away. */
  onDelete: () => void;
  /** Disables the gesture, for rows that cannot be removed. */
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * A row that can be swiped away.
 *
 * Dragging to the left reveals a remove action; releasing past the threshold
 * deletes the row. The gesture is written by hand so it behaves the same on
 * every platform, including the browser preview.
 */
export function SwipeToDelete({
  children,
  onDelete,
  disabled = false,
  accessibilityLabel,
  testID,
}: SwipeToDeleteProps) {
  const [translateX] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          shouldStartSwipe(gesture.dx, gesture.dy, disabled),
        onPanResponderMove: (_event, gesture) => {
          translateX.setValue(clampSwipe(gesture.dx));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (shouldDelete(gesture.dx)) {
            Animated.timing(translateX, {
              toValue: -SWIPE_ACTION_WIDTH,
              duration: 160,
              useNativeDriver: false,
            }).start(() => onDelete());
            return;
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            speed: 18,
            bounciness: 4,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            speed: 18,
            bounciness: 4,
          }).start();
        },
      }),
    [disabled, onDelete, translateX]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.action, { width: SWIPE_ACTION_WIDTH }]}>
        <Text variant="label" tone="danger">
          Remove
        </Text>
      </View>
      <Animated.View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSurface,
  },
  row: {
    backgroundColor: colors.surface,
  },
});
