import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { DatabaseErrorScreen } from '@/components/database-error-screen';
import { LoadingScreen } from '@/components/loading-screen';
import {
  DatabaseError,
  deleteLocalData,
  GymPalDatabase,
  isDatabaseError,
  openEncryptedDatabase,
  type OpenDatabaseResult,
} from '@/db';

export type DatabaseStatus = 'loading' | 'ready' | 'error';

export type DatabaseContextValue = {
  status: DatabaseStatus;
  /** The open database, or `null` while loading or after a failure. */
  database: GymPalDatabase | null;
  error: DatabaseError | null;
  /** Closes and reopens the database. */
  retry: () => void;
  /**
   * Deletes the database file and the encryption key, then starts again with
   * an empty database.
   */
  deleteAllData: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

/**
 * Owns the lifecycle of the encrypted database.
 *
 * The app never renders until the database has been opened, unlocked and
 * migrated. If that fails, the user is told what happened and offered a way
 * out — the app never quietly starts again with an empty database.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DatabaseStatus>('loading');
  const [database, setDatabase] = useState<GymPalDatabase | null>(null);
  const [error, setError] = useState<DatabaseError | null>(null);

  const databaseRef = useRef<GymPalDatabase | null>(null);
  const pathRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const handleOpened = useCallback((result: OpenDatabaseResult) => {
    if (!mountedRef.current) {
      void result.db.closeAsync();
      return;
    }
    const gympal = new GymPalDatabase(result.db);
    databaseRef.current = gympal;
    pathRef.current = result.db.databasePath;
    setDatabase(gympal);
    setStatus('ready');
  }, []);

  const handleFailure = useCallback((caught: unknown) => {
    if (!mountedRef.current) {
      return;
    }
    setDatabase(null);
    setError(
      isDatabaseError(caught)
        ? caught
        : new DatabaseError(
            'OPEN_FAILED',
            'Could not open the database',
            'GymPal could not open its local database on this device.'
          )
    );
    setStatus('error');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    openEncryptedDatabase().then(handleOpened, handleFailure);

    return () => {
      mountedRef.current = false;
      const current = databaseRef.current;
      databaseRef.current = null;
      if (current) {
        void current.close();
      }
    };
  }, [handleOpened, handleFailure]);

  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    openEncryptedDatabase().then(handleOpened, handleFailure);
  }, [handleOpened, handleFailure]);

  const deleteAllData = useCallback(async () => {
    // The connection is closed before the file is removed: deleting a file
    // that is still open is not safe. The context keeps the old instance
    // until the new one is ready, so nothing renders against a closed
    // connection.
    const current = databaseRef.current;
    databaseRef.current = null;
    if (current) {
      await current.close();
    }

    await deleteLocalData(pathRef.current ?? undefined);
    pathRef.current = null;

    openEncryptedDatabase().then(handleOpened, handleFailure);
  }, [handleOpened, handleFailure]);

  const value = useMemo<DatabaseContextValue>(
    () => ({ status, database, error, retry, deleteAllData }),
    [status, database, error, retry, deleteAllData]
  );

  if (status === 'loading') {
    return <LoadingScreen label="Opening your local database" />;
  }

  if (status === 'error') {
    return (
      <DatabaseErrorScreen
        error={error}
        onRetry={retry}
        onDeleteAllData={deleteAllData}
      />
    );
  }

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

/** The open database. Only safe to call inside the provider. */
export function useDatabase(): GymPalDatabase {
  const context = useContext(DatabaseContext);
  if (!context?.database) {
    throw new Error('useDatabase must be used inside a <DatabaseProvider>.');
  }
  return context.database;
}

/** The full database state, including errors and recovery actions. */
export function useDatabaseState(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabaseState must be used inside a <DatabaseProvider>.');
  }
  return context;
}
