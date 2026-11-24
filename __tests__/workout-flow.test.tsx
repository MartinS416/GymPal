import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import { resetCryptoMock } from '../test-support/crypto-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetSqliteMock } from '../test-support/sqlite-mock';

const APP_DIR = { appDir: './src/app', overrides: {} };

beforeEach(() => {
  resetSqliteMock();
  resetSecureStoreMock();
  resetCryptoMock();
});

async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** A synthetic touch at a horizontal position. */
function touch(pageX: number) {
  return {
    nativeEvent: {
      touches: [
        { identifier: 1, pageX, pageY: 300, locationX: pageX, locationY: 300, target: 1 },
      ],
      changedTouches: [
        { identifier: 1, pageX, pageY: 300, locationX: pageX, locationY: 300, target: 1 },
      ],
      timestamp: 1,
    },
  };
}

/** Swipes the workout screen to the left, to the next phase. */
async function swipeLeft() {
  const view = screen.getByTestId('session-screen');
  await act(async () => {
    view.props.onMoveShouldSetPanResponder?.({}, { dx: -80, dy: 0 });
    view.props.onResponderGrant?.(touch(280));
    view.props.onResponderMove?.(touch(180));
    view.props.onResponderRelease?.(touch(120));
  });
}

/** Swipes the workout screen to the right, to the previous phase. */
async function swipeRight() {
  const view = screen.getByTestId('session-screen');
  await act(async () => {
    view.props.onMoveShouldSetPanResponder?.({}, { dx: 80, dy: 0 });
    view.props.onResponderGrant?.(touch(120));
    view.props.onResponderMove?.(touch(220));
    view.props.onResponderRelease?.(touch(280));
  });
}

/** Walks the onboarding wizard. */
async function completeOnboarding(name = 'Alex Carter') {
  await type('field-name', name);
  await press('onboarding-continue');
  await waitFor(() => expect(screen.getByTestId('field-height')).toBeTruthy());
  await type('field-height', '180');
  await type('field-weight', '80');
  await press('onboarding-submit');
  await waitFor(() => expect(screen.getByText(/Hello, Alex Carter/)).toBeTruthy());
}

/**
 * The whole Stage 3 flow: build a plan, start the workout, log sets, finish
 * it, and find it in the history.
 */
describe('workout flow', () => {
  it('goes from a new plan to a finished workout in the history', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });
    await completeOnboarding();

    // 1. Build a plan: split, name, then each workout of the split.
    await press('home-menu');
    await press('home-menu-new');
    await waitFor(() => expect(screen.getByTestId('split-full_body')).toBeTruthy());

    await press('split-push_pull_legs');
    await waitFor(() => expect(screen.getByTestId('builder-name')).toBeTruthy());
    await press('builder-continue');

    // Push.
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    expect(screen.getByText('Bench Press')).toBeTruthy();
    await press('builder-next');

    // Pull.
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    expect(screen.getByText('Deadlift')).toBeTruthy();
    await press('builder-next');

    // Legs.
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    expect(screen.getByText('Back Squat')).toBeTruthy();
    await press('builder-next');

    // The plan is saved and its workouts are listed.
    await waitFor(() => expect(screen).toHavePathname('/workouts'), { timeout: 3000 });
    expect(screen.getByText('Push')).toBeTruthy();

    // 2. Pick the first workout. The overview is the confirmation.
    await act(async () => {
      fireEvent.press(screen.getByText('Push'));
    });
    await waitFor(() => expect(screen.getByTestId('workout-start')).toBeTruthy());
    expect(screen.getByText('Bench Press')).toBeTruthy();

    // 3. Start the workout.
    await press('workout-start');
    await waitFor(() => expect(screen.getByTestId('set-weight')).toBeTruthy());
    expect(screen.getByText('Set 1 of 4')).toBeTruthy();
    // The reps are prefilled with the target, so nothing has to be typed.
    expect(screen.getByTestId('set-reps').props.value).toBe('6');

    // 3b. The phase mirror is disabled for now (no Live Activity native module
    // in the running build), so there is nothing to assert on it.

    // 4. Swipe on: the set is saved and the rest starts.
    await type('set-weight', '60');
    await type('set-reps', '8');
    await swipeLeft();

    await waitFor(() => expect(screen.getByText('REST')).toBeTruthy());
    // The screen inverts while resting, and the fields stay live so the set
    // that was just logged can still be corrected.
    expect(screen.getByText('Resting')).toBeTruthy();
    expect(screen.getByTestId('set-weight')).toBeTruthy();
    expect(screen.getByTestId('set-reps').props.value).toBe('8');

    // The Live Activity gives way to the rest countdown, and the countdown is a
    // native timer inside the card, so it rides along without new props. The
    // feature is disabled for now, so the activity is not mirrored.

    // Correct the weight while resting, then move on.
    await type('set-weight', '62.5');
    await swipeLeft();

    // Moving on replaces the countdown with the next set's work clock.
    await waitFor(() => expect(screen.getByText('Set 2 of 4')).toBeTruthy());
    expect(screen.getByText('EXERCISE TIME')).toBeTruthy();

    // 6. Swipe back: the previous phase is the rest again.
    await swipeRight();
    await waitFor(() => expect(screen.getByText('REST')).toBeTruthy());

    await swipeLeft();
    await waitFor(() => expect(screen.getByText('Set 2 of 4')).toBeTruthy());

    // 7. Finish the workout, with a confirmation step.
    await press('finish-workout');
    expect(screen.getByText('Finish workout?')).toBeTruthy();
    await press('confirm-finish');

    // 8. The summary.
    await waitFor(() => expect(screen.getByTestId('stat-sets')).toBeTruthy());
    expect(screen.getByText('Bench Press')).toBeTruthy();
    // The corrected weight and reps are saved and shown in the inline fields.
    expect(screen.getByTestId(/session-set-\d+-weight/).props.value).toBe('62.5');
    expect(screen.getByTestId(/session-set-\d+-reps/).props.value).toBe('8');

    // 9. The session is in the history.
    await testRouter.navigate('/history');
    await waitFor(() => expect(screen.getByText('Push')).toBeTruthy());
  });

  it('keeps an unfinished session so it can be resumed', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });
    await completeOnboarding();

    // Build and save a plan.
    await press('home-menu');
    await press('home-menu-new');
    await waitFor(() => expect(screen.getByTestId('split-full_body')).toBeTruthy());
    await press('split-full_body');
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    await press('builder-next');
    await waitFor(() => expect(screen).toHavePathname('/workouts'));

    // Start the workout and log one set, then leave.
    await act(async () => {
      fireEvent.press(screen.getByText('Full Body'));
    });
    await waitFor(() => expect(screen.getByTestId('workout-start')).toBeTruthy());
    await press('workout-start');
    await waitFor(() => expect(screen.getByTestId('set-weight')).toBeTruthy());

    await type('set-weight', '60');
    await type('set-reps', '8');
    await swipeLeft();
    await waitFor(() => expect(screen.getByText('REST')).toBeTruthy());

    // Backing out of the workout leaves the session in progress, and the
    // workout offers to pick it up again.
    await testRouter.back();
    await waitFor(() => expect(screen.getByTestId('workout-resume')).toBeTruthy());
  });
});
