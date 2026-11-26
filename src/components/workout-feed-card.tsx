import { Pressable, StyleSheet, View } from 'react-native';

import { Divider } from '@/components/card';
import { MuscleChips, MuscleDiagram } from '@/components/muscle-diagram';
import { ShareButton } from '@/components/share-button';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { SessionDetail } from '@/db/repositories/sessions';
import { muscleSummary, musclesForWorkout } from '@/workouts/muscles';
import { formatSessionDate, formatTimeOfDay } from '@/workouts/timer';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'G';
}

function durationLabel(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${minutes} min`;
}

function exerciseResult(
  session: SessionDetail,
  exercise: SessionDetail['exercises'][number]
): string {
  const completed = session.sets.filter(
    (set) => set.exerciseId === exercise.exerciseId && set.isCompleted
  );
  if (completed.length === 0) {
    return exercise.status === 'skipped' ? 'Skipped' : '—';
  }
  const reps = completed
    .map((set) => set.reps)
    .filter((value): value is number => value !== null);
  if (reps.length === 0) {
    return `${completed.length} sets`;
  }
  const unique = [...new Set(reps)].sort((a, b) => a - b);
  const repsLabel =
    unique.length === 1 ? String(unique[0]) : `${unique[0]}–${unique[unique.length - 1]}`;
  return `${completed.length} × ${repsLabel}`;
}

export type WorkoutFeedCardProps = {
  session: SessionDetail;
  profileName: string;
  onPress: () => void;
};

/**
 * One finished workout in the home feed.
 *
 * The whole card opens the workout; the share action sits outside that press
 * target so it can stay a separate, deliberately inert control.
 */
export function WorkoutFeedCard({ session, profileName, onPress }: WorkoutFeedCardProps) {
  const muscles = musclesForWorkout(session.exercises);
  const title = session.title ?? 'Workout';
  const setsLabel = `${session.setsLogged} ${session.setsLogged === 1 ? 'set' : 'sets'}`;

  return (
    <View style={styles.card} testID={`feed-session-${session.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${formatSessionDate(session.startedAt)}, ${setsLabel}`}
        onPress={onPress}
        style={({ pressed }) => [styles.body, pressed ? styles.bodyPressed : null]}>
        <View style={styles.person}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profileName)}</Text>
          </View>
          <View style={styles.personText}>
            <Text variant="bodyStrong">{profileName}</Text>
            <Text variant="caption" tone="textTertiary">
              {formatSessionDate(session.startedAt)} · {formatTimeOfDay(session.startedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.heading}>
          <Text variant="heading" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text variant="caption" tone="textSecondary">
            {durationLabel(session.durationSeconds)} · {setsLabel}
          </Text>
        </View>

        <View style={styles.diagram}>
          <MuscleDiagram muscles={muscles} />
        </View>
        <MuscleChips muscles={muscles} />

        <View style={styles.exercises}>
          {session.exercises.map((exercise, index) => (
            <View key={exercise.id}>
              {index > 0 ? <Divider style={styles.divider} /> : null}
              <View style={styles.exerciseRow}>
                <View style={styles.exerciseText}>
                  <Text variant="body">{exercise.name}</Text>
                  <Text
                    variant="caption"
                    tone="textTertiary"
                    numberOfLines={1}
                    style={styles.exerciseMuscles}>
                    {muscleSummary(exercise)}
                  </Text>
                </View>
                <Text variant="label" tone="textSecondary">
                  {exerciseResult(session, exercise)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Pressable>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${title}`}
          onPress={onPress}
          hitSlop={8}
          testID={`feed-view-${session.id}`}>
          <Text variant="label" tone="textSecondary">
            View workout
          </Text>
        </Pressable>
        <ShareButton testID={`feed-share-${session.id}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  body: {
    gap: spacing.md,
  },
  bodyPressed: {
    opacity: 0.7,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  personText: {
    flex: 1,
    gap: 1,
  },
  heading: {
    gap: 2,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  diagram: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  exercises: {
    gap: 0,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  exerciseText: {
    flex: 1,
    gap: 1,
  },
  exerciseMuscles: {
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
});
