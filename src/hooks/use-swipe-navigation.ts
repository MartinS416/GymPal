import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';
import type { GestureResponderEvent, PanResponderGestureState } from 'react-native';

/** How far the finger has to travel to count as a swipe. */
export const SWIPE_THRESHOLD = 56;

/** Movement below this is treated as a tap, not a swipe. */
export const SWIPE_SLOP = 10;

/** How long the phase being left takes to slide off the screen. */
export const SWIPE_EXIT_MS = 200;

/** How long a swipe that could not be applied takes to slide back. */
export const SWIPE_RETURN_MS = 240;

/**
 * How long a committed swipe waits for the new phase to be drawn before the
 * strip is put back on its own. Only reached when the refresh never arrives.
 */
export const SWIPE_COMMIT_TIMEOUT_MS = 2000;

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
  /**
   * Swipe left. Resolving `false` means the phase did not change, so the screen
   * slides back into place instead of staying on the previewed phase.
   */
  onNext: () => void | boolean | Promise<void | boolean>;
  /** Swipe right, with the same contract as `onNext`. */
  onBack: () => void | boolean | Promise<void | boolean>;
  enabled?: boolean;
  /** Allow swiping left to the next phase. */
  canNext?: boolean;
  /** Allow swiping right to the previous phase. */
  canBack?: boolean;
  /**
   * Follows the finger and slides the screen after the swipe. The view has to
   * apply `translateX` for the movement to show.
   */
  animated?: boolean;
  /**
   * Reports which neighbouring phase is being dragged in, so the screen can
   * draw it beside the current one. `null` means the drag is over.
   */
  onPeek?: (direction: SwipeDirection) => void;
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

export type SwipeNavigation = {
  /** Spread these onto the view that owns the gesture. */
  gestureHandlers: SwipeHandlers;
  /** The horizontal offset of the screen while it slides between phases. */
  translateX: Animated.Value;
  /**
   * Tells the hook that a committed swipe has landed, so the next one can
   * begin. Call it once the new phase is on screen.
   */
  finishSwipe: () => void;
};

function slide(value: Animated.Value, toValue: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    Animated.timing(value, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => resolve());
  });
}

/**
 * Horizontal swipe navigation.
 *
 * The gesture is claimed only when the drag is clearly horizontal, so the
 * screen can still be scrolled vertically and the text fields can still be
 * tapped and dragged. When `animated` is on, the screen follows the finger, and
 * a released swipe slides a full page across. The neighbouring page is reported
 * through `onPeek` so it can be drawn while the finger moves.
 */
