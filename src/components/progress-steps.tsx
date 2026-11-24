import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type ProgressStepsProps = {
  /** Zero-based index of the step the user is on. */
  current: number;
  total: number;
  style?: object;
};

/**
 * Wizard progress.
 *
 * A caption and a segmented rule — no dots, no percentages, no colour. The
 * filled segments show how far through the flow the user is.
 */
export function ProgressSteps({ current, total, style }: ProgressStepsProps) {
  return (
    <View style={[styles.container, style]}>
      <Text variant="eyebrow">
        Step {current + 1} of {total}
      </Text>
      <View style={styles.track}>
        {Array.from({ length: total }).map((_, index) => (
          <View
            key={index}
            style={[styles.segment, index <= current ? styles.segmentActive : null]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  track: {
    flexDirection: 'row',
    gap: spacing.xs + spacing.xxs,
  },
  segment: {
    flex: 1,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  segmentActive: {
    backgroundColor: colors.text,
  },
});
