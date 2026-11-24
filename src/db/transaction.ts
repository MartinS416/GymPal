import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs a unit of work inside a transaction and returns its result.
 *
 * The transaction must run on the same connection that had `PRAGMA key`
 * applied. expo-sqlite's `withExclusiveTransactionAsync` opens a second native
 * connection, and a SQLCipher key belongs to one connection only, so an
 * exclusive transaction can never read the encrypted database — it fails with
 * "file is not a database" before the work starts.
 *
 * The regular transaction issues `BEGIN`/`COMMIT` on the keyed connection and
 * rolls back automatically when the work throws, so it is used on every
 * platform, including the browser preview.
 */
export async function runInTransaction<T>(
  db: SQLiteDatabase,
  work: (txn: SQLiteDatabase) => Promise<T>
): Promise<T> {
  let result: T | undefined;

  await db.withTransactionAsync(async () => {
    result = await work(db);
  });

  return result as T;
}
