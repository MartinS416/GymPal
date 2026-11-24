# Functional requirements: flexible training sets

## Purpose

Let lifters plan and record warm-up sets, supersets, drop sets, and AMRAP sets in a clear workout flow. Keep ordinary sets as the default, and make advanced options discoverable only when a user chooses to use them.

## Product constraints

- All planning and workout logging works without an internet connection.
- No account, subscription, ads, analytics, or server dependency is introduced.
- Plans, workout sessions, and set results remain in GymPal's on-device database.
- Existing plans continue to behave as ordinary straight sets after upgrade.
- Users can skip, reorder, resume, or finish a workout without losing saved set results.
- Use native iOS conventions: clear navigation, familiar sheets, accessible controls, keyboard-appropriate fields, haptics only as optional feedback, and no gesture as the only way to perform an action.

## Terms

- **Straight set:** the current default: a set with a rep range and rest period.
- **Warm-up set:** a lower-effort preparation set associated with an exercise, before its work sets.
- **Superset:** two or more exercises linked into a group and performed in alternating rounds.
- **Drop set:** one work set followed by one or more weight reductions, with no planned rest between drops.
- **AMRAP:** a set where the user performs as many reps as they choose, then records the actual rep count.

## Functional requirements

### FR-1. Straight sets remain the simple default

1. A newly added exercise uses the existing straight-set behavior unless the user changes it.
2. The plan builder does not add advanced fields to the default collapsed exercise row.
3. An exercise's expanded editor exposes an optional **Set style** action. Its initial value is **Straight sets**.
4. Users can change a style without changing the exercise, its position, or its existing prescription.
5. Existing workout templates and saved plans migrate as straight sets with their current set count, rep range, and rest duration intact.

**Acceptance:** A user who never opens Set style sees the current plan-building and workout flow, with the same number of work and rest phases as before.

### FR-2. Warm-up sets

1. A user can add zero or more warm-up sets to an exercise independently of its planned work sets.
2. Each warm-up set can have an optional rep target and optional load. Blank load and target are valid; GymPal must not invent values.
3. Warm-ups appear before that exercise's work sets and are identified as **Warm-up** in both planning and active workout screens.
4. The active screen shows warm-up progress separately from work-set progress, for example **Warm-up 1 of 2** and then **Set 1 of 3**.
5. A warm-up is logged only when the user confirms that set. Skipping a warm-up does not mark a work set complete.
6. Warm-up results appear in the finished session detail and can be edited like other logged sets.

### FR-3. Supersets

1. A user can select two or more exercises and group them as a superset from the plan editor. Grouping is optional and does not change the exercise order outside the group.
2. The editor shows a visible group marker and round count. The user can add or remove a member, ungroup the exercises, and reorder members using accessible controls.
3. The workout alternates the grouped exercises by round: one set of A, one set of B, then the next round. It must not finish all sets of A before starting B.
4. Rest is offered at the configured group boundary, after the round, rather than between members by default. The user can still skip rest or move on using explicit controls.
5. If grouped exercises have different set counts, the editor explains the mismatch and offers a clear choice: match the round count across members or keep the remaining exercise as a regular sequence. It must not silently drop planned sets.
6. During a session, the current exercise and round are clearly identified, for example **Superset A · Round 2 of 3**. The next exercise is visible before the user advances.
7. If a user skips one member, the rest of the round remains available. A skipped member is recorded as skipped; it is not treated as a completed set.
8. Editing the superset in a saved plan does not rewrite an in-progress session. The session uses the workout structure captured when it started.

### FR-4. Drop sets

1. A user can configure one or more drops on a work set. A drop set belongs to one exercise and one planned set; it does not add a separate exercise to the plan.
2. Each drop step can have an optional planned load and optional rep target. The user can leave these blank and enter actual results during the workout.
3. The active workout labels the primary effort and each drop step in order. It presents one step at a time so the user can enter actual weight and reps without scrolling through a complex form.
4. The user confirms each step before advancing. The primary effort and every completed drop are saved immediately, so closing or backgrounding the app cannot lose earlier steps.
5. No rest timer starts between steps in the same drop set. The normal exercise rest starts after the final drop step.
6. The user can go back and correct a step without duplicating it. Skipping the remaining drops preserves the steps already logged and marks the rest as skipped.
7. Finished session detail distinguishes the primary effort from its drop steps while including all completed steps in set history and volume totals.

