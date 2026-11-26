/**
 * Exercise muscles.
 *
 * The exercise library stores one broad muscle group per exercise. The body
 * map needs a little more: which regions an exercise drives, and whether each
 * one is a primary mover or a supporting muscle. The mapping is kept here, in
 * one place, so the feed, the workout overview and the finished-session screen
 * all describe an exercise the same way.
 */

export type MuscleRole = 'primary' | 'secondary';

export type MuscleRegion =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'calves'
  | 'traps'
  | 'lats'
  | 'upperBack'
  | 'rearDelts'
  | 'triceps'
  | 'lowerBack'
  | 'glutes'
  | 'hamstrings';

export type Muscle = {
  region: MuscleRegion;
  label: string;
  role: MuscleRole;
};

const LABELS: Record<MuscleRegion, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  forearms: 'Forearms',
  abs: 'Core',
  quads: 'Quads',
  calves: 'Calves',
  traps: 'Traps',
  lats: 'Lats',
  upperBack: 'Upper back',
  rearDelts: 'Rear delts',
  triceps: 'Triceps',
  lowerBack: 'Lower back',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
};

const ORDER: MuscleRegion[] = [
  'chest',
  'shoulders',
  'biceps',
  'forearms',
  'abs',
  'quads',
  'calves',
  'traps',
  'lats',
  'upperBack',
  'rearDelts',
  'triceps',
  'lowerBack',
  'glutes',
  'hamstrings',
];

type Activation = readonly [MuscleRegion, MuscleRole];

function primary(...regions: MuscleRegion[]): Activation[] {
  return regions.map((region) => [region, 'primary'] as const);
}

function secondary(...regions: MuscleRegion[]): Activation[] {
  return regions.map((region) => [region, 'secondary'] as const);
}

/**
 * The exercises in the built-in library, by name.
 *
 * The first region of each movement is its main driver; the rest support it.
 */
const EXERCISE_MUSCLES: Record<string, Activation[]> = {
  'back squat': [
    ...primary('quads'),
    ...secondary('glutes', 'hamstrings', 'abs'),
  ],
  deadlift: [
    ...primary('hamstrings', 'glutes', 'lowerBack'),
    ...secondary('traps', 'lats', 'forearms'),
  ],
  'front squat': [...primary('quads'), ...secondary('glutes', 'abs')],
  'leg press': [...primary('quads'), ...secondary('glutes', 'hamstrings')],
  'romanian deadlift': [
    ...primary('hamstrings', 'glutes'),
    ...secondary('lowerBack', 'forearms'),
  ],
  'lying leg curl': [...primary('hamstrings'), ...secondary('calves')],
  'walking lunge': [
    ...primary('quads', 'glutes'),
    ...secondary('hamstrings', 'calves'),
  ],
  'leg press calf raise': primary('calves'),
  'hip thrust': [...primary('glutes'), ...secondary('hamstrings', 'abs')],
  'goblet squat': [...primary('quads'), ...secondary('glutes', 'abs')],
  'bench press': [...primary('chest'), ...secondary('triceps', 'shoulders')],
  'incline bench press': [
    ...primary('chest'),
    ...secondary('shoulders', 'triceps'),
  ],
  'dumbbell bench press': [
    ...primary('chest'),
    ...secondary('triceps', 'shoulders'),
  ],
  'push-up': [
    ...primary('chest'),
    ...secondary('triceps', 'shoulders', 'abs'),
  ],
  'cable fly': [...primary('chest'), ...secondary('shoulders')],
  'overhead press': [
    ...primary('shoulders'),
    ...secondary('triceps', 'abs', 'traps'),
  ],
  'seated dumbbell press': [...primary('shoulders'), ...secondary('triceps')],
  'lateral raise': [...primary('shoulders'), ...secondary('traps')],
  'face pull': [
    ...primary('rearDelts'),
    ...secondary('upperBack', 'traps'),
  ],
  'upright row': [
    ...primary('traps'),
    ...secondary('shoulders', 'biceps'),
  ],
  'pull-up': [
    ...primary('lats'),
    ...secondary('upperBack', 'biceps', 'forearms', 'abs'),
  ],
  'lat pulldown': [
    ...primary('lats'),
    ...secondary('upperBack', 'biceps'),
  ],
  'barbell row': [
    ...primary('upperBack', 'lats'),
    ...secondary('biceps', 'rearDelts', 'lowerBack'),
  ],
  'dumbbell row': [
    ...primary('lats', 'upperBack'),
    ...secondary('biceps', 'rearDelts'),
  ],
  'seated cable row': [
    ...primary('upperBack'),
    ...secondary('lats', 'biceps', 'rearDelts'),
  ],
  'straight-arm pulldown': [
    ...primary('lats'),
    ...secondary('triceps', 'abs'),
  ],
  'barbell curl': [...primary('biceps'), ...secondary('forearms')],
  'dumbbell hammer curl': [...primary('biceps'), ...secondary('forearms')],
  'preacher curl': [...primary('biceps'), ...secondary('forearms')],
  'triceps pushdown': [...primary('triceps'), ...secondary('forearms')],
  'skull crusher': [...primary('triceps'), ...secondary('forearms')],
  'close-grip bench press': [
    ...primary('triceps'),
    ...secondary('chest', 'shoulders'),
  ],
  plank: [
    ...primary('abs'),
    ...secondary('lowerBack', 'glutes', 'shoulders'),
  ],
  'hanging leg raise': [
    ...primary('abs'),
    ...secondary('forearms', 'lats'),
  ],
  'cable crunch': primary('abs'),
  'dumbbell shrug': [...primary('traps'), ...secondary('forearms')],
  dip: [...primary('chest', 'triceps'), ...secondary('shoulders')],
};

