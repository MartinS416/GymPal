import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data from the database.
 *
 * The loader is expected to be memoised by the caller (with `useCallback`), so
 * this hook only reloads when the data it depends on actually changes.
 */
export function useAsyncData<T>(loader: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loader().then(
      (result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [loader, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, reload };
}
