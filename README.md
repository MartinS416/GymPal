# GymPal

A private, offline-first gym planning and workout tracking app — a SkachCorp product.

## Overview

GymPal is a mobile application for planning workouts and tracking training progress, with **zero** cloud dependency. All data lives in an encrypted local database on the user's device.

### Stages of Delivery

- **Stage 1** — Interface: a two-step onboarding wizard and a tabbed app with Home, History, and Progress screens.
- **Stage 2** — Storage: an encrypted, device-local database with a secure key, migrations, and a data access layer the UI never bypasses.
- **Stage 3** — Product: a plan builder, an active workout screen that logs every set, and a history you can look back through.

## Core Principles

- **Offline-first**: No backend, no account, no analytics, no cloud sync. Everything is stored locally.
- **Encrypted by default**: Database uses SQLCipher. The encryption key is generated once on the device and stored in the platform keystore (iOS Keychain / Android Keystore).
- **Privacy-first**: No data leaves the device. Android backups are disabled. iOS file protection is enabled.
- **Resumable workouts**: Sessions survive app backgrounding and restarts because state is stored as timestamps in the database.

## Running the App

A **development build** is required for an encrypted database. Expo Go still runs the app during development, but stores the database unencrypted in its own sandbox, because Expo Go ships plain SQLite and cannot be rebuilt. The privacy screen says so; the two environments do not share data.

### 1. Install dependencies

```bash
npm install
```

### 2. Build and run a development build

```bash
# iOS simulator or connected iPhone (macOS only)
npx expo run:ios

# Android emulator or device
npx expo run:android
```

From then on:

```bash
npm start          # QR code opens the installed development build
```

### 3. Building with EAS (no Mac required)

```bash
# Development profile (includes SQLCipher)
npx eas-cli@latest build --profile development --platform ios

# Preview profile (release-quality, no dev server needed)
npx eas-cli@latest build --profile preview --platform ios
```

### Web target

The web build works for development but **is not encrypted** — the database is stored in browser plaintext storage. The privacy screen acknowledges this.

```bash
npm run web
```

### Encryption setup requirements

For the database to be encrypted, all of the following must be true:

| Requirement | How it is satisfied |
|---|---|
| Binary contains SQLCipher | `expo-sqlite` config plugin with `useSQLCipher: true` in `app.json` |
| App rebuilt after flag set | `npx expo prebuild --clean`, then rebuild |
| Build is not Expo Go | Expo Go ships plain SQLite, so it runs unencrypted in development only |
| Escape hatch off | `EXPO_PUBLIC_ALLOW_UNENCRYPTED_DATABASE` unset, or the bundle is a release build |
| Key in platform keystore | `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |

Expo Go is detected automatically, so an unencrypted development run needs no configuration. Any other run verifies encryption at runtime by querying `PRAGMA cipher_version` before writing anything, and refuses to start if SQLCipher is missing. That refusal means the installed binary is stale: regenerate the native project with `npx expo prebuild --clean` and rebuild it.

### Privacy and data deletion

- **Data deletion**: Settings → Privacy & local data closes the connection, deletes the database file, destroys the key, and restarts the app with an empty database.
- **Recovery**: There is no cloud copy. If the database or key is lost (device failure, restore without keychain, Android reinstall), data cannot be recovered.

## App Navigation

GymRouter-based file routing in `src/app/`. The navigation structure:

```
(Root Stack)
  ├── onboarding        # Two-step wizard: name + measurements/units
  ├── start             # Pick or create a workout
  ├── (tabs)            # Bottom tab group: Home, History, Progress
  │   ├── home          # Greeting, measurements, Start workout, options menu
  │   ├── history       # List of completed sessions
  │   └── progress      # Dashboard: metrics, charts, progress entries
  ├── plans/            # Plan builder (split templates, exercise selection)
  ├── workouts/         # Workout overview and start
  ├── session/[id]      # Active workout screen
  ├── sessions/[id]     # Finished session summary
  └── progress/[metricKey]  # Detailed chart for one metric
