import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Runs a reload whenever the screen comes back into focus.
 *
 * Tabs and stack screens stay mounted, so a screen that was left while
 * something changed — a workout was started, a set was logged — would
 * otherwise show stale data when the user comes back.
 */
export function useRefreshOnFocus(reload: () => void): void {
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
}
