/**
 * Jest setup.
 *
 * - `expo-router/testing-library` registers the router matchers
 *   (`toHavePathname`, `toHaveSegments`, ...) and installs the native mocks
 *   that Expo Router needs.
 * - `expo-sqlite`, `expo-secure-store` and `expo-crypto` are replaced with
 *   test doubles: the native modules do not exist under Jest, and the SQLite
 *   double is backed by a real SQL engine so the schema, constraints,
 *   foreign keys and transactions are tested for real.
 * - The Live Activity factory and the platform layer are replaced with a test
 *   double that records what the app asked the system to show.
 */
require('expo-router/testing-library');

jest.mock('expo-sqlite', () => require('./test-support/sqlite-mock'));
jest.mock('expo-secure-store', () => require('./test-support/secure-store-mock'));
jest.mock('expo-crypto', () => require('./test-support/crypto-mock'));
jest.mock('@/widgets/workout-live-activity', () =>
  require('./test-support/workout-activity-mock')
);

const workoutActivityMock = require('./test-support/workout-activity-mock');
beforeEach(() => {
  workoutActivityMock.resetWorkoutActivityMock();
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
