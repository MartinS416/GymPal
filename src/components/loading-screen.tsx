import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

export type LoadingScreenProps = {
  /** Optional line of context below the barbell. */
  label?: string;
};

// Bumper plates share the same diameter and differ only by color; the 10 is
// half the thickness. Colors follow the requested (deliberate) weight coding.
const PLATE_HEIGHT = 62;
const PLATE_DEFS = {
  45: { color: '#1C6DD0', width: 11.25 },
  35: { color: '#D6382E', width: 11.25 },
  25: { color: '#2E9E4F', width: 11.25 },
  10: { color: '#E7B23C', width: 5.625 },
};
const WEIGHTS = [45, 35, 25, 10] as const;
type Weight = (typeof WEIGHTS)[number];

const LOAD_COUNT = 3;

// Plates butt against the flange inner face (x=40) and stack outward.
const FLANGE_INNER_X = 40;
const GAP = 1.5;
const SLIDE_DISTANCE = 52;

const IN_DUR = 420;
const IN_STAGGER = 180;
const OUT_DUR = 380;
const OUT_STAGGER = 120;
const HOLD = 1000;
const LOOP_GAP = 350;

// Pick LOAD_COUNT plates at random (multiples allowed), then order heaviest
// first so they load inward-out and strip the reverse.
function pickPlates(): Weight[] {
  return Array.from({ length: LOAD_COUNT }, () => WEIGHTS[Math.floor(Math.random() * WEIGHTS.length)]).sort(
    (a, b) => b - a
  );
}

/**
 * App launch and state loading screen.
 *
 * Displays the GymPal brand with a barbell whose colored bumper plates load on
 * one at a time (heaviest first), hold, then strip off, looping with a bounce.
 * The mix of plates is randomized each time the screen mounts.
 */
export function LoadingScreen({ label }: LoadingScreenProps) {
  const insets = useSafeAreaInsets();

  const [chosen] = useState<Weight[]>(() => pickPlates());
  const [plateAnims] = useState(() => chosen.map(() => new Animated.Value(0)));

  // Seat offsets derived from the chosen widths so the stack hugs the flange.
  const layout = useMemo(() => {
    const widths = chosen.map((weight) => PLATE_DEFS[weight].width);
    return chosen.map((weight, index) => {
      const def = PLATE_DEFS[weight];
      const consumed = widths.slice(0, index).reduce((sum, width) => sum + width + GAP, 0);
      return { weight, ...def, seat: FLANGE_INNER_X - consumed - def.width };
    });
  }, [chosen]);

  useEffect(() => {
    const lastInEnd = (plateAnims.length - 1) * IN_STAGGER + IN_DUR;
    const offBase = lastInEnd + HOLD;

    const bounceIn = Easing.out(Easing.back(1.6));
    const slideOut = Easing.in(Easing.cubic);

    const plateSequences = plateAnims.map((value, i) => {
      const inStart = i * IN_STAGGER;
      const inEnd = inStart + IN_DUR;
      // Strip the outermost plate first, working inward.
      const outStart = offBase + (plateAnims.length - 1 - i) * OUT_STAGGER;
      const holdBeforeOut = Math.max(0, outStart - inEnd);

      return Animated.sequence([
        Animated.delay(inStart),
        Animated.timing(value, {
          toValue: 1,
          duration: IN_DUR,
          easing: bounceIn,
          useNativeDriver: true,
        }),
        Animated.delay(holdBeforeOut),
        Animated.timing(value, {
          toValue: 0,
          duration: OUT_DUR,
          easing: slideOut,
          useNativeDriver: true,
        }),
      ]);
    });

    const cycle = Animated.loop(
      Animated.sequence([
        Animated.parallel(plateSequences),
        Animated.delay(LOOP_GAP),
      ])
    );
    cycle.start();

    return () => cycle.stop();
  }, [plateAnims]);

  const translateFor = (value: Animated.Value, side: 'left' | 'right') =>
    value.interpolate({
      inputRange: [0, 1],
      outputRange: side === 'left' ? [-SLIDE_DISTANCE, 0] : [SLIDE_DISTANCE, 0],
    });

  const opacityFor = (value: Animated.Value) =>
    value.interpolate({
      inputRange: [0, 0.25, 1],
      outputRange: [0, 1, 1],
    });

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'GymPal is loading'}>
      {/* Brand Title */}
      <View style={styles.brandContainer}>
        <Text variant="title" style={styles.title}>
          GymPal
        </Text>
        <Text variant="eyebrow" tone="textTertiary" style={styles.subtitle}>
          STRENGTH & FITNESS
        </Text>
      </View>

      {/* Barbell with bumper plates loading */}
      <View style={styles.barbellWrapper} accessible={false}>
        <View style={styles.barbell}>
          {/* Main Bar Shaft */}
          <View style={styles.shaft} />

          {/* Knurling rings on shaft */}
          <View style={styles.knurlLeft} />
          <View style={styles.knurlRight} />

          {/* Left Sleeve and Flange */}
          <View style={styles.flangeLeft} />
          <View style={styles.sleeveLeft} />

          {/* Right Sleeve and Flange */}
          <View style={styles.flangeRight} />
          <View style={styles.sleeveRight} />

          {/* Plates load on both sleeves, heaviest (inner) first */}
          {layout.map((plate, i) => (
            <Fragment key={`${plate.weight}-${i}`}>
              <Animated.View
                style={[
                  styles.plate,
                  {
                    width: plate.width,
                    height: PLATE_HEIGHT,
                    backgroundColor: plate.color,
                    left: plate.seat,
                    opacity: opacityFor(plateAnims[i]),
                    transform: [{ translateX: translateFor(plateAnims[i], 'left') }],
                  },
                ]}>
                <View style={styles.plateHole} />
              </Animated.View>

              <Animated.View
                style={[
                  styles.plate,
                  {
                    width: plate.width,
                    height: PLATE_HEIGHT,
                    backgroundColor: plate.color,
                    right: plate.seat,
                    opacity: opacityFor(plateAnims[i]),
                    transform: [{ translateX: translateFor(plateAnims[i], 'right') }],
                  },
                ]}>
                <View style={styles.plateHole} />
              </Animated.View>
            </Fragment>
          ))}
        </View>
      </View>

      {/* Loading Label */}
      <View style={styles.footer}>
        <Text variant="caption" tone="textSecondary" style={styles.label}>
          {label ?? 'Loading…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.text,
  },
  subtitle: {
    letterSpacing: 1.6,
  },
  barbellWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    width: 260,
  },
  barbell: {
    width: 250,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  shaft: {
    position: 'absolute',
    left: 42,
    right: 42,
    height: 6,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  knurlLeft: {
    position: 'absolute',
    left: 64,
    width: 24,
    height: 6,
    backgroundColor: colors.borderStrong,
  },
  knurlRight: {
    position: 'absolute',
    right: 64,
    width: 24,
    height: 6,
    backgroundColor: colors.borderStrong,
  },
  flangeLeft: {
    position: 'absolute',
    left: 40,
    width: 5,
    height: 24,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  flangeRight: {
    position: 'absolute',
    right: 40,
    width: 5,
    height: 24,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  sleeveLeft: {
    position: 'absolute',
    left: 2,
    width: 38,
    height: 9,
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
  },
  sleeveRight: {
    position: 'absolute',
    right: 2,
    width: 38,
    height: 9,
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
  },
  plate: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  plateHole: {
    width: 3,
    height: 12,
    borderRadius: 1,
    backgroundColor: colors.background,
  },
  footer: {
    marginTop: spacing.xxxl,
    minHeight: 24,
    alignItems: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
