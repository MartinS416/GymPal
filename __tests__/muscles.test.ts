import { describe, expect, it } from '@jest/globals';

import {
  muscleSummary,
  musclesForExercise,
  musclesForWorkout,
} from '@/workouts/muscles';

describe('exercise muscles', () => {
  it('maps a library exercise to primary and supporting regions', () => {
    const muscles = musclesForExercise('Bench Press', 'Chest');

    expect(muscles.filter((muscle) => muscle.role === 'primary').map((m) => m.region)).toEqual([
      'chest',
    ]);
    expect(muscles.filter((muscle) => muscle.role === 'secondary').map((m) => m.region)).toEqual([
      'shoulders',
      'triceps',
    ]);
  });

  it('falls back to the broad muscle group for custom exercises', () => {
    const muscles = musclesForExercise('Zercher Squat', 'Quads');

    expect(muscles[0]).toMatchObject({ region: 'quads', role: 'primary' });
    expect(muscles.some((muscle) => muscle.region === 'glutes')).toBe(true);
  });

  it('promotes a region when any exercise drives it directly', () => {
    const muscles = musclesForWorkout([
      { name: 'Bench Press', muscleGroup: 'Chest' },
      { name: 'Triceps Pushdown', muscleGroup: 'Triceps' },
    ]);
    const triceps = muscles.find((muscle) => muscle.region === 'triceps');

    expect(triceps?.role).toBe('primary');
  });

  it('returns an empty list when nothing is known', () => {
    expect(musclesForExercise('Mystery Movement', 'Other')).toEqual([]);
  });

  it('summarises the muscles with primary regions first', () => {
    expect(muscleSummary({ name: 'Bench Press', muscleGroup: 'Chest' })).toBe(
      'Chest · Shoulders · Triceps'
    );
  });
});
