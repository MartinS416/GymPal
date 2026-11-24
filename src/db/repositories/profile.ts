import type { SQLiteDatabase } from 'expo-sqlite';

import { runInTransaction } from '@/db/transaction';
import type { MeasurementSystem } from '@/lib/units';

/**
 * The row shape stored in the `profile` table.
 *
 * The table holds a single row (id = 1) because GymPal supports exactly one
 * local profile.
 */
export type ProfileRow = {
  id: number;
  name: string;
  height_cm: number;
  weight_kg: number;
  measurement_system: MeasurementSystem;
  created_at: number;
  updated_at: number;
};

/** The profile the app works with. */
export type StoredProfile = {
  name: string;
  heightCm: number;
  weightKg: number;
  system: MeasurementSystem;
};

function toStoredProfile(row: ProfileRow): StoredProfile {
  return {
    name: row.name,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    system: row.measurement_system,
  };
}

/** Reads the profile, or `null` when onboarding has not been completed. */
export async function getProfile(db: SQLiteDatabase): Promise<StoredProfile | null> {
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM profile WHERE id = 1');
  return row ? toStoredProfile(row) : null;
}

/**
 * Writes the profile, creating it the first time and updating it afterwards.
 */
export async function saveProfile(
  db: SQLiteDatabase,
  profile: StoredProfile
): Promise<StoredProfile> {
  const now = Date.now();

  await runInTransaction(db, async (txn) => {
    const existing = await txn.getFirstAsync<{ id: number }>(
      'SELECT id FROM profile WHERE id = 1'
    );

    if (existing) {
      await txn.runAsync(
        `UPDATE profile
            SET name = ?,
                height_cm = ?,
                weight_kg = ?,
                measurement_system = ?,
                updated_at = ?
          WHERE id = 1`,
        profile.name,
        profile.heightCm,
        profile.weightKg,
        profile.system,
        now
      );
      return;
    }

    await txn.runAsync(
      `INSERT INTO profile (id, name, height_cm, weight_kg, measurement_system, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      profile.name,
      profile.heightCm,
      profile.weightKg,
      profile.system,
      now,
      now
    );
  });

  return profile;
}

/** Removes the profile row, leaving the rest of the database intact. */
export async function clearProfile(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM profile WHERE id = 1');
}
