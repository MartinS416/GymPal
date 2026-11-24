/**
 * Typed errors for the local data layer.
 *
 * Every failure the app can hit while opening, unlocking, migrating or
 * deleting the database is represented here, so the UI can explain what went
 * wrong without inspecting native error strings.
 *
 * These errors never carry the encryption key, profile data or workout
 * contents — only a short, human readable explanation.
 */

export type DatabaseErrorCode =
  /** The running binary was built without SQLCipher. */
  | 'ENCRYPTION_UNAVAILABLE'
  /** The keychain entry is gone but the database file still exists. */
  | 'KEY_MISSING'
  /** The database could not be decrypted with the stored key. */
  | 'UNLOCK_FAILED'
  /** The database failed its integrity check. */
  | 'CORRUPT'
  /** A migration could not be applied. */
  | 'MIGRATION_FAILED'
  /** The database could not be opened at all. */
  | 'OPEN_FAILED'
  /** The keychain itself is unavailable or refused the operation. */
  | 'KEYCHAIN_FAILED';

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  /** Short title suitable for an error screen. */
  readonly title: string;
  /** One or two sentences the user can act on. */
  readonly userMessage: string;

  constructor(
    code: DatabaseErrorCode,
    title: string,
    userMessage: string,
    options?: { cause?: unknown }
  ) {
    super(`${code}: ${title}`);
    this.name = 'DatabaseError';
    this.code = code;
    this.title = title;
    this.userMessage = userMessage;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class EncryptionUnavailableError extends DatabaseError {
  constructor(options?: { cause?: unknown }) {
    super(
      'ENCRYPTION_UNAVAILABLE',
      'Encryption unavailable',
      'This build of GymPal was made without SQLCipher, so it cannot protect the database and will not start. Rebuild the app with SQLCipher enabled — see "Running the app" in the README.',
      options
    );
    this.name = 'EncryptionUnavailableError';
  }
}

export class DatabaseKeyMissingError extends DatabaseError {
  constructor(options?: { cause?: unknown }) {
    super(
      'KEY_MISSING',
      'Encryption key missing',
      'The key that unlocks your local database is no longer available, so your data cannot be read. Deleting the local data will let you start again.',
      options
    );
    this.name = 'DatabaseKeyMissingError';
  }
}

export class DatabaseUnlockError extends DatabaseError {
  constructor(options?: { cause?: unknown }) {
    super(
      'UNLOCK_FAILED',
      'Could not unlock the database',
      'GymPal could not decrypt its local database with the stored key. Your data has not been changed.',
      options
    );
    this.name = 'DatabaseUnlockError';
  }
}

export class DatabaseCorruptError extends DatabaseError {
  constructor(options?: { cause?: unknown }) {
    super(
      'CORRUPT',
      'Database damaged',
      'The local database failed its integrity check. Your data has not been changed.',
      options
    );
    this.name = 'DatabaseCorruptError';
  }
}

export class DatabaseMigrationError extends DatabaseError {
  constructor(options?: { cause?: unknown }) {
    super(
      'MIGRATION_FAILED',
      'Could not update the database',
      'GymPal could not bring the local database up to date. Your data has not been changed.',
      options
    );
    this.name = 'DatabaseMigrationError';
  }
}

export class DatabaseOpenError extends DatabaseError {
  constructor(options?: { cause?: unknown }) {
    super(
      'OPEN_FAILED',
      'Could not open the database',
      'GymPal could not open its local database on this device.',
      options
    );
    this.name = 'DatabaseOpenError';
  }
}

export class KeychainError extends DatabaseError {
  constructor(options?: { cause?: unknown }) {
    super(
      'KEYCHAIN_FAILED',
      'Secure storage unavailable',
      "GymPal could not use the device's secure storage to protect the database key.",
      options
    );
    this.name = 'KeychainError';
  }
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}
