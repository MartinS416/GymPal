import { useCallback, useEffect, useRef, useState } from 'react';

import { useDatabase } from '@/db/database-provider';
import type { SessionDetail } from '@/db/repositories/sessions';

/** How many completed workouts the first page (and each later page) holds. */
export const WORKOUT_FEED_PAGE_SIZE = 10;

type FeedMode = 'more' | 'refresh';

/**
 * The home workout feed.
 *
 * The first page is ten finished sessions, with their exercises and sets, so
 * the feed can render a full card without another round of queries per item.
 * Later pages are fetched only when the home screen scrolls near the bottom.
 */
export function useWorkoutFeed(pageSize = WORKOUT_FEED_PAGE_SIZE) {
  const database = useDatabase();
  const [items, setItems] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const nextOffset = useRef(0);
  const busy = useRef(true);
  const mounted = useRef(true);

  const fetchPage = useCallback(
    async (offset: number, limit = pageSize) => {
      const sessions = await database.listSessions({
        status: 'completed',
        limit,
        offset,
      });
      const details = await Promise.all(
        sessions.map((session) => database.getSessionDetail(session.id))
      );
      return {
        count: sessions.length,
        items: details.filter((detail): detail is SessionDetail => detail !== null),
      };
    },
    [database, pageSize]
  );

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    busy.current = true;

    fetchPage(0).then(
      (page) => {
        if (cancelled) return;
        setItems(page.items);
        nextOffset.current = page.count;
        setHasMore(page.count === pageSize);
        setError(false);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      }
    ).finally(() => {
      busy.current = false;
    });

    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [fetchPage, pageSize]);

  const load = useCallback(
    async (mode: FeedMode) => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      if (mode === 'more') {
        setLoadingMore(true);
      }

      try {
        // Refreshing keeps every page already on screen, so returning to home
        // does not collapse a long feed back to the first ten items.
        const limit =
          mode === 'refresh' ? Math.max(pageSize, nextOffset.current) : pageSize;
        const page = await fetchPage(mode === 'more' ? nextOffset.current : 0, limit);
        if (!mounted.current) {
          return;
        }

        if (mode === 'more') {
          setItems((current) => {
            const known = new Set(current.map((item) => item.id));
            return [...current, ...page.items.filter((item) => !known.has(item.id))];
          });
        } else {
          setItems(page.items);
        }

        nextOffset.current =
          (mode === 'more' ? nextOffset.current : 0) + page.count;
        setHasMore(page.count === limit);
        setError(false);
      } catch {
        if (mounted.current) {
          setError(true);
        }
      } finally {
        busy.current = false;
        if (mounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchPage, pageSize]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || busy.current) {
      return;
    }
    void load('more');
  }, [hasMore, load]);

  /** Refreshes the first page, e.g. when home comes back into focus. */
  const reload = useCallback(() => {
    if (busy.current) {
      return;
    }
    void load('refresh');
  }, [load]);

  return { items, loading, loadingMore, hasMore, error, loadMore, reload };
}
