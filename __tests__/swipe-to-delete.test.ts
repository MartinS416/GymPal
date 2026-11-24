import { describe, expect, it } from '@jest/globals';

import {
  clampSwipe,
  shouldDelete,
  shouldStartSwipe,
  SWIPE_ACTION_WIDTH,
  SWIPE_TRIGGER,
} from '@/components/swipe-gesture';

describe('the swipe gesture', () => {
  it('only claims a deliberate horizontal drag', () => {
    expect(shouldStartSwipe(-40, 2)).toBe(true);
    expect(shouldStartSwipe(40, 2)).toBe(true);
    // A small movement is a tap.
    expect(shouldStartSwipe(-4, 0)).toBe(false);
    // A vertical drag belongs to the scroll view.
    expect(shouldStartSwipe(-10, -60)).toBe(false);
  });

  it('never claims a drag on a disabled row', () => {
    expect(shouldStartSwipe(-40, 0, true)).toBe(false);
  });

  it('keeps the row inside its bounds', () => {
    expect(clampSwipe(-20)).toBe(-20);
    expect(clampSwipe(20)).toBe(0);
    expect(clampSwipe(-1000)).toBe(-SWIPE_ACTION_WIDTH);
    expect(clampSwipe(1000)).toBe(0);
  });

  it('removes the row only past the threshold', () => {
    expect(shouldDelete(-SWIPE_TRIGGER)).toBe(true);
    expect(shouldDelete(-SWIPE_TRIGGER - 1)).toBe(true);
    expect(shouldDelete(-SWIPE_TRIGGER + 1)).toBe(false);
    expect(shouldDelete(0)).toBe(false);
  });
});