### FR-5. AMRAP sets

1. A user can mark a work set as **AMRAP** and optionally retain a minimum rep target as guidance.
2. The active workout labels the set **AMRAP**. It does not show an upper rep target or stop the timer based on a target.
3. The user enters the actual reps performed and confirms the set through the same save action used for ordinary sets.
4. Weight, reps, and optional RPE remain editable during rest and from the finished session summary.
5. The next planned set or rest starts only after confirmation; GymPal must not infer that an AMRAP set is complete from elapsed time.

### FR-6. Workout navigation, recovery, and persistence

1. Every phase change saves completed set data before starting the next phase.
2. Resuming an interrupted session restores the exact exercise, group round, set style, and sub-step, as well as timer timestamps.
3. Going backward never deletes a logged result. Reconfirming an edited set updates the existing result rather than creating a duplicate.
4. Reordering exercises during a live workout preserves the user's current logical set or sub-step whenever that phase still exists.
5. Removing or reducing planned work after sets have been logged requires a clear confirmation when it would discard data. The default action preserves the logged results.
6. The finished summary identifies straight, warm-up, superset, drop, and AMRAP work and allows users to inspect and edit recorded load, reps, and RPE.

### FR-7. History and progress calculations

1. Completed set records retain their set style and parent/group relationship so history can render the workout the user performed.
2. Workout set counts and volume totals include every completed warm-up and drop step, with labels that make the totals understandable.
3. Personal records use actual completed load and rep data under the existing PR rules. Planned targets never count as performed results.
4. Editing or deleting a completed result recalculates affected records and totals from the saved set history.
5. Progress charts and previous-performance displays continue to use completed results and do not treat skipped or merely planned sets as performed.

### FR-8. Native, accessible, user-first interaction

1. Advanced configuration is optional and introduced in context. The plan builder must not require users to learn all set styles during onboarding.
2. Use familiar iOS sheets for focused configuration, with a clear title, concise choices, Cancel, and Save/Done actions. Preserve the user's edits when a sheet is dismissed accidentally where practical.
3. Every swipe action has a visible tap alternative. Controls expose accessibility labels, state, and meaningful focus order.
4. Keep the primary workout action large and in a consistent location. Show the current set, next action, rest state, and any superset/drop context without requiring the user to remember a previous screen.
5. Use numeric keyboards for load and rep entry, preserve the user's selected measurement system, and validate values inline without discarding their input.
6. The interface remains usable with VoiceOver, Dynamic Type, reduced motion, and one-handed interaction. Haptics and animation are supplementary and can be disabled or ignored.
7. The standard straight-set workout remains visually uncluttered; advanced labels are shown only for workouts that use those options.

## Data and migration requirements

- Extend the local SQLite schema with versioned migrations; do not edit an already shipped migration.
- Snapshot set styles, superset membership/order, and drop-step prescriptions into the session when it starts so later plan edits cannot alter history.
- Store planned targets separately from actual logged load and reps.
- Preserve existing unique set identity rules while allowing multiple drop steps under one planned set.
- Keep migrations and normal use fully offline. Do not introduce a remote service, login, or paid dependency.
- Keep export, deletion, and encryption behavior consistent with the existing local-data privacy model.

## Out of scope for this change

- Automatically prescribing a training program or changing loads without user input.
- Social sharing, leaderboards, coach accounts, cloud sync, subscriptions, or ads.
- Requiring a user to configure advanced set types before starting a workout.
- Treating a planned set as completed without an explicit user confirmation.

## Release acceptance criteria

1. Existing plans open and run with the same straight-set sequence and saved data after migration.
2. A user can create and complete a workout containing warm-ups, a superset, a drop set, and an AMRAP set, then see every actual result in its summary.
3. Killing and reopening the app mid-workout resumes at the exact unfinished set or drop step without losing completed entries or duplicating them.
4. Superset rounds and rest boundaries remain correct when a member is skipped, a session is resumed, or exercises are reordered.
5. All four set styles can be planned, logged, edited, and viewed without network access or an account.
6. A user who does not choose an advanced style can plan and complete a straight-set workout without seeing advanced configuration in the primary flow.
7. Accessibility checks confirm that all workout actions are available without swiping and are understandable through VoiceOver.
