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
