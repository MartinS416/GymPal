/**
 * Migration 3 — the exercise library.
 *
 * A starting set of exercises so a plan can be built without typing every
 * movement in. The library is local: it lives in the same encrypted database
 * as everything else, and users can add their own exercises to it.
 */
export const up = `
INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, instructions, created_at, updated_at) VALUES
  ('Back Squat',           'Quads',      'Barbell',   'Bar on the back, sit down, drive up through the whole foot.', 0, 0),
  ('Deadlift',             'Posterior',  'Barbell',   'Bar on the floor, push the floor away, keep the bar close.', 0, 0),
  ('Front Squat',          'Quads',      'Barbell',   'Elbows forward, sit tall, keep the chest up.', 0, 0),
  ('Leg Press',            'Quads',      'Machine',   'Feet flat on the plate, lower under control.', 0, 0),
  ('Romanian Deadlift',    'Hamstrings', 'Barbell',   'Hinge at the hips with a soft knee, keep the bar close.', 0, 0),
  ('Lying Leg Curl',       'Hamstrings', 'Machine',   'Curl the pad towards the glutes, do not lift the hips.', 0, 0),
  ('Walking Lunge',        'Quads',      'Dumbbell',  'Long stride, lower the back knee, push through the front foot.', 0, 0),
  ('Leg Press Calf Raise', 'Calves',     'Machine',   'Pause at the stretch, then press through the toes.', 0, 0),
  ('Hip Thrust',           'Glutes',     'Barbell',   'Chin tucked, drive the hips up and squeeze at the top.', 0, 0),
  ('Goblet Squat',         'Quads',      'Dumbbell',  'Hold the weight at the chest, sit between the hips.', 0, 0),
  ('Bench Press',          'Chest',      'Barbell',   'Feet planted, bar to the lower chest, press up and slightly in.', 0, 0),
  ('Incline Bench Press',  'Chest',      'Barbell',   'Set the bench up, press from the upper chest.', 0, 0),
  ('Dumbbell Bench Press', 'Chest',      'Dumbbell',  'Elbows under the wrists, lower the dumbbells to the chest.', 0, 0),
  ('Push-Up',              'Chest',      'Bodyweight','One push-up per rep, body in a straight line.', 0, 0),
  ('Cable Fly',            'Chest',      'Cable',     'Soft elbows, bring the handles together in an arc.', 0, 0),
  ('Overhead Press',       'Shoulders',  'Barbell',   'Squeeze the glutes, press the bar straight up.', 0, 0),
  ('Seated Dumbbell Press','Shoulders',  'Dumbbell',  'Back against the pad, press overhead without leaning back.', 0, 0),
  ('Lateral Raise',        'Shoulders',  'Dumbbell',  'Lead with the elbows, stop at shoulder height.', 0, 0),
  ('Face Pull',            'Rear Delts', 'Cable',     'Pull towards the forehead, rotate the hands apart.', 0, 0),
  ('Upright Row',          'Rear Delts', 'Cable',     'Elbows high, pull to the chest.', 0, 0),
  ('Pull-Up',              'Back',       'Bodyweight','Start from a dead hang, pull the chin over the bar.', 0, 0),
  ('Lat Pulldown',         'Back',       'Cable',     'Pull to the collar bone, let the lats do the work.', 0, 0),
  ('Barbell Row',          'Back',       'Barbell',   'Hinge, keep the back flat, row to the hips.', 0, 0),
  ('Dumbbell Row',         'Back',       'Dumbbell',  'Brace the core, pull the elbows past the ribs.', 0, 0),
  ('Seated Cable Row',     'Back',       'Cable',     'Sit tall, pull the handle to the stomach.', 0, 0),
  ('Straight-Arm Pulldown','Lats',       'Cable',     'Straight arms, pull down to the thighs.', 0, 0),
  ('Barbell Curl',         'Biceps',     'Barbell',   'Elbows pinned, curl without swinging.', 0, 0),
  ('Dumbbell Hammer Curl', 'Biceps',     'Dumbbell',  'Neutral grip, curl the way the thumb points.', 0, 0),
  ('Preacher Curl',        'Biceps',     'Machine',   'Arms on the pad, curl the range of motion.', 0, 0),
  ('Triceps Pushdown',     'Triceps',    'Cable',     'Elbows in, extend to a straight arm.', 0, 0),
  ('Skull Crusher',        'Triceps',    'Dumbbell',  'Keep the upper arms still, bend and extend at the elbow.', 0, 0),
  ('Close-Grip Bench Press','Triceps',    'Barbell',   'Hands shoulder width, elbows close to the body.', 0, 0),
  ('Plank',                'Core',       'Bodyweight','Squeeze the glutes, ribs down, hold the line.', 0, 0),
  ('Hanging Leg Raise',    'Core',       'Bodyweight','Hang, raise the legs without swinging.', 0, 0),
  ('Cable Crunch',         'Core',       'Cable',     'Kneel, pull the cable down to the chest.', 0, 0),
  ('Dumbbell Shrug',       'Traps',      'Dumbbell',  'Shoulders up, neck straight.', 0, 0),
  ('Dip',                  'Chest',      'Bodyweight','Lower between the bars, keep the elbows back.', 0, 0);
`;
