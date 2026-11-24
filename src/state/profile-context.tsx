import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useDatabase } from '@/db/database-provider';
import type { Profile } from '@/lib/profile';

export type ProfileStatus = 'loading' | 'ready';

export type ProfileContextValue = {
  status: ProfileStatus;
  /** `null` until onboarding has been completed. */
  profile: Profile | null;
  /** Writes the profile to the encrypted database and updates the state. */
  saveProfile: (profile: Profile) => Promise<void>;
  /** Removes the stored profile, returning the app to onboarding. */
  clearProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * The user's profile.
 *
 * Stage 2 keeps the profile in the encrypted local database, so it survives
 * restarts. The context is a thin cache in front of the data access layer —
 * the database stays the source of truth.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const database = useDatabase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const stored = await database.getProfile();
      if (cancelled) {
        return;
      }
      setProfile(stored);
      setStatus('ready');
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [database]);

  const saveProfile = useCallback(
    async (next: Profile) => {
      await database.saveProfile(next);
      setProfile(next);
    },
    [database]
  );

  const clearProfile = useCallback(async () => {
    await database.clearProfile();
    setProfile(null);
  }, [database]);

  const value = useMemo<ProfileContextValue>(
    () => ({ status, profile, saveProfile, clearProfile }),
    [status, profile, saveProfile, clearProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a <ProfileProvider>.');
  }
  return context;
}
