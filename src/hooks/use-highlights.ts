import { useCallback } from 'react';

import { useDatabase } from '@/db/database-provider';
import { useAsyncData } from '@/hooks/use-async-data';

export type Highlight =
  | {
      kind: 'pr';
      exercise: string;
      type: 'max_weight' | 'max_reps' | 'best_estimated_1rm';
      value: number;
      achievedAt: number;
    }
  | { kind: 'milestone'; label: string; value: number };

const MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
const RECENT_DAYS = 30;

/**
 * Builds the list of things worth showing the user right now: personal records
 * achieved in the last month, plus the highest workout-count milestone reached.
 *
 * Stale PRs and empty milestones are dropped so the widget never surfaces noise.
 */
export function useHighlights() {
  const database = useDatabase();
  const loader = useCallback(async (): Promise<Highlight[]> => {
    const [records, exercises, total] = await Promise.all([
      database.getPersonalRecords(),
      database.listExercises(),
      database.countCompletedSessions(),
    ]);

    const nameById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
    const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const items: Highlight[] = [];

    const recentPrs = records
      .filter((record) => record.achievedAt >= cutoff)
      .sort((a, b) => b.achievedAt - a.achievedAt)
      .slice(0, 5);

    for (const record of recentPrs) {
      const name = nameById.get(record.exerciseId);
      if (!name) continue;
      items.push({
        kind: 'pr',
        exercise: name,
        type: record.recordType,
        value: record.value,
        achievedAt: record.achievedAt,
      });
    }

    let reached: number | null = null;
    for (const milestone of MILESTONES) {
      if (total >= milestone) reached = milestone;
      else break;
    }
    if (reached !== null) {
      items.push({ kind: 'milestone', label: `${reached} workouts completed`, value: reached });
    }

    return items;
  }, [database]);

  const { data, loading } = useAsyncData(loader);
  return { highlights: data ?? [], loading };
}
