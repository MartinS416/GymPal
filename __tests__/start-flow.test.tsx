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

/** Presses a whole row, found by the text it leads with. */
async function pressRow(text: string) {
  await act(async () => {
    fireEvent.press(screen.getByText(text));
  });
}

/** Walks the onboarding wizard and lands on home. */
async function openHome() {
  await renderRouter(APP_DIR, { initialUrl: '/onboarding' });
  await type('field-name', 'Alex Carter');
  await press('onboarding-continue');
  await waitFor(() => expect(screen.getByTestId('field-height')).toBeTruthy());
  await type('field-height', '180');
  await type('field-weight', '80');
  await press('onboarding-submit');
  await waitFor(() => expect(screen.getByText(/Hello, Alex Carter/)).toBeTruthy());
}

/**
 * The start flow: home, pick a workout, confirm it, train.
 */
describe('starting a workout', () => {
  it('keeps the home screen to the essentials', async () => {
    await openHome();

    expect(screen.getByText('GymPal')).toBeTruthy();
    expect(screen.getByText('Hello, Alex Carter')).toBeTruthy();
    expect(screen.getByTestId('home-lift-count')).toBeTruthy();
    expect(screen.getByText(/lifts this week/)).toBeTruthy();
    expect(screen.getByTestId('home-start-workout')).toBeTruthy();

    // Tapping the count walks through month, year and lifetime.
    await press('home-lift-count');
    expect(screen.getByText(/lifts this month/)).toBeTruthy();
    await press('home-lift-count');
    expect(screen.getByText(/lifts this year/)).toBeTruthy();
    await press('home-lift-count');
    expect(screen.getByText(/lifts lifetime/)).toBeTruthy();
    await press('home-lift-count');
    expect(screen.getByText(/lifts this week/)).toBeTruthy();

    // Measurements and the old highlight cards are no longer on home.
    expect(screen.queryByText('Height')).toBeNull();
    expect(screen.queryByText('Weight')).toBeNull();
    expect(screen.queryByText('Personal record')).toBeNull();

    // The old home furniture is gone.
    expect(screen.queryByText('Create a plan')).toBeNull();
    expect(screen.queryByText('Privacy & local data')).toBeNull();
  });

  it('offers to build a workout when there are none', async () => {
    await openHome();

    await press('home-start-workout');
    await waitFor(() => expect(screen).toHavePathname('/start'));
    expect(screen.getByText('No workouts yet')).toBeTruthy();

    await press('start-create');
    await waitFor(() => expect(screen).toHavePathname('/plans/new'));
    expect(screen.getByTestId('split-full_body')).toBeTruthy();
  });

  it('builds one, brings it back to the picker, then starts it', async () => {
    await openHome();

    await press('home-start-workout');
    await press('start-create');

    // Build a workout from the empty start screen.
    await waitFor(() => expect(screen.getByTestId('split-full_body')).toBeTruthy());
    await press('split-full_body');
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    await press('builder-next');

    // The builder returns to the picker, with the workout ready to start.
    await waitFor(() => expect(screen).toHavePathname('/start'), { timeout: 3000 });
    expect(screen.getByText('Full Body')).toBeTruthy();

    // Picking the workout opens the overview, which is the confirmation.
    await pressRow('Full Body');
    await waitFor(() => expect(screen.getByTestId('workout-start')).toBeTruthy());
    expect(screen.getByText('6 exercises · 18 sets')).toBeTruthy();

    // Confirming starts the session.
    await press('workout-start');
    await waitFor(() => expect(screen.getByTestId('set-weight')).toBeTruthy());
    expect(screen.getByText('Set 1 of 3')).toBeTruthy();
  });

  it('resumes a session that is already running', async () => {
    await openHome();

    // Build and start a workout.
    await press('home-start-workout');
    await press('start-create');
    await waitFor(() => expect(screen.getByTestId('split-full_body')).toBeTruthy());
    await press('split-full_body');
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    await press('builder-next');
    await waitFor(() => expect(screen).toHavePathname('/start'));
    await pressRow('Full Body');
    await waitFor(() => expect(screen.getByTestId('workout-start')).toBeTruthy());
    await press('workout-start');
    await waitFor(() => expect(screen.getByTestId('set-weight')).toBeTruthy());

    // Leaving the session and opening the start screen again offers to continue.
    await testRouter.back();
    await testRouter.back();
    await waitFor(() => expect(screen).toHavePathname('/start'));
    expect(screen.getByTestId('start-resume')).toBeTruthy();
    expect(screen.queryByText('Full Body')).toBeNull();
  });
});
