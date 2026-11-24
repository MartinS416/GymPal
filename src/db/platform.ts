import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Platform capabilities the data layer depends on.
 *
 * The device builds (iOS and Android) have a secure keystore and SQLCipher,
 * so the database is encrypted. The browser has neither, so the web build
 * stores the same schema in the browser's own storage **without** encryption.
 * The web build is a development and preview target; the app says so in the
 * interface rather than pretending otherwise.
 *
 * Expo Go is the third case: it is a development-only client that ships plain
 * SQLite and cannot be rebuilt, so it runs the same unencrypted development
 * database. Only Expo itself is treated this way — a development build made
 * without SQLCipher is still refused, because it can and should be rebuilt.
 */

/** What this run must do about encryption, and why. */
export type EncryptionPolicy = {
  /** True when the database has to be protected by SQLCipher. */
  encrypted: boolean;
  /**
   * True when a native development run deliberately uses plain SQLite.
   * Possible in Expo Go, or in a development bundle with the escape hatch.
   */
  unencryptedDevBuild: boolean;
};

/** The environment variable that opens the unencrypted development escape hatch. */
export const ALLOW_UNENCRYPTED_ENV = 'EXPO_PUBLIC_ALLOW_UNENCRYPTED_DATABASE';

/**
 * Decides whether this run has to encrypt its database.
 *
 * The web build never can, so it never has to. A native build always has to,
 * except in a development run that cannot have SQLCipher: Expo Go, which is a
 * store client rather than the app's own binary, or a development bundle that
 * explicitly opts out with the environment variable below. Both exceptions are
 * ignored outside a development bundle, so a shipped app can never fall back
 * to plaintext.
 */
export function encryptionPolicy(options: {
  platform: string;
  isDev: boolean;
  allowUnencrypted: string | undefined;
  /** True when the JavaScript is running inside Expo Go. */
  isExpoGo?: boolean;
}): EncryptionPolicy {
  if (options.platform === 'web') {
    return { encrypted: false, unencryptedDevBuild: false };
  }

  // Expo Go ships plain SQLite, so a development run there must use it. It is
  // never a production environment, and its sandbox is separate from the
  // installed app, so no plaintext data can carry over to an encrypted build.
  const expoGoDevRun = options.isDev && options.isExpoGo === true;
  const optedOut = options.isDev && options.allowUnencrypted === '1';
  const unencryptedDevBuild = expoGoDevRun || optedOut;

  return { encrypted: !unencryptedDevBuild, unencryptedDevBuild };
}

/**
 * True when this JavaScript is running inside the Expo Go client.
 *
 * `appOwnership` is the historical signal and `expoVersion` is only set by the
 * Expo Go app; a development build has neither. `expoGoConfig` is not usable
 * here because it falls back to the embedded manifest in a standalone or
 * development build as well.
 */
export const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.expoVersion != null;

const policy = encryptionPolicy({
  platform: Platform.OS,
  isDev: __DEV__,
  allowUnencrypted: process.env.EXPO_PUBLIC_ALLOW_UNENCRYPTED_DATABASE,
  isExpoGo,
});

/** True when the database must be encrypted, and SQLCipher must be present. */
export const supportsEncryption = policy.encrypted;

/** True when this is a native development run that uses plain SQLite. */
export const isUnencryptedDevBuild = policy.unencryptedDevBuild;

/** True when the app is running in a browser. */
export const isWebPreview = Platform.OS === 'web';
