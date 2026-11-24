import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs a unit of work inside a transaction and returns its result.
 *
 * On native the exclusive transaction is used: it runs on its own connection
 * so no other query can interleave, and it rolls back automatically when the
 * work throws. The web build of expo-sqlite does not support exclusive
 * transactions, so there the regular transaction is used instead.
 */
export async function runInTransaction<T>(
  db: SQLiteDatabase,
  work: (txn: SQLiteDatabase) => Promise<T>
): Promise<T> {
  let result: T | undefined;

  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => {
      result = await work(db);
    });
  } else {
    await db.withExclusiveTransactionAsync(async (txn) => {
      result = await work(txn);
    });
  }

  return result as T;
}
