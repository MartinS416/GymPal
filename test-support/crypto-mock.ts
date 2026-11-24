/**
 * A stand-in for `expo-crypto`.
 *
 * The real module uses the platform CSPRNG. The mock produces deterministic
 * but distinct bytes so tests can assert that keys are unique, and it never
 * returns the same buffer twice.
 */

let counter = 0;

/** Resets the generator so each test starts from a known state. */
export function resetCryptoMock(): void {
  counter = 0;
}

export function getRandomBytes(byteCount: number): Uint8Array {
  const bytes = new Uint8Array(byteCount);
  for (let index = 0; index < byteCount; index += 1) {
    counter += 1;
    // A simple xorshift keeps the bytes varied without pulling in a PRNG.
    counter ^= counter << 13;
    counter ^= counter >>> 17;
    counter ^= counter << 5;
    counter >>>= 0;
    bytes[index] = counter & 0xff;
  }
  return bytes;
}

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return getRandomBytes(byteCount);
}

export function getRandomValues<T extends { length: number; set: (values: never) => void }>(
  typedArray: T
): T {
  const bytes = getRandomBytes(typedArray.length);
  typedArray.set(bytes as never);
  return typedArray;
}

export function randomUUID(): string {
  const bytes = getRandomBytes(16);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}
