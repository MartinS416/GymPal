import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import { resetCryptoMock } from '../test-support/crypto-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetSqliteMock } from '../test-support/sqlite-mock';

const APP_DIR = { appDir: './src/app', overrides: {} };

beforeEach(() => {
  // Every test starts with an empty database and an empty keychain, so a
  // profile written by one test cannot leak into the next.
  resetSqliteMock();
  resetSecureStoreMock();
  resetCryptoMock();
});

/** Types into a field and flushes the resulting render. */
async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

/** Presses an element and flushes the resulting render. */
async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Walks the wizard from the name step to the measurements step. */
async function continueToMeasurements() {
  await type('field-name', 'Alex Carter');
  await press('onboarding-continue');
  await waitFor(() => expect(screen.getByTestId('field-height')).toBeTruthy());
}

/** Completes the whole wizard in the default (metric) units. */
async function completeOnboarding(name = 'Alex Carter') {
  await continueToMeasurements();
  await type('field-height', '180');
  await type('field-weight', '80');
  await press('onboarding-submit');
}

/**
 * Integration test for the Stage 1 flow: the onboarding wizard -> the tabs.
 *
 * It renders the real route tree from `src/app`, walks the two step wizard
 * and asserts that the app lands on the home tab greeting the user by name.
 */
describe('GymPal onboarding flow', () => {
  it('opens on the wizard and moves to the home tab once the profile is complete', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });

    // The index route redirects to onboarding on a fresh install.
    await waitFor(() => expect(screen).toHavePathname('/onboarding'));

    expect(screen.getByText('A SkachCorp Product')).toBeTruthy();
    expect(screen.getByText('GymPal')).toBeTruthy();
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByTestId('field-name')).toBeTruthy();
    expect(screen.queryByTestId('field-height')).toBeNull();

    await continueToMeasurements();

    // The second step swaps the name field for the measurements.
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
    expect(screen.queryByTestId('field-name')).toBeNull();
    expect(screen.getByTestId('field-height')).toBeTruthy();
    expect(screen.getByTestId('field-weight')).toBeTruthy();

    await type('field-height', '180');
    await type('field-weight', '80');
    await press('onboarding-submit');

    await waitFor(() => expect(screen).toHavePathname('/home'));

    expect(screen.getByText(/Hello, Alex Carter/)).toBeTruthy();
    expect(screen.getByText('180 cm')).toBeTruthy();
    expect(screen.getByText('80 kg')).toBeTruthy();
  });

  it('keeps the user on the wizard and explains what is missing', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });

    await press('onboarding-continue');

    await waitFor(() => expect(screen.getByText('Enter your name')).toBeTruthy());
    expect(screen).toHavePathname('/onboarding');
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
  });

  it('validates the measurements on the second step', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });

    await continueToMeasurements();
    await press('onboarding-submit');

    await waitFor(() => expect(screen.getByText('Enter your height')).toBeTruthy());
    expect(screen.getByText('Enter your weight')).toBeTruthy();
    expect(screen).toHavePathname('/onboarding');
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
  });

  it('rejects values outside of a reasonable range', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });

    await continueToMeasurements();
    await type('field-height', '900');
    await type('field-weight', '5');
    await press('onboarding-submit');

    await waitFor(() =>
      expect(screen.getByText('Height must be between 100 and 250 cm')).toBeTruthy()
    );
    expect(screen.getByText('Weight must be between 25 and 300 kg')).toBeTruthy();
    expect(screen).toHavePathname('/onboarding');
  });

  it('goes back to the name step and keeps what was typed', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });

    await continueToMeasurements();
    await press('onboarding-back');

    await waitFor(() => expect(screen.getByTestId('field-name')).toBeTruthy());
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByTestId('field-name').props.value).toBe('Alex Carter');
  });

  it('switches to imperial units and converts the entered values', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });

    await continueToMeasurements();
    await type('field-height', '180');
    await type('field-weight', '80');

    await press('units-imperial');

    await waitFor(() => expect(screen.getByTestId('field-height-feet')).toBeTruthy());
    expect(screen.getByTestId('field-height-feet').props.value).toBe('5');
    expect(screen.getByTestId('field-height-inches').props.value).toBe('11');
    expect(screen.getByTestId('field-weight').props.value).toBe('176');
  });
});

describe('GymPal tabs', () => {
  async function openTabs() {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });
    await completeOnboarding('Sam');
    await waitFor(() => expect(screen).toHavePathname('/home'));
  }

  it('shows the three sections as bottom tabs', async () => {
    await openTabs();

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText('Progress')).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('opens the history tab', async () => {
    await openTabs();

    await press('tab-history');

    await waitFor(() => expect(screen).toHavePathname('/history'));
    expect(screen.getByText('Workout history')).toBeTruthy();
    expect(screen.getByText('No workouts logged')).toBeTruthy();
  });

  it('opens the start screen from the home tab', async () => {
    await openTabs();

    await press('home-start-workout');

    await waitFor(() => expect(screen).toHavePathname('/start'));
    expect(screen.getByText('Start a workout')).toBeTruthy();
  });

  it('opens the progress tab', async () => {
    await openTabs();

    await press('tab-progress');

    await waitFor(() => expect(screen).toHavePathname('/progress'));
    await waitFor(() => expect(screen.getByTestId('metric-body_weight')).toBeTruthy());
    expect(screen.getByText('Body weight')).toBeTruthy();
    // Onboarding seeds the body weight chart with the weight the user typed.
    expect(screen.getByText('80')).toBeTruthy();
  });

  it('opens the plan builder from the home menu', async () => {
    await openTabs();

    await press('home-menu');
    await press('home-menu-new');

    await waitFor(() => expect(screen).toHavePathname('/plans/new'));
    expect(screen.getByText('Split')).toBeTruthy();
    expect(screen.getByTestId('split-full_body')).toBeTruthy();
  });

  it('opens the workouts list from the home menu', async () => {
    await openTabs();

    await press('home-menu');
    await press('home-menu-workouts');

    await waitFor(() => expect(screen).toHavePathname('/workouts'));
    expect(screen.getByText('Your workouts')).toBeTruthy();
    expect(screen.getByText('Nothing built yet')).toBeTruthy();
  });

  it('opens the privacy screen from the workouts list', async () => {
    await openTabs();

    await press('home-menu');
    await press('home-menu-workouts');
    await waitFor(() => expect(screen).toHavePathname('/workouts'));

    await press('workouts-privacy');

    await waitFor(() => expect(screen).toHavePathname('/privacy'));
    expect(screen.getByText('Your data stays here')).toBeTruthy();
  });
});

describe('local data deletion', () => {
  it('removes the stored profile and returns to onboarding', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });
    await completeOnboarding('Sam');
    await waitFor(() => expect(screen).toHavePathname('/home'));

    await press('home-menu');
    await press('home-menu-workouts');
    await waitFor(() => expect(screen).toHavePathname('/workouts'));

    await press('workouts-privacy');
    await waitFor(() => expect(screen).toHavePathname('/privacy'));

    // The first press only asks for confirmation.
    await press('privacy-delete-data');
    expect(screen.getByText('Confirm deletion')).toBeTruthy();

    await press('privacy-delete-data');

    await waitFor(() => expect(screen).toHavePathname('/onboarding'));
    expect(screen.getByTestId('field-name')).toBeTruthy();
  });
});
