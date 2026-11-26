import { act, waitFor } from '@testing-library/react-native';
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

/** A touch at a horizontal position, for the swipe gesture. */
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

async function swipeLeft() {
  const view = screen.getByTestId('session-screen');
  await act(async () => {
    view.props.onMoveShouldSetPanResponder?.({}, { dx: -80, dy: 0 });
    view.props.onResponderGrant?.(touch(280));
    view.props.onResponderMove?.(touch(180));
    view.props.onResponderRelease?.(touch(120));
  });
}

/**
 * A two-set session that has walked off the end of its timeline: every set is
 * logged, no clock is running, and the summary totals are banked.
 */
async function seedCompletion(): Promise<{ sessionId: number }> {
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

  const startedAt = Date.now() - 21 * 60 * 1000;
  const session = await database.startSession({ title: 'Push', startedAt });
  await addSessionExercise(db, {
    sessionId: session.id,
    exerciseId: bench.id,
    position: 0,
    name: 'Bench Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    targetSets: 2,
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

  // The two-set timeline has three phases (work, rest, work); phase 3 is the
  // recap. The clocks are stopped and the elapsed totals are banked.
  await db.runAsync(
    `UPDATE workout_sessions
        SET phase_index = 3,
            work_total_seconds = 900,
            rest_total_seconds = 300,
            exercise_started_at = NULL,
            exercise_elapsed_seconds = 0
      WHERE id = ?`,
    session.id
  );

  await db.closeAsync();
  return { sessionId: session.id };
}

describe('session completion', () => {
  it('shows the recap in place of the clock and cannot swipe forward', async () => {
    const { sessionId } = await seedCompletion();

    await renderRouter(APP_DIR, { initialUrl: `/session/${sessionId}` });
    await waitFor(() => expect(screen.getByTestId('session-summary')).toBeTruthy());

    expect(screen.getByText('All sets complete')).toBeTruthy();
    // 60 kg x 8 + 65 kg x 6 = 870 kg.
    expect(screen.getByText('870 kg')).toBeTruthy();
    expect(screen.getByText('15:00')).toBeTruthy();
    expect(screen.getByText('5:00')).toBeTruthy();

    // The timer ring and the add/remove-set controls are gone.
    expect(screen.queryByText('EXERCISE TIME')).toBeNull();
    expect(screen.queryByTestId('add-set')).toBeNull();
    expect(screen.queryByTestId('remove-set')).toBeNull();

    // There is no page after the recap: the swipe stays where it is.
    await swipeLeft();
    expect(screen.getByTestId('session-summary')).toBeTruthy();
    expect(screen.getByText('All sets complete')).toBeTruthy();
  });
});
