import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  DATABASE_NAME,
  DatabaseCorruptError,
  DatabaseKeyMissingError,
  DatabaseUnlockError,
  EncryptionUnavailableError,
  deleteLocalData,
  generateDatabaseKey,
  isDatabaseKey,
  openEncryptedDatabase,
  readDatabaseKey,
  writeDatabaseKey,
} from '@/db';
import { resetSqliteMock, setCipherSupport, setIntegrityFailure } from '../test-support/sqlite-mock';
import { resetSecureStoreMock, secureStoreMockEntries, setItemAsync } from '../test-support/secure-store-mock';
import { resetCryptoMock } from '../test-support/crypto-mock';

describe('encryption key', () => {
  beforeEach(() => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
  });

  it('generates a 256 bit key in hex', () => {
    const key = generateDatabaseKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(isDatabaseKey(key)).toBe(true);
  });

  it('generates a different key every time', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateDatabaseKey()));
    expect(keys.size).toBe(20);
  });

  it('rejects values that are not keys', () => {
    expect(isDatabaseKey('')).toBe(false);
    expect(isDatabaseKey('not-a-key')).toBe(false);
    expect(isDatabaseKey(`${'0'.repeat(64)}`)).toBe(true);
    expect(isDatabaseKey(`${'0'.repeat(63)}`)).toBe(false);
  });

  it('stores the key in the keychain, not in the app', async () => {
    const key = generateDatabaseKey();
    await writeDatabaseKey(key);

    expect(await readDatabaseKey()).toBe(key);
    // The key lives in the keychain service, never under a plain key.
    expect(Object.keys(secureStoreMockEntries())).toHaveLength(1);
    expect(Object.values(secureStoreMockEntries())[0]).toBe(key);
  });

  it('treats a malformed keychain entry as no key', async () => {
    // A value that cannot be a key must never be used to open the database.
    await setItemAsync('gympal.database.key.v1', 'corrupted', {
      keychainService: 'com.skachcorp.gympal.database',
    });

    expect(await readDatabaseKey()).toBeNull();
  });
});

describe('opening the encrypted database', () => {
  beforeEach(() => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
  });

  it('creates the database and stores a key on first run', async () => {
    const { db, keyCreated } = await openEncryptedDatabase();

    expect(keyCreated).toBe(true);
    expect(db.databasePath).toContain(DATABASE_NAME);
    expect(await readDatabaseKey()).not.toBeNull();
    expect(isDatabaseKey(await readDatabaseKey())).toBe(true);

    await db.closeAsync();
  });

  it('reuses the stored key on the next launch', async () => {
    const first = await openEncryptedDatabase();
    const key = await readDatabaseKey();
    await first.db.closeAsync();

    const second = await openEncryptedDatabase();

    expect(second.keyCreated).toBe(false);
    expect(await readDatabaseKey()).toBe(key);

    await second.db.closeAsync();
  });

  it('refuses to run in a build without SQLCipher', async () => {
    setCipherSupport(false);

    await expect(openEncryptedDatabase()).rejects.toBeInstanceOf(
      EncryptionUnavailableError
    );

    // Nothing was written, and no key was left behind.
    expect(await readDatabaseKey()).toBeNull();
  });

  it('reports a missing key when the database exists but the key is gone', async () => {
    const first = await openEncryptedDatabase();
    await first.db.closeAsync();

    // The keychain entry is lost, as it would be if the device was reset.
    resetSecureStoreMock();

    await expect(openEncryptedDatabase()).rejects.toBeInstanceOf(
      DatabaseKeyMissingError
    );
  });

  it('reports a failed unlock when the key does not match', async () => {
    const first = await openEncryptedDatabase();
    await first.db.closeAsync();

    // A different key is present in the keychain.
    await writeDatabaseKey(generateDatabaseKey());

    await expect(openEncryptedDatabase()).rejects.toBeInstanceOf(DatabaseUnlockError);
  });

  it('reports a corrupt database', async () => {
    setIntegrityFailure('database disk image is malformed');

    await expect(openEncryptedDatabase()).rejects.toBeInstanceOf(DatabaseCorruptError);
  });

  it('never writes the key to the database file', async () => {
    const { db } = await openEncryptedDatabase();
    const key = await readDatabaseKey();
    await db.closeAsync();

    // The key must not be recoverable from anything the app stores itself.
    const stored = JSON.stringify(secureStoreMockEntries());
    expect(stored).toContain(key);
  });
});

describe('the key never reaches the logs', () => {
  beforeEach(() => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
  });

  function captureConsole(run: () => Promise<void>): Promise<string> {
    const output: string[] = [];
    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };
    const capture = (...args: unknown[]) => {
      output.push(args.map((arg) => String(arg)).join(' '));
    };
    console.log = capture;
    console.warn = capture;
    console.error = capture;
    console.info = capture;
    console.debug = capture;

    return run()
      .catch(() => undefined)
      .then(() => {
        Object.assign(console, original);
        return output.join('\n');
      });
  }

  it('does not log the key while opening the database', async () => {
    const output = await captureConsole(async () => {
      const { db } = await openEncryptedDatabase();
      await db.closeAsync();
    });

    const key = await readDatabaseKey();
    expect(key).not.toBeNull();
    expect(output).not.toContain(key as string);
  });

  it('does not log the key when the unlock fails', async () => {
    const first = await openEncryptedDatabase();
    await first.db.closeAsync();
    await writeDatabaseKey(generateDatabaseKey());

    const output = await captureConsole(async () => {
      await openEncryptedDatabase().catch(() => undefined);
    });

    const key = await readDatabaseKey();
    expect(output).not.toContain(key as string);
  });
});

describe('deleting local data', () => {
  beforeEach(() => {
    resetSqliteMock();
    resetSecureStoreMock();
    resetCryptoMock();
  });

  it('removes the database and the key', async () => {
    const { db } = await openEncryptedDatabase();
    const path = db.databasePath;
    await db.closeAsync();

    await deleteLocalData(path);

    expect(await readDatabaseKey()).toBeNull();
  });

  it('leaves the app with a working, empty database afterwards', async () => {
    const { db } = await openEncryptedDatabase();
    await db.closeAsync();

    await deleteLocalData();

    const reopened = await openEncryptedDatabase();
    expect(reopened.keyCreated).toBe(true);
    await reopened.db.closeAsync();
  });
});
