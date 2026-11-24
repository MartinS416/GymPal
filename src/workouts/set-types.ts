/** Optional prescription attached to an exercise in a saved workout. */
export type SetStyle = 'straight' | 'amrap' | 'drop';

export type WarmupPrescription = {
  weightKg: number | null;
  reps: number | null;
};

export type DropStepPrescription = {
  weightKg: number | null;
  reps: number | null;
};

export type WorkSetPrescription = {
  style: SetStyle;
  /** Optional minimum reps shown as guidance for AMRAP sets. */
  minReps: number | null;
  dropSteps: DropStepPrescription[];
};

export type ExerciseSetConfiguration = {
  warmups: WarmupPrescription[];
  workSets: WorkSetPrescription[];
};

export const DEFAULT_SET_CONFIGURATION: ExerciseSetConfiguration = {
  warmups: [],
  workSets: [],
};

export function defaultWorkSet(): WorkSetPrescription {
  return { style: 'straight', minReps: null, dropSteps: [] };
}

export function normalizeSetConfiguration(
  value: ExerciseSetConfiguration | string | null | undefined,
  targetSets: number
): ExerciseSetConfiguration {
  let parsed: Partial<ExerciseSetConfiguration> = {};
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as Partial<ExerciseSetConfiguration>;
    } catch {
      parsed = {};
    }
  } else if (value) {
    parsed = value;
  }

  const warmups = Array.isArray(parsed.warmups)
    ? parsed.warmups.map((item) => ({
        weightKg: finiteOrNull(item?.weightKg),
        reps: integerOrNull(item?.reps),
      }))
    : [];
  const existing = Array.isArray(parsed.workSets) ? parsed.workSets : [];
  const workSets = Array.from({ length: Math.max(0, targetSets) }, (_, index) => {
    const item = existing[index];
    if (!item || (item.style !== 'amrap' && item.style !== 'drop')) {
      return defaultWorkSet();
    }
    const dropSteps = item.style === 'drop' && Array.isArray(item.dropSteps)
      ? item.dropSteps.map((step) => ({
          weightKg: finiteOrNull(step?.weightKg),
          reps: integerOrNull(step?.reps),
        }))
      : [];
    return {
      style: item.style,
      minReps: integerOrNull(item.minReps),
      dropSteps: item.style === 'drop'
        ? dropSteps.length > 0 ? dropSteps : [{ weightKg: null, reps: null }]
        : [],
    } satisfies WorkSetPrescription;
  });
  return { warmups, workSets };
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}
