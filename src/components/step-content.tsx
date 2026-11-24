import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, StyleSheet } from 'react-native';

export type StepContentProps = {
  children: ReactNode;
  /** Which way the flow is moving, so the step comes in from the right side. */
  direction?: 'forward' | 'back';
};

/**
 * A step of a flow.
 *
 * Each step animates in when it appears, so moving through the flow feels
 * like one continuous movement rather than a set of separate screens.
 */
export function StepContent({ children, direction = 'forward' }: StepContentProps) {
  const offset = direction === 'forward' ? 24 : -24;
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateX] = useState(() => new Animated.Value(offset));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateX]);

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
