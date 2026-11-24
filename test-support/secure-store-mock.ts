/**
 * A stand-in for `expo-secure-store` backed by an in-memory map.
 *
 * It behaves like the real keychain for the cases the app relies on: values
 * are stored under a key plus a service, and a missing entry reads as `null`.
 */

const store = new Map<string, string>();

function storageKey(key: string, service?: string): string {
  return service ? `${service}::${key}` : key;
}

export const WHEN_UNLOCKED = 'whenUnlocked';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'whenUnlockedThisDeviceOnly';
export const AFTER_FIRST_UNLOCK = 'afterFirstUnlock';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'afterFirstUnlockThisDeviceOnly';
export const ALWAYS = 'always';
export const ALWAYS_THIS_DEVICE_ONLY = 'alwaysThisDeviceOnly';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'whenPasscodeSetThisDeviceOnly';

export type SecureStoreOptions = {
  keychainAccessible?: string;
  keychainService?: string;
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
  accessGroup?: string;
  requireConfirmation?: boolean;
};

/** Empties the fake keychain. */
export function resetSecureStoreMock(): void {
  store.clear();
}

/** The raw contents of the fake keychain, for assertions. */
export function secureStoreMockEntries(): Record<string, string> {
  return Object.fromEntries(store.entries());
}

export async function getItemAsync(
  key: string,
  options?: SecureStoreOptions
): Promise<string | null> {
  return store.get(storageKey(key, options?.keychainService)) ?? null;
}

export function getItem(key: string, options?: SecureStoreOptions): string | null {
  return store.get(storageKey(key, options?.keychainService)) ?? null;
}

export async function setItemAsync(
  key: string,
  value: string,
  options?: SecureStoreOptions
): Promise<void> {
  store.set(storageKey(key, options?.keychainService), value);
}

export function setItem(
  key: string,
  value: string,
  options?: SecureStoreOptions
): void {
  store.set(storageKey(key, options?.keychainService), value);
}

export async function deleteItemAsync(
  key: string,
  options?: SecureStoreOptions
): Promise<void> {
  store.delete(storageKey(key, options?.keychainService));
}

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function canUseBiometricAuthentication(): Promise<boolean> {
  return false;
}
