import { describe, expect, it } from '@jest/globals';

import { encryptionPolicy } from '@/db/platform';

describe('encryption policy', () => {
  it('encrypts a native build', () => {
    expect(
      encryptionPolicy({ platform: 'ios', isDev: false, allowUnencrypted: undefined })
    ).toEqual({ encrypted: true, unencryptedDevBuild: false });
  });

  it('ignores the escape hatch in a release bundle', () => {
    expect(
      encryptionPolicy({ platform: 'ios', isDev: false, allowUnencrypted: '1' })
    ).toEqual({ encrypted: true, unencryptedDevBuild: false });
  });

  it('allows plain SQLite in a development bundle when asked', () => {
    expect(
      encryptionPolicy({ platform: 'ios', isDev: true, allowUnencrypted: '1' })
    ).toEqual({ encrypted: false, unencryptedDevBuild: true });
  });

  it('only accepts the exact value', () => {
    for (const value of ['true', 'yes', '0', '', ' 1']) {
      expect(
        encryptionPolicy({ platform: 'android', isDev: true, allowUnencrypted: value }).encrypted
      ).toBe(true);
    }
  });

  it('uses plain SQLite automatically in Expo Go development', () => {
    // Expo Go ships plain SQLite and cannot be rebuilt, so refusing to start
    // would make the app impossible to preview. The sandbox is separate from
    // an installed build, so nothing unencrypted carries over.
    expect(
      encryptionPolicy({
        platform: 'ios',
        isDev: true,
        allowUnencrypted: undefined,
        isExpoGo: true,
      })
    ).toEqual({ encrypted: false, unencryptedDevBuild: true });

    expect(
      encryptionPolicy({
        platform: 'android',
        isDev: true,
        allowUnencrypted: undefined,
        isExpoGo: true,
      })
    ).toEqual({ encrypted: false, unencryptedDevBuild: true });
  });

  it('still refuses plaintext in a development build that is not Expo Go', () => {
    // A development build can include SQLCipher, so a binary without it is a
    // stale build and must be rebuilt rather than silently downgraded.
    expect(
      encryptionPolicy({
        platform: 'ios',
        isDev: true,
        allowUnencrypted: undefined,
        isExpoGo: false,
      })
    ).toEqual({ encrypted: true, unencryptedDevBuild: false });
  });

  it('ignores Expo Go in a release bundle', () => {
    expect(
      encryptionPolicy({
        platform: 'ios',
        isDev: false,
        allowUnencrypted: undefined,
        isExpoGo: true,
      })
    ).toEqual({ encrypted: true, unencryptedDevBuild: false });
  });

  it('never asks the browser preview to encrypt', () => {
    expect(
      encryptionPolicy({ platform: 'web', isDev: true, allowUnencrypted: undefined })
    ).toEqual({ encrypted: false, unencryptedDevBuild: false });

    // The escape hatch is about Expo Go, not about the browser.
    expect(
      encryptionPolicy({ platform: 'web', isDev: true, allowUnencrypted: '1' })
    ).toEqual({ encrypted: false, unencryptedDevBuild: false });
  });
});
