/**
 * Type declarations for the matchers added by `expo-router/testing-library`.
 *
 * React Native Testing Library builds its `expect` on top of `@jest/expect`,
 * so both matcher interfaces have to be extended.
 */
declare global {
  namespace jest {
    interface Matchers<R, T = {}> {
      toHavePathname(expected: string): R;
      toHavePathnameWithParams(expected: string): R;
      toHaveSegments(expected: string[]): R;
      toHaveSearchParams(expected: Record<string, string>): R;
      toHaveRouterState(expected: unknown): R;
    }
  }
}

declare module '@jest/expect' {
  interface Matchers<R extends void | Promise<void>> {
    toHavePathname(expected: string): R;
    toHavePathnameWithParams(expected: string): R;
    toHaveSegments(expected: string[]): R;
    toHaveSearchParams(expected: Record<string, string>): R;
    toHaveRouterState(expected: unknown): R;
  }
}

export {};
