/**
 * The sections of the product.
 *
 * Stage 1 ships the structure only: each section has a title, an empty state
 * and a destination, so the navigation model is settled before the workout
 * features are built.
 */

export type SectionKey = 'today' | 'plan' | 'history' | 'progress';

export type SectionMeta = {
  key: SectionKey;
  title: string;
  /** One line that sets expectations under the title. */
  summary: string;
  /** Empty state rendered on the card. */
  emptyTitle: string;
  emptyDescription: string;
  /** Longer copy for the placeholder screen. */
  detail: string;
};

export const SECTIONS: Record<SectionKey, SectionMeta> = {
  today: {
    key: 'today',
    title: "Today's workout",
    summary: 'Your session for the day',
    emptyTitle: 'Nothing scheduled today',
    emptyDescription: 'Pick a plan and it will show up here on the day.',
    detail:
      'Your daily session will appear here, with the exercises, sets and rest timers you need to complete the plan.',
  },
  plan: {
    key: 'plan',
    title: 'Create a workout plan',
    summary: 'Build a routine that repeats',
    emptyTitle: 'No plans yet',
    emptyDescription: 'Start with a split, then adjust it to fit your week.',
    detail:
      'Plans are a repeatable sequence of workouts. Build one from scratch or start from a template, then tailor the exercises, sets and progression to your goals.',
  },
  history: {
    key: 'history',
    title: 'Workout history',
    summary: 'Everything you have completed',
    emptyTitle: 'No workouts logged',
    emptyDescription: 'Completed sessions are kept here so you can look back.',
    detail:
      'Every completed session is recorded with its exercises, load, volume and duration, so you can review how your training has developed over time.',
  },
  progress: {
    key: 'progress',
    title: 'Progress',
    summary: 'Strength and volume over time',
    emptyTitle: 'No progress yet',
    emptyDescription: 'Log a few sessions to see trends in strength and volume.',
    detail:
      'Progress tracks the numbers that matter — estimated strength, training volume and consistency — derived from the sessions you complete.',
  },
};
