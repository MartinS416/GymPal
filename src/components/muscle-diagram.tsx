import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Body from 'react-native-body-highlighter';
import type { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Muscle, MuscleRegion, MuscleRole } from '@/workouts/muscles';

const INK = colors.text;
const SECONDARY_FILL = '#C3C3C9';
const BODY_FILL = '#FAFAFB';
const OUTLINE = '#C4C4CA';

/**
 * The body-highlighter's slugs are coarser than our muscle regions: it has one
 * deltoid slug and no separate lat slug. Map the regions to the nearest
 * printable part.
 */
const SLUG_BY_REGION: Record<MuscleRegion, Slug> = {
  chest: 'chest',
  shoulders: 'deltoids',
  biceps: 'biceps',
  forearms: 'forearm',
  abs: 'abs',
  quads: 'quadriceps',
  calves: 'calves',
  traps: 'trapezius',
  lats: 'upper-back',
  upperBack: 'upper-back',
  rearDelts: 'deltoids',
  triceps: 'triceps',
  lowerBack: 'lower-back',
  glutes: 'gluteal',
  hamstrings: 'hamstring',
};

const FRONT_REGIONS = new Set<MuscleRegion>([
  'chest',
  'shoulders',
  'biceps',
  'forearms',
  'abs',
  'quads',
  'calves',
]);

const BACK_REGIONS = new Set<MuscleRegion>([
  'forearms',
  'calves',
  'traps',
  'lats',
  'upperBack',
  'rearDelts',
  'triceps',
  'lowerBack',
  'glutes',
  'hamstrings',
]);

function sideData(
  muscles: Muscle[],
  side: 'front' | 'back'
): ExtendedBodyPart[] {
  const allowed = side === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  const roles = new Map<Slug, MuscleRole>();

  for (const muscle of muscles) {
    if (!allowed.has(muscle.region)) continue;
    const slug = SLUG_BY_REGION[muscle.region];
    if (roles.get(slug) === 'primary') continue;
    roles.set(slug, muscle.role);
  }

  return [...roles.entries()].map(([slug, role]) => {
    const fill = role === 'primary' ? INK : SECONDARY_FILL;
    return {
      slug,
      styles: { fill, stroke: fill, strokeWidth: 0.5 },
    };
  });
}

type FigureProps = {
  side: 'front' | 'back';
  muscles: Muscle[];
  scale: number;
};

function Figure({ side, muscles, scale }: FigureProps) {
  return (
    <View style={styles.figure}>
      <Body
        data={sideData(muscles, side)}
        side={side}
        gender="male"
        scale={scale}
        border={OUTLINE}
        defaultFill={BODY_FILL}
        defaultStroke="#D5D5DA"
        // The library's viewBox is 1448 units tall; 0.6 would disappear at
        // the scale the diagram is drawn at. Six units is a hairline.
        defaultStrokeWidth={6}
      />
      <Text variant="eyebrow" align="center" style={styles.figureLabel}>
        {side === 'front' ? 'Front' : 'Back'}
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: color, borderColor: color === BODY_FILL ? OUTLINE : color },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

export type MuscleDiagramProps = {
  muscles: Muscle[];
  testID?: string;
};

/**
 * A clean front/back body map.
 *
 * Primary muscles are solid black, supporting muscles a soft grey, and the
 * rest of the body stays white, so the diagram reads at a glance without
 * looking like an anatomy chart.
 */
export function MuscleDiagram({ muscles, testID = 'muscle-diagram' }: MuscleDiagramProps) {
  // The body-highlighter is fixed at 200pt wide per figure. Measure the card
  // and scale both figures to fit it, rather than hard-coding one phone width.
  const [frameWidth, setFrameWidth] = useState(320);
  const scale = Math.max(0.55, Math.min(0.82, (frameWidth - spacing.sm) / 400));

  const primary = muscles.filter((muscle) => muscle.role === 'primary').map((m) => m.label);
  const secondary = muscles
    .filter((muscle) => muscle.role === 'secondary')
    .map((m) => m.label);
  const label = [
    primary.length > 0 ? `Primary: ${primary.join(', ')}.` : null,
    secondary.length > 0 ? `Secondary: ${secondary.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View
      testID={testID}
      style={styles.root}
      accessible
      accessibilityLabel={label || 'Body map'}>
      <View
        style={styles.figures}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width > 0 && width !== frameWidth) {
            setFrameWidth(width);
          }
        }}>
        <Figure side="front" muscles={muscles} scale={scale} />
        <Figure side="back" muscles={muscles} scale={scale} />
      </View>

      <View style={styles.legend}>
        <Legend color={INK} label="Primary" />
        <Legend color={SECONDARY_FILL} label="Secondary" />
        <Legend color={BODY_FILL} label="Not trained" />
      </View>
    </View>
  );
}

export type MuscleChipsProps = {
  muscles: Muscle[];
  testID?: string;
};

/** Compact role-aware tags for the muscles a workout or exercise uses. */
export function MuscleChips({ muscles, testID = 'muscle-chips' }: MuscleChipsProps) {
  if (muscles.length === 0) {
    return null;
  }

  return (
    <View
      testID={testID}
      style={styles.chips}
      accessible
      accessibilityLabel={muscles
        .map((muscle) => `${muscle.label}, ${muscle.role}`)
        .join('. ')}>
      {muscles.map((muscle) => {
        const isPrimary = muscle.role === 'primary';
        return (
          <View
            key={muscle.region}
            style={[styles.chip, isPrimary ? styles.chipPrimary : styles.chipSecondary]}>
            <Text style={[styles.chipLabel, isPrimary ? styles.chipLabelPrimary : null]}>
              {muscle.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  figures: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  figure: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  figureLabel: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipPrimary: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  chipSecondary: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
  },
  chipLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.textSecondary,
  },
  chipLabelPrimary: {
    color: colors.textOnInverted,
  },
});
