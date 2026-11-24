import { Platform } from 'react-native';

/**
 * Platform capabilities the data layer depends on.
 *
 * The device builds (iOS and Android) have a secure keystore and SQLCipher,
 * so the database is encrypted. The browser has neither, so the web build
 * stores the same schema in the browser's own storage **without** encryption.
 * The web build is a development and preview target; the app says so in the
 * interface rather than pretending otherwise.
 */

/** What this run must do about encryption, and why. */
export type EncryptionPolicy = {
  /** True when the database has to be protected by SQLCipher. */
  encrypted: boolean;
  /**
   * True when a native development run deliberately uses plain SQLite.
   * Only possible in a development bundle with the escape hatch below.
   */
  unencryptedDevBuild: boolean;
};

/** The environment variable that opens the Expo Go escape hatch. */
export const ALLOW_UNENCRYPTED_ENV = 'EXPO_PUBLIC_ALLOW_UNENCRYPTED_DATABASE';

/**
 * Decides whether this run has to encrypt its database.
 *
 * The web build never can, so it never has to. A native build always has to,
 * except when a developer explicitly asks for the Expo Go escape hatch — Expo
 * Go ships plain SQLite and cannot be rebuilt. The escape hatch is ignored
 * unless the bundle is a development bundle, so a shipped app can never fall
 * back to plaintext.
 */
export function encryptionPolicy(options: {
  platform: string;
  isDev: boolean;
  allowUnencrypted: string | undefined;
}): EncryptionPolicy {
  if (options.platform === 'web') {
    return { encrypted: false, unencryptedDevBuild: false };
  }

  const unencryptedDevBuild = options.isDev && options.allowUnencrypted === '1';

  return { encrypted: !unencryptedDevBuild, unencryptedDevBuild };
}

const policy = encryptionPolicy({
  platform: Platform.OS,
  isDev: __DEV__,
  allowUnencrypted: process.env.EXPO_PUBLIC_ALLOW_UNENCRYPTED_DATABASE,
});

/** True when the database must be encrypted, and SQLCipher must be present. */
export const supportsEncryption = policy.encrypted;

/** True when this is a native development run that chose plain SQLite. */
export const isUnencryptedDevBuild = policy.unencryptedDevBuild;

/** True when the app is running in a browser. */
export const isWebPreview = Platform.OS === 'web';
