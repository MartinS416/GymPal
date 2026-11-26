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

/** Twelve finished Push sessions, newest first. */
async function seedWorkouts(count = 12): Promise<void> {
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

  const now = Date.now();
  for (let index = 0; index < count; index += 1) {
    const startedAt = now - (index + 1) * 60 * 60 * 1000;
    const session = await database.startSession({
      title: `Push ${index + 1}`,
      startedAt,
    });
    await addSessionExercise(db, {
      sessionId: session.id,
      exerciseId: bench.id,
      position: 0,
      name: 'Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      targetSets: 1,
      repRangeMin: 8,
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
    await database.completeSession(session.id, {
      endedAt: startedAt + 30 * 60 * 1000,
    });
  }

  await db.closeAsync();
}

describe('home workout feed', () => {
  it('renders ten workouts, then appends the next page on scroll', async () => {
    await seedWorkouts(12);
    await renderRouter(APP_DIR, { initialUrl: '/home' });

    await waitFor(() =>
      expect(screen.getAllByTestId(/^feed-session-\d+$/)).toHaveLength(10)
    );
    expect(screen.getByText('Push 1')).toBeTruthy();
    expect(screen.queryByText('Push 12')).toBeNull();
    expect(screen.getByTestId('feed-share-1')).toBeTruthy();

    await act(async () => {
      fireEvent.scroll(screen.getByTestId('home-scroll'), {
        nativeEvent: {
          contentOffset: { x: 0, y: 2000 },
          contentSize: { width: 350, height: 2400 },
          layoutMeasurement: { width: 350, height: 800 },
        },
      });
    });

    await waitFor(() =>
      expect(screen.getAllByTestId(/^feed-session-\d+$/)).toHaveLength(12)
    );
    expect(screen.getByText('Push 12')).toBeTruthy();
  });
});
