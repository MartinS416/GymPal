import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { KeychainError } from '@/db/errors';
import { isWebPreview } from '@/db/platform';

/**
 * Encryption key management.
 *
 * The database key is generated once, on this device, by the platform CSPRNG
 * and then handed to the platform keystore (iOS Keychain / Android Keystore
 * via SharedPreferences). It is never written next to the database, never
 * included in a log line, and never leaves the device.
 */

/** Keychain service / Android keystore alias used for the database key. */
const KEYCHAIN_SERVICE = 'com.skachcorp.gympal.database';

/** Keychain entry name. The version suffix allows a future key rotation. */
const KEYCHAIN_KEY = 'gympal.database.key.v1';

/** Length of the raw key in bytes. 32 bytes = 256 bits of entropy. */
const KEY_BYTES = 32;

/**
 * `THIS_DEVICE_ONLY` keeps the key out of iCloud Keychain and device
 * migrations: a key that travelled to another device could not unlock the
 * database that stayed behind, and a database without its key is useless.
 * `WHEN_UNLOCKED` means the key is unreadable while the device is locked.
 */
const KEYCHAIN_ACCESSIBLE = SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;

const KEY_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Generates a cryptographically secure random key.
 *
 * The result is 32 bytes of entropy rendered as lowercase hex so it is safe to
 * pass through a SQL literal without any escaping concerns.
 */
export function generateDatabaseKey(): string {
  const bytes = Crypto.getRandomBytes(KEY_BYTES);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** True when a string has the shape of a key this module produced. */
export function isDatabaseKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

export type DatabaseKeyOptions = {
  /**
   * When true an existing key is returned as-is. When false a new key is
   * generated and replaces the old one.
   */
  create?: boolean;
};

/**
 * Reads the database key from secure storage.
 *
 * Returns `null` when no key has been stored yet.
 */
export async function readDatabaseKey(): Promise<string | null> {
  try {
    const value = isWebPreview
      ? readWebKey()
      : await SecureStore.getItemAsync(KEYCHAIN_KEY, {
          keychainService: KEYCHAIN_SERVICE,
        });
    if (value === null) {
      return null;
    }
    if (!isDatabaseKey(value)) {
      // A malformed entry is treated as "no key" rather than being used.
      return null;
    }
    return value;
  } catch (error) {
    throw new KeychainError({ cause: error });
  }
}

/**
 * Returns the stored key, generating and persisting one on first run.
 *
 * The key is created only when the caller explicitly allows it, so a read
 * during startup never silently replaces an existing key.
 */
export async function loadOrCreateDatabaseKey(
  options: DatabaseKeyOptions = { create: true }
): Promise<string> {
  const existing = await readDatabaseKey();
  if (existing !== null) {
    return existing;
  }
  if (!options.create) {
    throw new KeychainError();
  }

  const key = generateDatabaseKey();
  await writeDatabaseKey(key);
  return key;
}

/** Stores a key in secure storage, replacing any previous entry. */
export async function writeDatabaseKey(key: string): Promise<void> {
  if (!isDatabaseKey(key)) {
    throw new KeychainError();
  }
  try {
    if (isWebPreview) {
      writeWebKey(key);
      return;
    }
    await SecureStore.setItemAsync(KEYCHAIN_KEY, key, {
      keychainAccessible: KEYCHAIN_ACCESSIBLE,
      keychainService: KEYCHAIN_SERVICE,
    });
  } catch (error) {
    throw new KeychainError({ cause: error });
  }
}

/** Removes the key from secure storage. Safe to call when no key exists. */
export async function deleteDatabaseKey(): Promise<void> {
  try {
    if (isWebPreview) {
      deleteWebKey();
      return;
    }
    await SecureStore.deleteItemAsync(KEYCHAIN_KEY, {
      keychainService: KEYCHAIN_SERVICE,
    });
  } catch (error) {
    throw new KeychainError({ cause: error });
  }
}

/**
 * The browser's key storage.
 *
 * A browser has no keystore, so the preview build keeps the key in local
 * storage. It is not secret: any script running on the origin could read it.
 * That is exactly why the preview build is never encrypted, and why the
 * device builds use the platform keystore instead.
 */
const WEB_KEY_STORAGE = 'gympal.database.key.v1';

function readWebKey(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(WEB_KEY_STORAGE);
}

function writeWebKey(key: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(WEB_KEY_STORAGE, key);
}

function deleteWebKey(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.removeItem(WEB_KEY_STORAGE);
}
