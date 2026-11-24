import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A stand-in for `expo-sqlite` backed by Node's built in SQLite.
 *
 * The native module does not exist under Jest, so the data layer is tested
 * against a real SQL engine instead of a hand written fake. That keeps the
 * constraints, foreign keys, transactions and views honest.
 *
 * The mock also emulates the parts of SQLCipher that matter to the app:
 *
 * - `PRAGMA key` records the key on the connection.
 * - The key is checked against a sidecar file next to the database, so
 *   opening a database with the wrong key fails the same way SQLCipher does.
 * - `PRAGMA cipher_version` only reports a version when the mock is
 *   configured to behave like a SQLCipher build.
 */

export type MockSqliteOptions = {
  /** Directory the databases are created in. */
  directory?: string;
  /** When false, `PRAGMA cipher_version` reports nothing. */
  supportsCipher?: boolean;
  /** When set, the integrity check reports this instead of "ok". */
  integrityFailure?: string;
};

const state = {
  directory: mkdtempSync(join(tmpdir(), 'gympal-sqlite-')),
  supportsCipher: true,
  integrityFailure: undefined as string | undefined,
};

export const defaultDatabaseDirectory = state.directory;

/** Points the mock at a fresh temporary directory. */
export function resetSqliteMock(options: MockSqliteOptions = {}): void {
  try {
    rmSync(state.directory, { recursive: true, force: true });
  } catch {
    // The directory may already be gone.
  }
  state.directory = options.directory ?? mkdtempSync(join(tmpdir(), 'gympal-sqlite-'));
  state.supportsCipher = options.supportsCipher ?? true;
  state.integrityFailure = options.integrityFailure;
  mkdirSync(state.directory, { recursive: true });
}

/** Simulates a build without SQLCipher. */
export function setCipherSupport(supported: boolean): void {
  state.supportsCipher = supported;
}

/** Makes the integrity check report a failure. */
export function setIntegrityFailure(message: string | undefined): void {
  state.integrityFailure = message;
}

function keySidecarPath(databasePath: string): string {
  return `${databasePath}.cipherkey`;
}

function isPragma(source: string): boolean {
  return /^\s*pragma\s+/i.test(source);
}

function splitStatements(source: string): string[] {
  return source
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * Normalises the binding arguments.
 *
 * `expo-sqlite` accepts a single array, a single named object, or a variadic
 * list of positional values, so the mock has to understand all three.
 */
function normaliseParams(params: unknown[]): {
  positional: unknown[];
  named: Record<string, unknown> | null;
} {
  if (params.length === 0) {
    return { positional: [], named: null };
  }
  if (params.length === 1) {
    const only = params[0];
    if (Array.isArray(only)) {
      return { positional: only, named: null };
    }
    if (only !== null && typeof only === 'object') {
      const named: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(only as Record<string, unknown>)) {
        named[key.startsWith('$') ? key : `$${key}`] = value;
      }
      return { positional: [], named };
    }
    return { positional: [only], named: null };
  }
  return { positional: params, named: null };
}

export class MockSQLiteDatabase {
  readonly databasePath: string;
  readonly options: { useNewConnection?: boolean };

