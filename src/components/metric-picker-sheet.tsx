import { useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { moveKey, type MetricData } from '@/workouts/progress';

export type MetricPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  metrics: MetricData[];
  pinned: string[];
  /** Called with the next pinned list, in order. */
  onChange: (keys: string[]) => void;
};

const ROW_HEIGHT = 56;

/**
 * Pin, unpin and reorder the dashboard.
 *
 * The pinned list is edited in place: drag a handle to move a metric, press the
 * minus to unpin it, press the plus to add another. Every change is saved
 * immediately, so the dashboard behind the sheet is already right when it
 * closes.
 */
export function MetricPickerSheet({
  visible,
  onClose,
  metrics,
  pinned,
  onChange,
}: MetricPickerSheetProps) {
  const haptics = useHaptics();
  const [drag, setDrag] = useState<{ key: string; index: number; dy: number } | null>(null);

  const nameOf = (key: string) =>
    metrics.find((data) => data.metric.key === key)?.metric.name ?? key;

  const unpin = (key: string) => {
    haptics.tap();
    onChange(pinned.filter((entry) => entry !== key));
  };

  const pin = (key: string) => {
    haptics.press();
    onChange([...pinned, key]);
  };

  const reorder = (index: number, target: number) => {
    if (index === target) {
      return;
    }
    haptics.tick();
    onChange(moveKey(pinned, index, target));
  };

  const makeResponder = (key: string, index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        haptics.press();
        setDrag({ key, index, dy: 0 });
      },
      onPanResponderMove: (_event, gesture) => {
        if (drag?.key !== key) {
          return;
        }
        setDrag({ key, index, dy: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        setDrag(null);
        reorder(index, Math.round(index + gesture.dy / ROW_HEIGHT));
      },
      onPanResponderTerminate: () => setDrag(null),
    });

  const others = metrics
    .map((data) => data.metric.key)
    .filter((key) => !pinned.includes(key));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Edit metrics" testID="metric-picker">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="caption" tone="textTertiary" style={styles.sectionLabel}>
          Pinned
        </Text>

        {pinned.length === 0 ? (
          <Text variant="caption" tone="textTertiary" style={styles.emptyPinned}>
            Nothing pinned. Choose a metric below.
          </Text>
        ) : null}

        {pinned.map((key, index) => {
          const dragOffset = drag?.key === key ? drag.dy : null;
          return (
            <View
              key={key}
              style={[
                styles.row,
                dragOffset !== null
                  ? [styles.dragging, { transform: [{ translateY: dragOffset }] }]
                  : null,
              ]}>
              <View
                accessibilityRole="adjustable"
                accessibilityLabel={`Reorder ${nameOf(key)}`}
                accessibilityHint="Swipe up or down to move it"
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'increment') {
                    reorder(index, index + 1);
                  } else if (event.nativeEvent.actionName === 'decrement') {
                    reorder(index, index - 1);
                  }
                }}
                style={styles.handle}
                testID={`pin-handle-${key}`}
                {...makeResponder(key, index).panHandlers}>
                <View style={styles.handleLine} />
                <View style={styles.handleLine} />
                <View style={styles.handleLine} />
              </View>

              <Text variant="body" style={styles.name} numberOfLines={1}>
                {nameOf(key)}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unpin ${nameOf(key)}`}
                onPress={() => unpin(key)}
                hitSlop={8}
                style={({ pressed }) => [styles.circle, pressed ? styles.pressed : null]}
                testID={`unpin-${key}`}>
                <View style={styles.minus} />
              </Pressable>
            </View>
          );
        })}

        <Text variant="caption" tone="textTertiary" style={styles.sectionLabel}>
          All metrics
        </Text>

        {others.map((key) => (
          <View key={key} style={styles.row}>
            <View style={styles.handleSpacer} />
            <Text variant="body" style={styles.name} numberOfLines={1}>
              {nameOf(key)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Pin ${nameOf(key)}`}
              onPress={() => pin(key)}
              hitSlop={8}
              style={({ pressed }) => [styles.circle, pressed ? styles.pressed : null]}
              testID={`pin-${key}`}>
              <View style={styles.plusHorizontal} />
              <View style={styles.plusVertical} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Button label="Done" variant="secondary" onPress={onClose} testID="metric-picker-done" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 420,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  emptyPinned: {
    paddingVertical: spacing.sm,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dragging: {
    zIndex: 2,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  handle: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  handleLine: {
    width: 14,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  handleSpacer: {
    width: 32,
  },
  name: {
    flex: 1,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  minus: {
    width: 12,
    height: 1,
    backgroundColor: colors.text,
  },
  plusHorizontal: {
    position: 'absolute',
    width: 12,
    height: 1,
    backgroundColor: colors.text,
  },
  plusVertical: {
    position: 'absolute',
    width: 1,
    height: 12,
    backgroundColor: colors.text,
  },
});
