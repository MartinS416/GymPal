/**
 * The rules of the swipe gesture.
 *
 * Kept apart from the view so the behaviour can be reasoned about and tested
 * without a touch screen.
 */

/** How far the row travels when it is fully swiped. */
export const SWIPE_ACTION_WIDTH = 96;

/** How far the row has to travel before it is removed. */
export const SWIPE_TRIGGER = 56;

/** Movement below this is treated as a tap, not a swipe. */
export const SWIPE_SLOP = 8;

/**
 * Whether a drag should be claimed by the row.
 *
 * Only a deliberate horizontal drag counts, so the list underneath keeps
 * scrolling normally.
 */
export function shouldStartSwipe(dx: number, dy: number, disabled = false): boolean {
  if (disabled) {
    return false;
  }
  return Math.abs(dx) > SWIPE_SLOP && Math.abs(dx) > Math.abs(dy);
}

/** How far the row may travel, never past the action on the right. */
export function clampSwipe(dx: number): number {
  return Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, dx));
}

/** Whether releasing the row at this distance removes it. */
export function shouldDelete(dx: number): boolean {
  return dx <= -SWIPE_TRIGGER;
}
