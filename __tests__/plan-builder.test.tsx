import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';

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

async function openBuilder() {
  await renderRouter(APP_DIR, { initialUrl: '/onboarding' });
  await type('field-name', 'Alex Carter');
  await press('onboarding-continue');
  await waitFor(() => expect(screen.getByTestId('field-height')).toBeTruthy());
  await type('field-height', '180');
  await type('field-weight', '80');
  await press('onboarding-submit');
  await waitFor(() => expect(screen.getByText(/Hello, Alex Carter/)).toBeTruthy());

  await press('home-menu');
  await press('home-menu-new');
  await waitFor(() => expect(screen.getByTestId('split-full_body')).toBeTruthy());
}

describe('the plan builder', () => {
  it('walks the flow: split, name, then one workout at a time', async () => {
    await openBuilder();

    // 1. The split.
    await press('split-push_pull_legs');
    await waitFor(() => expect(screen.getByTestId('builder-name')).toBeTruthy());

    // 2. The name.
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    expect(screen.getByTestId('builder-workout-name').props.value).toBe('Push');

    // 3. The workouts of the split, one after another.
    await press('builder-generate');
    expect(screen.getByText('Bench Press')).toBeTruthy();

    await press('builder-next');
    await waitFor(() => expect(screen.getByTestId('builder-workout-name').props.value).toBe('Pull'));

    await press('builder-next');
    await waitFor(() => expect(screen.getByTestId('builder-workout-name').props.value).toBe('Legs'));
  });

  it('adds an exercise from the library', async () => {
    await openBuilder();
    await press('split-full_body');
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-add-exercise')).toBeTruthy());

    await press('builder-add-exercise');
    await waitFor(() => expect(screen.getByTestId('exercise-search')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Deadlift'));
    });

    await waitFor(() => expect(screen.getByText('Deadlift')).toBeTruthy());
  });

  it('removes an exercise again', async () => {
    await openBuilder();
    await press('split-full_body');
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    expect(screen.getByText('Bench Press')).toBeTruthy();

    // Open the exercise and remove it.
    await act(async () => {
      fireEvent.press(screen.getByText('Bench Press'));
    });
    await waitFor(() => expect(screen.getByTestId('row-remove')).toBeTruthy());
    await press('row-remove');

    await waitFor(() => expect(screen.queryByText('Bench Press')).toBeNull());
  });

  it('replaces an exercise with another one from the library', async () => {
    await openBuilder();
    await press('split-full_body');
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');
    expect(screen.getByText('Bench Press')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Bench Press'));
    });
    await waitFor(() => expect(screen.getByTestId('row-replace')).toBeTruthy());
    await press('row-replace');

    await waitFor(() => expect(screen.getByTestId('exercise-search')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Deadlift'));
    });

    await waitFor(() => expect(screen.getByText('Deadlift')).toBeTruthy());
    expect(screen.queryByText('Bench Press')).toBeNull();
  });

  it('saves the plan when the last workout is done', async () => {
    await openBuilder();
    await press('split-full_body');
    await press('builder-continue');
    await waitFor(() => expect(screen.getByTestId('builder-generate')).toBeTruthy());
    await press('builder-generate');

    // The last workout of a one workout split saves the plan, and the
    // workouts list is where the flow returns to.
    await press('builder-next');

    await waitFor(() => expect(screen).toHavePathname('/workouts'));
    expect(screen.getByText('Full Body')).toBeTruthy();
  });
});