export function useSwipeNavigation({
  onNext,
  onBack,
  enabled = true,
  canNext = true,
  canBack = true,
  animated = false,
  onPeek,
}: SwipeNavigationOptions): SwipeNavigation {
  const { width } = useWindowDimensions();
  const [translateX] = useState(() => new Animated.Value(0));
  const startX = useRef(0);
  const endX = useRef(0);
  /** True while a released swipe is animating, so it cannot be interrupted. */
  const sliding = useRef(false);
  /** True between the gesture starting and the finger lifting. */
  const touching = useRef(false);
  /** The direction last reported through `onPeek`. */
  const peeked = useRef<SwipeDirection>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPeekRef = useRef(onPeek);

  useEffect(() => {
    onPeekRef.current = onPeek;
  }, [onPeek]);

  const reportPeek = useCallback((direction: SwipeDirection) => {
    if (peeked.current === direction) {
      return;
    }
    peeked.current = direction;
    onPeekRef.current?.(direction);
  }, []);

  const clearCommitTimer = useCallback(() => {
    if (commitTimer.current !== null) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
  }, []);

  const finishSwipe = useCallback(() => {
    clearCommitTimer();
    sliding.current = false;
  }, [clearCommitTimer]);

  useEffect(() => clearCommitTimer, [clearCommitTimer]);

  const settleBack = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 9,
      tension: 90,
      useNativeDriver: true,
    }).start(() => {
      // A new drag may already have started, in which case the peek still has
      // to stay on screen.
      if (!touching.current) {
        reportPeek(null);
      }
    });
  }, [reportPeek, translateX]);

  const onMoveShouldSetResponder = useCallback(
    (event: GestureResponderEvent, gesture?: PanResponderGestureState) => {
      if (!enabled || sliding.current) {
        return false;
      }
      const touch = event.nativeEvent.touches[0];
      const dx = gesture?.dx ?? (touch ? touch.pageX - startX.current : 0);
      const dy = gesture?.dy ?? 0;
      if (Math.abs(dx) <= SWIPE_SLOP || Math.abs(dx) <= Math.abs(dy)) {
        return false;
      }
      return dx < 0 ? canNext : canBack;
    },
    [canBack, canNext, enabled]
  );

  const onResponderGrant = useCallback(
    (event: GestureResponderEvent) => {
      const touch = event.nativeEvent.touches[0];
      startX.current = touch?.pageX ?? 0;
      endX.current = startX.current;
      touching.current = true;
      if (animated) {
        translateX.stopAnimation();
        translateX.setValue(0);
      }
    },
    [animated, translateX]
  );

  const onResponderMove = useCallback(
    (event: GestureResponderEvent) => {
      const touch = event.nativeEvent.touches[0];
      if (!touch) {
        return;
      }
      endX.current = touch.pageX;
      if (!animated) {
        return;
      }
      // The page follows the finger, but never further than a full page, so the
      // neighbouring page stops exactly at the edge of the screen. A direction
      // that has nowhere to go stays put.
      const limit = width > 0 ? width : 400;
      const dx = endX.current - startX.current;
      const clamped = Math.max(canNext ? -limit : 0, Math.min(canBack ? limit : 0, dx));
      translateX.setValue(clamped);
      reportPeek(clamped <= -SWIPE_SLOP ? 'next' : clamped >= SWIPE_SLOP ? 'back' : null);
    },
    [animated, canBack, canNext, reportPeek, translateX, width]
  );

  const onResponderRelease = useCallback(() => {
    touching.current = false;
    const direction = resolveSwipe(endX.current - startX.current);

    if (!animated) {
      if (direction === 'next' && canNext) {
        void onNext();
      } else if (direction === 'back' && canBack) {
        void onBack();
      }
      return;
    }

    if (
      !direction ||
      (direction === 'next' && !canNext) ||
      (direction === 'back' && !canBack)
    ) {
      settleBack();
      return;
    }

    reportPeek(direction);
    const limit = width > 0 ? width : 400;
    const exit = direction === 'next' ? -limit : limit;
    sliding.current = true;

    void (async () => {
      // The neighbouring page is already on screen here, so this slides real
      // content into place rather than an empty gap.
      await slide(translateX, exit, SWIPE_EXIT_MS);
      let moved: void | boolean = true;
      try {
        moved = direction === 'next' ? await onNext() : await onBack();
      } catch {
        moved = false;
      }
      if (moved === false) {
        await slide(translateX, 0, SWIPE_RETURN_MS);
        reportPeek(null);
        sliding.current = false;
        return;
      }
      // The strip stays on the arriving page until the screen says the phase
      // has been drawn, so a swipe cannot be restarted against the old phase.
      // The timeout only covers a refresh that never lands.
      clearCommitTimer();
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null;
        translateX.setValue(0);
        reportPeek(null);
        sliding.current = false;
      }, SWIPE_COMMIT_TIMEOUT_MS);
    })();
  }, [animated, canBack, canNext, clearCommitTimer, onBack, onNext, reportPeek, settleBack, translateX, width]);

  const onResponderTerminate = useCallback(() => {
    touching.current = false;
    endX.current = startX.current;
    if (animated) {
      settleBack();
    }
  }, [animated, settleBack]);

  return {
    gestureHandlers: {
      onMoveShouldSetResponder,
      onResponderGrant,
      onResponderMove,
      onResponderRelease,
      onResponderTerminate,
    },
    translateX,
    finishSwipe,
  };
}
