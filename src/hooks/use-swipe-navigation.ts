import { useCallback, useRef } from 'react';
import type { GestureResponderEvent, PanResponderGestureState } from 'react-native';

/** How far the finger has to travel to count as a swipe. */
export const SWIPE_THRESHOLD = 56;

/** Movement below this is treated as a tap, not a swipe. */
export const SWIPE_SLOP = 10;

export type SwipeDirection = 'next' | 'back' | null;

/**
 * Works out what a swipe meant.
 *
 * Swiping left moves on, swiping right goes back, and anything shorter is
 * ignored.
 */
export function resolveSwipe(dx: number): SwipeDirection {
  if (dx <= -SWIPE_THRESHOLD) {
    return 'next';
  }
  if (dx >= SWIPE_THRESHOLD) {
    return 'back';
  }
  return null;
}

export type SwipeNavigationOptions = {
  /** Swipe left: move to the next phase. */
  onNext: () => void;
  /** Swipe right: go back to the previous phase. */
  onBack: () => void;
  enabled?: boolean;
};

export type SwipeHandlers = {
  onMoveShouldSetResponder: (
    event: GestureResponderEvent,
    gesture?: PanResponderGestureState
  ) => boolean;
  onResponderGrant: (event: GestureResponderEvent) => void;
  onResponderMove: (event: GestureResponderEvent) => void;
  onResponderRelease: (event: GestureResponderEvent) => void;
  onResponderTerminate: (event: GestureResponderEvent) => void;
};

/**
 * Horizontal swipe navigation.
 *
 * The gesture is claimed only when the drag is clearly horizontal, so the
 * screen can still be scrolled vertically and the text fields can still be
 * tapped and dragged.
 */
export function useSwipeNavigation({
  onNext,
  onBack,
  enabled = true,
}: SwipeNavigationOptions): SwipeHandlers {
  const startX = useRef(0);
  const endX = useRef(0);

  const onMoveShouldSetResponder = useCallback(
    (event: GestureResponderEvent, gesture?: PanResponderGestureState) => {
      if (!enabled) {
        return false;
      }
      const touch = event.nativeEvent.touches[0];
      const dx = gesture?.dx ?? (touch ? touch.pageX - startX.current : 0);
      const dy = gesture?.dy ?? 0;
      return Math.abs(dx) > SWIPE_SLOP && Math.abs(dx) > Math.abs(dy);
    },
    [enabled]
  );

  const onResponderGrant = useCallback((event: GestureResponderEvent) => {
    const touch = event.nativeEvent.touches[0];
    startX.current = touch?.pageX ?? 0;
    endX.current = startX.current;
  }, []);

  const onResponderMove = useCallback((event: GestureResponderEvent) => {
    const touch = event.nativeEvent.touches[0];
    if (touch) {
      endX.current = touch.pageX;
    }
  }, []);

  const onResponderRelease = useCallback(() => {
    const direction = resolveSwipe(endX.current - startX.current);
    if (direction === 'next') {
      onNext();
      return;
    }
    if (direction === 'back') {
      onBack();
    }
  }, [onBack, onNext]);

  const onResponderTerminate = useCallback(() => {
    endX.current = startX.current;
  }, []);

  return {
    onMoveShouldSetResponder,
    onResponderGrant,
    onResponderMove,
    onResponderRelease,
    onResponderTerminate,
  };
}
