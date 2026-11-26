import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';

import { GymPalDatabase, migrateDatabase } from '@/db';
import { openEncryptedDatabase } from '@/db/client';
import { addSessionExercise } from '@/db/repositories/sessions';
import { resetCryptoMock } from '../test-support/crypto-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetSqliteMock } from '../test-support/sqlite-mock';

const APP_DIR = { appDir: './src/app', overrides: {} };

beforeEach(() => {
  resetSqliteMock();
  resetSecureStoreMock();
  resetCryptoMock();
});

async function press(matcher: string | RegExp) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(matcher));
  });
}

/**
 * A finished "Push" session with one bench exercise and two logged sets. The
 * session_exercise row is written through the repository, so the finished
 * screen sees exactly what a completed workout leaves behind.
 */
async function seed(): Promise<{ sessionId: number }> {
  const { db } = await openEncryptedDatabase();
  await migrateDatabase(db);
  const database = new GymPalDatabase(db);

  await database.saveProfile({
    name: 'Alex Carter',
    heightCm: 180,
    weightKg: 80,
    system: 'metric',
  });

  const bench = await database.findExerciseByName('Bench Press');
  if (!bench) {
    throw new Error('The exercise library did not seed.');
  }

  const startedAt = Date.now() - 2 * 60 * 60 * 1000;
  const session = await database.startSession({ title: 'Push', startedAt });
  await addSessionExercise(db, {
    sessionId: session.id,
    exerciseId: bench.id,
    position: 0,
    name: 'Bench Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    targetSets: 3,
    repRangeMin: 5,
    repRangeMax: 8,
    restSeconds: 90,
  });
  await database.logSet({
    sessionId: session.id,
    exerciseId: bench.id,
    setNumber: 1,
    weightKg: 60,
    reps: 8,
    completedAt: startedAt + 60_000,
  });
  await database.logSet({
    sessionId: session.id,
    exerciseId: bench.id,
    setNumber: 2,
    weightKg: 65,
    reps: 6,
    completedAt: startedAt + 120_000,
  });
  await database.completeSession(session.id, { endedAt: startedAt + 3_600_000 });

  await db.closeAsync();

  return { sessionId: session.id };
}

function setId(testID: unknown): number {
  return Number(String(testID).match(/\d+/)?.[0]);
}

describe('finished session editing', () => {
  it('edits a weight inline and keeps it', async () => {
    const { sessionId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: `/sessions/${sessionId}` });

    await waitFor(() => expect(screen.getAllByTestId(/session-set-\d+-weight/).length).toBe(2));
    expect(screen.getByTestId('muscle-diagram')).toBeTruthy();
    expect(screen.getByTestId('session-share')).toBeTruthy();
    expect(screen.getByText('Chest · Shoulders · Triceps')).toBeTruthy();

    const [firstWeight] = screen.getAllByTestId(/session-set-\d+-weight/);
    const firstId = setId(firstWeight.props.testID);
    expect(firstWeight.props.value).toBe('60');

    await act(async () => {
      fireEvent.changeText(firstWeight, '70');
    });
    // The weight commits when the field loses focus.
    await act(async () => {
      firstWeight.props.onBlur?.();
    });

    await waitFor(() => {
      expect(screen.getByTestId(`session-set-${firstId}-weight`).props.value).toBe('70');
    });
  });

  it('adds a blank editable set', async () => {
    const { sessionId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: `/sessions/${sessionId}` });
    await waitFor(() => expect(screen.getAllByTestId(/session-set-\d+-weight/).length).toBe(2));

    await press(/add-session-set-\d+/);

    await waitFor(() => expect(screen.getAllByTestId(/session-set-\d+-weight/).length).toBe(3));
    // The new row starts empty, ready to type into.
    const added = screen.getAllByTestId(/session-set-\d+-weight/).at(-1)!;
    expect(added.props.value).toBe('');
  });

  it('removes a set directly', async () => {
    const { sessionId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: `/sessions/${sessionId}` });
    await waitFor(() => expect(screen.getAllByTestId(/session-set-\d+-weight/).length).toBe(2));

    const secondId = setId(screen.getAllByTestId(/session-set-\d+-weight/)[1].props.testID);
    await press(`remove-set-${secondId}`);

    await waitFor(() => expect(screen.getAllByTestId(/session-set-\d+-weight/).length).toBe(1));
    expect(screen.queryByTestId(`session-set-${secondId}-weight`)).toBeNull();
  });

  it('returns home from the finish button', async () => {
    const { sessionId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: `/sessions/${sessionId}` });
    await waitFor(() => expect(screen.getByTestId('session-finish')).toBeTruthy());

    await press('session-finish');

    await waitFor(() => expect(screen).toHavePathname('/home'));
  });
});