/** Fallback for exercises the user has written themselves. */
const GROUP_MUSCLES: Record<string, Activation[]> = {
  chest: [...primary('chest'), ...secondary('triceps', 'shoulders')],
  back: [
    ...primary('lats', 'upperBack'),
    ...secondary('biceps', 'rearDelts'),
  ],
  lats: [...primary('lats'), ...secondary('biceps', 'upperBack')],
  shoulders: [
    ...primary('shoulders'),
    ...secondary('triceps', 'traps'),
  ],
  'rear delts': [
    ...primary('rearDelts'),
    ...secondary('upperBack', 'traps'),
  ],
  biceps: [...primary('biceps'), ...secondary('forearms')],
  triceps: [...primary('triceps'), ...secondary('forearms')],
  quads: [...primary('quads'), ...secondary('glutes', 'calves')],
  hamstrings: [...primary('hamstrings'), ...secondary('glutes', 'calves')],
  glutes: [...primary('glutes'), ...secondary('hamstrings', 'lowerBack')],
  calves: primary('calves'),
  core: [...primary('abs'), ...secondary('lowerBack')],
  traps: [...primary('traps'), ...secondary('shoulders')],
  posterior: [
    ...primary('hamstrings', 'glutes'),
    ...secondary('lowerBack', 'traps'),
  ],
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The muscles an exercise works.
 *
 * A region is only listed once. If a movement lists it as primary and
 * secondary, primary wins.
 */
export function musclesForExercise(name: string, muscleGroup: string): Muscle[] {
  const activations =
    EXERCISE_MUSCLES[normalize(name)] ?? GROUP_MUSCLES[normalize(muscleGroup)] ?? [];
  const roles = new Map<MuscleRegion, MuscleRole>();

  for (const [region, role] of activations) {
    if (roles.get(region) === 'primary') continue;
    roles.set(region, role);
  }

  return [...roles.entries()]
    .map(([region, role]) => ({ region, label: LABELS[region], role }))
    .sort(compareMuscles);
}

/** Primary regions first, then supporting muscles, each in body order. */
function compareMuscles(a: Muscle, b: Muscle): number {
  if (a.role !== b.role) {
    return a.role === 'primary' ? -1 : 1;
  }
  return ORDER.indexOf(a.region) - ORDER.indexOf(b.region);
}

/** The combined map of a whole workout: a primary region stays primary. */
export function musclesForWorkout(
  exercises: { name: string; muscleGroup: string }[]
): Muscle[] {
  const roles = new Map<MuscleRegion, MuscleRole>();

  for (const exercise of exercises) {
    for (const muscle of musclesForExercise(exercise.name, exercise.muscleGroup)) {
      if (roles.get(muscle.region) === 'primary') continue;
      roles.set(muscle.region, muscle.role);
    }
  }

  return [...roles.entries()]
    .map(([region, role]) => ({ region, label: LABELS[region], role }))
    .sort(compareMuscles);
}

/** "Chest · Triceps · Shoulders" */
export function muscleSummary(
  exercise: { name: string; muscleGroup: string }
): string {
  return musclesForExercise(exercise.name, exercise.muscleGroup)
    .map((muscle) => muscle.label)
    .join(' · ');
}
