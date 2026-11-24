import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';

import { GymPalDatabase, migrateDatabase } from '@/db';
import { openEncryptedDatabase } from '@/db/client';
import { resetCryptoMock } from '../test-support/crypto-mock';
import { resetSecureStoreMock } from '../test-support/secure-store-mock';
import { resetSqliteMock } from '../test-support/sqlite-mock';

const APP_DIR = { appDir: './src/app', overrides: {} };
const DAY = 24 * 60 * 60 * 1000;

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

async function addSession(
  database: GymPalDatabase,
  exerciseId: number,
  weightKg: number,
  reps: number,
  daysAgo: number
) {
  const startedAt = Date.now() - daysAgo * DAY;
  const session = await database.startSession({ title: 'Push', startedAt });

  await database.logSet({
    sessionId: session.id,
    exerciseId,
    setNumber: 1,
    weightKg,
    reps,
    completedAt: startedAt + 60_000,
  });
  await database.logSet({
    sessionId: session.id,
    exerciseId,
    setNumber: 2,
    weightKg: weightKg - 5,
    reps: reps + 2,
    completedAt: startedAt + 120_000,
  });

  await database.completeSession(session.id, { endedAt: startedAt + 3_600_000 });
}

/**
 * A user with a history: two body weight entries, three bench sessions and one
 * row session. The rows are written with the repositories, so the screens see
 * exactly what a finished workout would have left behind.
 */
async function seed(): Promise<{ benchId: number; rowId: number }> {
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
  const row = await database.findExerciseByName('Barbell Row');
  if (!bench || !row) {
    throw new Error('The exercise library did not seed.');
  }

  await database.addProgressEntry({
    kind: 'body_weight',
    valueKg: 82.5,
    recordedAt: Date.now() - 30 * DAY,
  });
  await database.addProgressEntry({
    kind: 'body_weight',
    valueKg: 81.2,
    recordedAt: Date.now() - 10 * DAY,
  });

  await addSession(database, bench.id, 60, 8, 40);
  await addSession(database, bench.id, 65, 8, 20);
  await addSession(database, bench.id, 70, 6, 2);
  await addSession(database, row.id, 50, 10, 5);

  await db.closeAsync();

  return { benchId: bench.id, rowId: row.id };
}

describe('progress flow', () => {
  it('shows the dashboard and logs a body weight from it', async () => {
    const { benchId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: '/progress' });

    await waitFor(() => expect(screen.getByTestId('metric-body_weight')).toBeTruthy());
    expect(screen.getByTestId(`metric-exercise:${benchId}`)).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();

    await press('log-weight');
    await waitFor(() => expect(screen.getByTestId('entry-value')).toBeTruthy());
    await type('entry-value', '79.4');
    await press('entry-save');

    await waitFor(() => expect(screen.getByText('79.4')).toBeTruthy());
  });

  it('opens an exercise, changes the range and edits a hand-logged entry', async () => {
    const { benchId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: '/progress' });
    await waitFor(() => expect(screen.getByTestId(`metric-exercise:${benchId}`)).toBeTruthy());

    await press(`metric-exercise:${benchId}`);
    await waitFor(() => expect(screen.getByTestId('progress-detail-back')).toBeTruthy());

    expect(screen.getByTestId('progress-chart')).toBeTruthy();
    expect(screen.getByText('Entries · 3')).toBeTruthy();

    // A week only contains the most recent session.
    await press('timeframe-1W');
    await waitFor(() => expect(screen.getByText('Entries · 1')).toBeTruthy());

    await press('timeframe-1M');
    await waitFor(() => expect(screen.getByText('Entries · 2')).toBeTruthy());

    // Log a weight by hand; it joins the same series as the workouts.
    await press('log-entry');
    await waitFor(() => expect(screen.getByTestId('entry-value')).toBeTruthy());
    await type('entry-value', '72.5');
    await press('entry-save');
    await waitFor(() => expect(screen.getAllByText('72.5').length).toBeGreaterThan(0));

    // The manual point is editable.
    const editable = await screen.findAllByLabelText(/Edit entry from/);
    expect(editable.length).toBe(1);
    await act(async () => {
      fireEvent.press(editable[0]);
    });

    await waitFor(() => expect(screen.getByTestId('entry-delete')).toBeTruthy());
    await type('entry-value', '74');
    await press('entry-save');
    await waitFor(() => expect(screen.getAllByText('74').length).toBeGreaterThan(0));

    // Deleting it leaves the workouts behind.
    const again = await screen.findAllByLabelText(/Edit entry from/);
    await act(async () => {
      fireEvent.press(again[0]);
    });
    await press('entry-delete');

    await waitFor(() => expect(screen.queryByText('74')).toBeNull());
    expect(screen.getAllByText('70').length).toBeGreaterThan(0);
  });

  it('unpins a metric and keeps the choice', async () => {
    const { benchId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: '/progress' });
    await waitFor(() => expect(screen.getByTestId('edit-metrics')).toBeTruthy());

    await press('edit-metrics');
    await waitFor(() => expect(screen.getByTestId(`unpin-exercise:${benchId}`)).toBeTruthy());
    await press(`unpin-exercise:${benchId}`);
    await press('metric-picker-done');

    // The metric moves under the other metrics.
    await waitFor(() => expect(screen.getByText('All metrics')).toBeTruthy());

    // The choice survives reopening the sheet: it is available to pin again.
    await press('edit-metrics');
    await waitFor(() => expect(screen.getByTestId(`pin-exercise:${benchId}`)).toBeTruthy());
  });

  it('reorders pinned metrics in the edit sheet', async () => {
    const { benchId, rowId } = await seed();

    await renderRouter(APP_DIR, { initialUrl: '/progress' });
    await waitFor(() => expect(screen.getByTestId('edit-metrics')).toBeTruthy());

    await press('edit-metrics');
    await waitFor(() => expect(screen.getByTestId(`pin-handle-exercise:${benchId}`)).toBeTruthy());

    // Move the bench below the row through the handle's accessibility action,
    // the same reorder the drag performs.
    const handle = screen.getByTestId(`pin-handle-exercise:${benchId}`);
    await act(async () => {
      handle.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });

    // The row now precedes the bench in the pinned list.
    await press('metric-picker-done');
    await press('edit-metrics');

    await waitFor(() => expect(screen.getByTestId(`pin-handle-exercise:${rowId}`)).toBeTruthy());

    const handles = screen.getAllByTestId(/pin-handle-/);
    const ids = handles.map((node) => node.props.testID as string);
    expect(ids.indexOf(`pin-handle-exercise:${rowId}`)).toBeLessThan(
      ids.indexOf(`pin-handle-exercise:${benchId}`)
    );
  });
});
