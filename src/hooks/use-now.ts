import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A clock that ticks.
 *
 * The value is always `Date.now()`, never an accumulated counter, so a timer
 * that is read after the app has been in the background is still correct: the
 * tick that matters is the one that happens after the app comes back.
 */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, intervalMs);

    // Coming back to the app refreshes the clock straight away.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tick();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
