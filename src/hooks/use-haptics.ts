import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Haptics, wrapped.
 *
 * Feedback is a garnish: it makes a gesture feel physical on a phone, and does
 * nothing at all on a device without a taptic engine. Every call is therefore
 * fire-and-forget, and a failure is never surfaced.
 */
export type HapticFeedback = {
  /** Moving between values, e.g. scrubbing a chart. */
  tick: () => void;
  /** A light tap, e.g. opening a card. */
  tap: () => void;
  /** A firmer tap, e.g. pinning a metric. */
  press: () => void;
  /** Something was saved. */
  success: () => void;
  /** Something was removed. */
  warning: () => void;
};

function run(action: () => Promise<void>): void {
  void Promise.resolve()
    .then(action)
    .catch(() => {
      // Haptics are optional; never let them break an interaction.
    });
}

export function useHaptics(): HapticFeedback {
  return useMemo(
    () => ({
      tick: () => run(() => Haptics.selectionAsync()),
      tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    }),
    []
  );
}
