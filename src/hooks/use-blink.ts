import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

/**
 * A slow blink, used to draw the eye to something that needs attention.
 *
 * The animation is only running while `active` is true, so nothing moves the
 * rest of the time.
 */
export function useBlink(active: boolean): Animated.Value {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [active, opacity]);

  return opacity;
}
