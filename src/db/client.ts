import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  DatabaseCorruptError,
  DatabaseKeyMissingError,
  DatabaseOpenError,
  DatabaseUnlockError,
  EncryptionUnavailableError,
} from '@/db/errors';
import { deleteDatabaseKey, generateDatabaseKey, readDatabaseKey, writeDatabaseKey } from '@/db/key';
import { getUserVersion, migrateDatabase } from '@/db/migrations';
import { supportsEncryption } from '@/db/platform';

/** File name of the local database. */
export const DATABASE_NAME = 'gympal.db';

/**
 * The passphrase is written with `execAsync`, which does not escape
 * parameters. That is safe here because the key is generated locally and is
 * always 64 lowercase hex characters — the format is validated before use, so
 * it can never contain a quote or a semicolon.
 */
const KEY_LITERAL_PATTERN = /^[0-9a-f]{64}$/;

export type OpenDatabaseOptions = {
  /**
   * Skip the keychain and open the database with a throwaway key.
   * Only used by tooling and tests.
   */
  key?: string;
};

export type OpenDatabaseResult = {
  db: SQLiteDatabase;
  /** True when a new key was generated and stored during this open. */
  keyCreated: boolean;
  /** True when the database file was created by this open. */
  isNewDatabase: boolean;
};

/**
 * Opens the encrypted database, creating and protecting it as needed.
 *
 * The order of operations matters:
 *
 * 1. The key is read from the keychain. If there is none, a new one is
 *    generated in memory but *not* stored yet.
 * 2. The database is opened and the key is applied with `PRAGMA key`.
 * 3. SQLCipher is verified to be present. A build without it is refused
 *    before anything is written, so the app can never fall back to plaintext.
 * 4. The unlock is verified by reading the schema. A failure here means the
 *    file belongs to a different key — the existing data is left untouched.
 * 5. Only then is a newly generated key written to the keychain.
 */
export async function openEncryptedDatabase(
  options: OpenDatabaseOptions = {}
): Promise<OpenDatabaseResult> {
  const storedKey = await readDatabaseKey();
  const key = options.key ?? storedKey ?? generateDatabaseKey();
  const keyWasGenerated = !options.key && storedKey === null;

  if (!KEY_LITERAL_PATTERN.test(key)) {
    throw new DatabaseUnlockError();
  }

  let db: SQLiteDatabase;
  try {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  } catch (error) {
    throw new DatabaseOpenError({ cause: error });
  }

  try {
    await db.execAsync(`PRAGMA key = '${key}'`);

    if (supportsEncryption) {
      // The preview build in a browser has no SQLCipher, so there is nothing
      // to verify. The device builds must prove it, before anything is
      // written, that the database really is encrypted.
      await assertCipherAvailable(db);
    }

    await assertUnlocked(db, keyWasGenerated);
    await assertNotCorrupt(db);

    // Connection level settings. Both have to be applied outside a
    // transaction, and both are per connection rather than per database.
    await db.execAsync('PRAGMA foreign_keys = ON');
    await db.execAsync('PRAGMA journal_mode = WAL');

    if (keyWasGenerated) {
      // The key is only trusted once it has proved it can read the file.
      await writeDatabaseKey(key);
    }

    // The schema is brought up to date before anything is read or written.
    const wasEmpty = (await getUserVersion(db)) === 0;
    await migrateDatabase(db);

    return { db, keyCreated: keyWasGenerated, isNewDatabase: wasEmpty };
  } catch (error) {
    await safeClose(db);
    throw error;
  }
}

/**
 * Fails when the running binary does not include SQLCipher.
 *
 * Without SQLCipher `PRAGMA key` is silently ignored, so this check is the
 * only thing standing between a development build and a plaintext database.
 */
async function assertCipherAvailable(db: SQLiteDatabase): Promise<void> {
  let cipher: { cipher_version?: string } | null = null;
  try {
    cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  } catch {
    cipher = null;
  }
  if (!cipher?.cipher_version) {
    throw new EncryptionUnavailableError();
  }
}

/**
 * Proves the key opens the file.
 *
 * A fresh (empty) file opens with any key, so this also tells us whether the
 * database already held data: if the read fails and no key was stored, the
 * file was encrypted with a key that no longer exists.
 */
async function assertUnlocked(db: SQLiteDatabase, keyWasGenerated: boolean): Promise<void> {
  try {
    await db.getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM sqlite_master'
    );
  } catch (error) {
    if (keyWasGenerated) {
      throw new DatabaseKeyMissingError({ cause: error });
    }
    throw new DatabaseUnlockError({ cause: error });
  }
}

/**
 * Runs SQLCipher's integrity check over the decrypted pages.
 *
 * `cipher_integrity_check` is preferred; older SQLCipher builds only know the
 * plain `integrity_check`, which validates the decrypted database just as well.
 */
async function assertNotCorrupt(db: SQLiteDatabase): Promise<void> {
  let rows: { cipher_integrity_check?: string; integrity_check?: string }[] = [];
  try {
    rows = await db.getAllAsync<{ cipher_integrity_check: string }>(
      'PRAGMA cipher_integrity_check'
    );
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    try {
      rows = await db.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    } catch (error) {
      throw new DatabaseCorruptError({ cause: error });
    }
  }

  const failed = rows.filter((row) => {
    const value = row.cipher_integrity_check ?? row.integrity_check;
    return value !== 'ok';
  });

  if (failed.length > 0) {
    throw new DatabaseCorruptError();
  }
}

/** Closes a connection, ignoring errors from an already closed database. */
export async function safeClose(db: SQLiteDatabase | null): Promise<void> {
  if (!db) {
    return;
  }
  try {
    await db.closeAsync();
  } catch {
    // The connection is being discarded either way.
  }
}

/**
 * Splits a database path into the directory and the file name.
 */
export function splitDatabasePath(path: string): { directory: string; name: string } {
  const separator = path.lastIndexOf('/');
  if (separator === -1) {
    return { directory: '', name: path };
  }
  return { directory: path.slice(0, separator), name: path.slice(separator + 1) };
}

/**
 * Deletes the database file (and its write-ahead log siblings) from disk.
 *
 * The caller must close the connection first — deleting a file that is still
 * open is not safe on either platform.
 */
export async function deleteDatabaseFiles(databasePath?: string): Promise<void> {
  const name = databasePath ? splitDatabasePath(databasePath).name : DATABASE_NAME;
  const directory = databasePath ? splitDatabasePath(databasePath).directory : undefined;

  await SQLite.deleteDatabaseAsync(name, directory);
}

/**
 * Removes every trace of local data: the database file and the key that
 * unlocks it.
 *
 * The key is removed last, so an interrupted delete can still be recovered on
 * the next launch rather than leaving an undecryptable file behind.
 */
export async function deleteLocalData(databasePath?: string): Promise<void> {
  await deleteDatabaseFiles(databasePath);
  await deleteDatabaseKey();
}
