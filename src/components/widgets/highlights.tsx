import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useHighlights, type Highlight } from '@/hooks/use-highlights';

function prLabel(highlight: Extract<Highlight, { kind: 'pr' }>): string {
  if (highlight.type === 'max_weight') return `New max weight · ${highlight.value} kg`;
  if (highlight.type === 'max_reps') return `New max reps · ${highlight.value}`;
  return `New 1RM · ${highlight.value.toFixed(1)} kg`;
}

/**
 * A compact widget that rotates through recent PRs and milestones.
 *
 * Designed to flow cohesively with the rest of GymPal's monochrome cards.
 */
export function Highlights() {
  const haptics = useHaptics();
  const { highlights, loading } = useHighlights();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (highlights.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % highlights.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [highlights.length]);

  const safeIndex = highlights.length > 0 ? index % highlights.length : 0;
  const current = highlights[safeIndex];

  const advance = () => {
    if (highlights.length <= 1) return;
    haptics.tick();
    setIndex((current) => (current + 1) % highlights.length);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        current
          ? current.kind === 'pr'
            ? `${current.exercise} ${prLabel(current)}`
            : current.label
          : 'No highlights yet'
      }
      onPress={advance}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      {loading ? (
        <Text variant="caption" tone="textTertiary" style={styles.muted}>
          Loading…
        </Text>
      ) : current ? (
        <>
          <View style={styles.row}>
            <Text variant="eyebrow" tone="textSecondary" style={styles.eyebrow}>
              {current.kind === 'pr' ? 'Personal record' : 'Milestone'}
            </Text>
            {highlights.length > 1 ? (
              <Chevron direction="right" size={9} color="textTertiary" />
            ) : null}
          </View>
          <Text variant="subheading" tone="text" numberOfLines={1} style={styles.title}>
            {current.kind === 'pr' ? `${current.exercise}` : current.label}
          </Text>
          {current.kind === 'pr' ? (
            <Text variant="caption" tone="textSecondary" numberOfLines={1} style={styles.detail}>
              {prLabel(current)}
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="caption" tone="textTertiary" style={styles.muted}>
          Log a workout to earn PRs
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    letterSpacing: 1,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  detail: {
    fontSize: 12,
  },
  muted: {
    fontSize: 12,
  },
});