  private readonly handle: DatabaseSync;
  private key: string | null = null;
  private closed = false;
  private transactionDepth = 0;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
    this.options = {};
    mkdirSync(join(databasePath, '..'), { recursive: true });
    this.handle = new DatabaseSync(databasePath);
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('The database connection is closed.');
    }
  }

  /**
   * Emulates SQLCipher: the key has to match the one the file was written
   * with, and a file that has never been written adopts the current key.
   */
  private verifyKey(): void {
    if (this.key === null) {
      throw new Error('file is not a database');
    }
    const sidecar = keySidecarPath(this.databasePath);
    if (existsSync(sidecar)) {
      const expected = readFileSync(sidecar, 'utf8');
      if (expected !== this.key) {
        throw new Error('file is not a database');
      }
      return;
    }
    writeFileSync(sidecar, this.key, 'utf8');
  }

  private handlePragma(statement: string): boolean {
    const keyMatch = statement.match(/^pragma\s+key\s*=\s*'([^']*)'$/i);
    if (keyMatch) {
      this.key = keyMatch[1];
      return true;
    }
    return false;
  }

  private runStatement(statement: string): void {
    this.assertOpen();
    if (this.handlePragma(statement)) {
      return;
    }
    if (!/^pragma\s+cipher_version/i.test(statement)) {
      this.verifyKey();
    }
    this.handle.exec(statement);
  }

  async execAsync(source: string): Promise<void> {
    for (const statement of splitStatements(source)) {
      this.runStatement(statement);
    }
  }

  async runAsync(source: string, ...params: unknown[]): Promise<{ lastInsertRowId: number; changes: number }> {
    this.assertOpen();
    if (!isPragma(source)) {
      this.verifyKey();
    }
    const { positional, named } = normaliseParams(params);
    const statement = this.handle.prepare(source);
    const result = named
      ? statement.run(named as never)
      : statement.run(...(positional as never[]));
    // Node names the field `lastInsertRowid`; expo-sqlite calls it
    // `lastInsertRowId`. The mock returns the expo-sqlite spelling.
    const lastInsertRowId = (
      result as unknown as { lastInsertRowid?: number; lastInsertRowId?: number }
    ).lastInsertRowid;
    return {
      lastInsertRowId: Number(
        lastInsertRowId ??
          (result as unknown as { lastInsertRowId?: number }).lastInsertRowId ??
          0
      ),
      changes: Number(result.changes),
    };
  }

  private prepare(source: string): StatementSync {
    return this.handle.prepare(source);
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    this.assertOpen();

    if (/^pragma\s+cipher_version/i.test(source)) {
      return (state.supportsCipher
        ? { cipher_version: '4.5.4' }
        : null) as T | null;
    }

    if (!isPragma(source)) {
      this.verifyKey();
    }

    const { positional, named } = normaliseParams(params);
    const statement = this.prepare(source);
    const row = named
      ? statement.get(named as never)
      : statement.get(...(positional as never[]));
    return row === undefined ? null : ({ ...row } as T);
  }

  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    this.assertOpen();

    if (/^pragma\s+cipher_integrity_check/i.test(source)) {
      if (!state.supportsCipher) {
        return [];
      }
      this.verifyKey();
      return ([
        { cipher_integrity_check: state.integrityFailure ?? 'ok' },
      ] as unknown as T[]);
    }

    if (/^pragma\s+integrity_check/i.test(source)) {
      this.verifyKey();
      return ([
        { integrity_check: state.integrityFailure ?? 'ok' },
      ] as unknown as T[]);
    }

    if (!isPragma(source)) {
      this.verifyKey();
    }

    const { positional, named } = normaliseParams(params);
    const statement = this.prepare(source);
    const rows = named
      ? statement.all(named as never)
      : statement.all(...(positional as never[]));
    return rows.map((row) => ({ ...row }) as T);
  }

  async getEachAsync<T>(
    source: string,
    ...params: unknown[]
  ): Promise<AsyncIterableIterator<T>> {
    const rows = await this.getAllAsync<T>(source, ...params);
    return (async function* () {
      for (const row of rows) {
        yield row;
      }
    })();
  }

  async prepareAsync(source: string) {
    this.assertOpen();
    const statement = this.prepare(source);
    const self = this;
    return {
      async executeAsync(...params: unknown[]) {
        const { positional, named } = normaliseParams(params);
        const rows = named
          ? statement.all(named as never)
          : statement.all(...(positional as never[]));
        return {
          async getFirstAsync<T>(): Promise<T | null> {
            const row = rows[0];
            return row === undefined ? null : ({ ...row } as T);
          },
          async getAllAsync<T>(): Promise<T[]> {
            return rows.map((row) => ({ ...row }) as T);
          },
          async resetAsync() {},
        };
      },
      async finalizeAsync() {
        void self;
      },
    };
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.assertOpen();
    this.transactionDepth += 1;
    try {
      this.handle.exec('BEGIN');
      await task();
      this.handle.exec('COMMIT');
    } catch (error) {
      try {
        this.handle.exec('ROLLBACK');
      } catch {
        // SQLite may have rolled back already.
      }
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  /**
   * The mock runs the task on the same connection, which keeps the test
   * simple while still rolling back on failure.
   */
  async withExclusiveTransactionAsync(
    task: (txn: MockSQLiteDatabase) => Promise<void>
  ): Promise<void> {
    await this.withTransactionAsync(async () => {
      await task(this);
    });
  }

  isInTransactionAsync(): Promise<boolean> {
    return Promise.resolve(this.transactionDepth > 0);
  }

  async closeAsync(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.handle.close();
  }

  closeSync(): void {
    void this.closeAsync();
  }
}

export async function openDatabaseAsync(
  databaseName: string,
  options?: { useNewConnection?: boolean },
  directory?: string
): Promise<MockSQLiteDatabase> {
  const target = directory ?? state.directory;
  mkdirSync(target, { recursive: true });
  const database = new MockSQLiteDatabase(join(target, databaseName));
  database.options.useNewConnection = options?.useNewConnection;
  return database;
}

export async function deleteDatabaseAsync(
  databaseName: string,
  directory?: string
): Promise<void> {
  const target = directory ?? state.directory;
  const path = join(target, databaseName);
  for (const file of [path, `${path}-wal`, `${path}-shm`, keySidecarPath(path)]) {
    if (existsSync(file)) {
      rmSync(file, { force: true });
    }
  }
}

export function deleteDatabaseSync(databaseName: string, directory?: string): void {
  void deleteDatabaseAsync(databaseName, directory);
}

export const bundledExtensions: Record<string, undefined> = {};