```

### Home tab

- Greeting with user's name
- Height and weight from onboarding
- "Start workout" button
- "..." options menu: View workouts or create new workout

### History tab

- List of all completed sessions (newest first)
- Each entry shows title, date, set count, and status (in prothegress / abandoned)

### Progress tab

- Metric cards: body weight, strength progress (weight, reps, sets, volume, 1RM estimate)
- Pin/unpin and reorder metrics
- Chart view with range selection (1W, 1M, 3M, 6M, 1Y, All)
- Manual weight logging by date

## Workout Tracking

### Plan builder

1. **Split** — Choose: full body, upper/lower, push/pull/legs, bro split, or custom
2. **Name** — Prefilled from the split selection
3. **One workout at a time** — Workouts are built as a sequence; each is named and filled with exercises

Exercises come from a local library of 37 movements (searchable by name, muscle group, or equipment). Within a workout, exercises can be reordered, replaced, and removed (swipe left to delete).

### Active workout screen

The screen shows a **timeline of phases**:

```
work set 1 → rest → work set 2 → rest → … → work set 3
```

- **Swipe left** — Log the current set and start the rest timer
- **Swipe right** — Go back to the previous phase (set or rest). Going back never loses data.
- **No buttons** in the middle of the screen. Only "Finish Workout" at the bottom.

#### Timing mechanism

- **Two clocks**: one counts up (exercise time), one counts down (rest time)
- Both are derived from **timestamps**, not running counters — they remain correct after backgrounding
- The work clock pauses during rest, so the two never double-count
- The work clock runs **per set**: every set starts its own work clock, so the timer during the exercise portion measures the set in progress, not the whole exercise
- Rest timer is **not** cut short when it reaches zero — it continues past zero (showing `-0:05` and blinking red) until the user moves on

#### Set logging

- A set is written to the encrypted database **the moment the swipe confirms it**, and only then does the rest timer start
- The session survives the app being closed — it stays in progress and the workout offers to resume it
- Optional warm-ups, supersets, drop sets, and AMRAP sets can be configured per exercise. Straight sets remain the default. Each completed segment is saved locally and can be reviewed in the session summary.

### Finishing a workout

- "Finish Workout" asks for confirmation
- Stores end time and duration
- Marks the session completed
- Recalculates personal records from what was actually logged
- Shows a summary: duration, sets, reps, volume, and every recorded set

### Workout Live Activity (iOS only)

> **Temporarily disabled** — requires a development build with the `expo-widgets` native module.

On iOS, the current phase is mirrored into a Live Activity (Lock Screen / Dynamic Island) so the timer keeps running even when the app is in a pocket. The card shows the phase, exercise, set, and workout underneath.

## Data Model (SQLite + SQLCipher)

### Core tables

| Table | Holds | Notable constraints |
|---|---|---|
| `profile` | name, height, weight, unit preference | single row (`id = 1`), range checks |
| `exercises` | name, muscle group, equipment, instructions | unique name |
| `workout_plans` | name, split type, weekly frequency | split type enum, 1–7 days |
| `plan_schedule` | the days a plan is trained | `ON DELETE CASCADE`, one row per day |
| `planned_exercises` | order, target sets, rep range, rest | `ON DELETE CASCADE`, unique position, `rep_range_max >= rep_range_min` |
| `workout_sessions` | plan, start, end, duration, status | `ON DELETE SET NULL` for the plan, `ended_at >= started_at` |
| `logged_sets` | exercise, set number, weight, reps, RPE | `ON DELETE CASCADE`, unique per session and exercise, RPE 1–10 |
| `personal_records` | derived bests per exercise | primary key (exercise, type) |

### Additional tables (Stage 3)

| Table | Holds |
|---|---|
| `workouts` | the workouts that make up a plan, in order |
| `workout_exercises` | the exercises of a workout with their targets |
| `session_exercises` | where the user got to in a session, and what was skipped |

### Views

- `exercise_progress` — per exercise totals
- `session_summary` — per session totals

### Migrations

Schema version lives in the database (`PRAGMA user_version`). Migrations are applied in order, each in its own transaction. A failed upgrade rolls back and leaves the last good version. A database written by a newer app version is refused (not downgraded).

To add a migration: add a file and append it to the list, never edit an existing one.

### Migration files (src/db/migrations/)

| File | Description |
|---|---|
| `001-initial.ts` | Initial schema |
| `002-workouts.ts` | Workout-related tables |
| `003-exercise-library.ts` | Exercise library seed |
| `004-session-timers.ts` | Two clocks on sessions |
| `005-session-phases.ts` | Phase indexing |
| `006-progress.ts` | Progress entries and metric preferences |
| `007-session-exercise-fields.ts` | Exercise prescriptions copied into live sessions |
| `008-flexible-set-styles.ts` | Warm-ups, set styles, superset groups, and logged-set context |

## Encryption and Key Management

The database is encrypted with **SQLCipher**. The key is generated once on the device using the platform CSPRNG (`expo-crypto`, 32 bytes / 256 bits) and stored in the platform keystore (`expo-secure-store`: iOS Keychain or Android SharedPreferences encrypted by the Android Keystore).

### Key ordering in `src/db/client.ts`

1. Read the key from the keystore. If none exists, generate one in memory only.
2. Open the database and apply the key with `PRAGMA key`.
3. Check `PRAGMA cipher_version`. Except in Expo Go, a missing value means no SQLCipher — the app **refuses to run** before anything is written.
4. Verify the unlock by reading the schema. A failure means the file belongs to a different key — existing data is left untouched.
5. Run SQLCipher's integrity check.
6. Only then is a newly generated key written to the keystore — a key is never trusted before it proves it can read the file.

### Consequences (covered by tests)

- A missing key never silently replaces the database. If the keystore entry is gone but the file remains, the app reports it and offers to delete data deliberately.
- A wrong key is reported, not worked around.
- A corrupt database is detected by the integrity check and reported.
- The key is never logged — no console output contains the key.
- The key is stored with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: unreadable while the device is locked, never migrated to another device by a backup.

### Web preview

The web build has no SQLCipher and stores data in plaintext. The privacy screen labels it as unencrypted.

## Dependencies (runtime)

| Package | Version | Purpose |
|---|---|---|
| `expo` | `~58.0.17` | Expo SDK 58 (React Native 0.88, React 19.3) |
| `expo-router` | `~58.0.25` | File-based routing |
| `expo-sqlite` | `~58.0.13` | Encrypted local database (SQLCipher) |
| `expo-secure-store` | `~58.0.2` | Keychain / Keystore for the database key |
| `expo-crypto` | `~58.0.7` | CSPRNG key material |
| `expo-widgets` | `~58.0.25` | Live Activity card for workout phase |
| `react` | `19.3.0` | React 19 |
| `react-native` | `0.88.0` | React Native 0.88 |

## Test Suite

```bash
npm test
```

Test suites cover:

| Suite | Covers |
|---|---|
| `db-key.test.ts` | Key generation, keychain storage, encryption policy, missing/wrong/corrupt keys, deletion, key never reaching console |
| `encryption-policy.test.ts` | Browser never encrypts, native builds always do, Expo Go falls back in development only |
| `db-schema.test.ts` | Every table, view, index; schema version; migrations idempotent; newer database refused; foreign keys enforced |
| `db-repositories.test.ts` | Data access layer: constraints, cascades, transactions, session summaries, personal records |
| `db-persistence.test.ts` | Data and key survive restart; lost key does not replace database |
| `onboarding-navigation.test.tsx` | Wizard, tabs, home menu, database-backed greeting, data deletion flow |
| `start-flow.test.tsx` | Home screen, empty picker → builder, building a workout, resuming session |
| `workout-flow.test.tsx` | Build plan, start workout, log sets, finish, history — plus resuming session and Live Activity |
| `workout-activity.test.ts` | Live Activity content: phase, timer ranges, progress, overdue rest fallbacks |
| `progress-flow.test.tsx` | Dashboard, metric chart, range change, log/delete entry, pin/reorder metrics |
| `progress-model.test.ts` | Chart math: measures, same-day collapse, pinned defaults, timeframes, zoom/pan, formatting, calendar grid |
| `plan-builder.test.tsx` | Builder flow: split, name, one workout at a time, add/remove/replace/reorder exercises |
| `swipe-to-delete.test.ts` | Swipe gesture rules: drag distance, when row is removed |
| `session-runner.test.ts` | Set validation, workout phases, forward/backward movement, correcting sets during rest, two clocks, rest countdown past zero |
| `plan-draft.test.ts` | Split templates, schedule, add/remove/reorder/replace/retarget exercises |
| `timer.test.ts` | Timing helpers: elapsed time, rest countdown, formatting |

Native modules (`expo-sqlite`, `expo-secure-store`, `expo-crypto`, `expo-widgets`) are replaced with doubles in `test-support/`. The SQLite double uses Node's built-in SQLite, so schema, constraints, foreign keys, and transactions are exercised by a real SQL engine.

## License

Private — © SkachCorp.
