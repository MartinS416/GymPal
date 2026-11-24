import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

export type LoadingScreenProps = {
  /** Optional line of context below the barbell. */
  label?: string;
};

/**
 * App launch and state loading screen.
 *
 * Displays the GymPal brand with a finely-crafted barbell and plates loaded,
 * maintaining the monochrome design language of the app.
 */
export function LoadingScreen({ label }: LoadingScreenProps) {
  const insets = useSafeAreaInsets();

  // Animation values initialized via useState for React 19 compatibility
  const [loadProgress] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    // Plates slide on and settle firmly on the barbell
    const loadAnim = Animated.timing(loadProgress, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    // Subtle breathing pulse once loaded
    const breatheAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.sequence([loadAnim, breatheAnim]).start();

    return () => {
      loadProgress.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, [loadProgress, pulseAnim]);

  // Interpolated slide offsets for plates loading onto the barbell sleeves
  // Inner plates (45s) slide 36px into collar
  const innerLeftTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-36, 0],
  });
  const innerRightTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],
  });

  // Middle plates (35s) slide 44px
  const midLeftTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-44, 0],
  });
  const midRightTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [44, 0],
  });

  // Outer plates (25s) slide 52px
  const outerLeftTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-52, 0],
  });
  const outerRightTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [52, 0],
  });

  // Collar clamps slide 58px
  const collarLeftTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-58, 0],
  });
  const collarRightTranslate = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [58, 0],
  });

  const plateOpacity = loadProgress.interpolate({
    inputRange: [0, 0.3, 1],
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

      {/* Barbell with plates loaded */}
      <Animated.View
        style={[
          styles.barbellWrapper,
          { transform: [{ scale: pulseAnim }] },
        ]}
        accessible={false}>
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

          {/* --- LEFT LOADED PLATES --- */}
          {/* Inner 45 Plate */}
          <Animated.View
            style={[
              styles.plate,
              styles.plate45,
              styles.leftPlateInner,
              { opacity: plateOpacity, transform: [{ translateX: innerLeftTranslate }] },
            ]}>
            <View style={styles.plateRib} />
            <View style={styles.plateHole} />
          </Animated.View>

          {/* Middle 35 Plate */}
          <Animated.View
            style={[
              styles.plate,
              styles.plate35,
              styles.leftPlateMid,
              { opacity: plateOpacity, transform: [{ translateX: midLeftTranslate }] },
            ]}>
            <View style={styles.plateRib} />
            <View style={styles.plateHole} />
          </Animated.View>

          {/* Outer 25 Plate */}
          <Animated.View
            style={[
              styles.plate,
              styles.plate25,
              styles.leftPlateOuter,
              { opacity: plateOpacity, transform: [{ translateX: outerLeftTranslate }] },
            ]}>
            <View style={styles.plateRib} />
            <View style={styles.plateHole} />
          </Animated.View>

          {/* Left Collar Clip */}
          <Animated.View
            style={[
              styles.collar,
              styles.leftCollar,
              { opacity: plateOpacity, transform: [{ translateX: collarLeftTranslate }] },
            ]}
          />

          {/* --- RIGHT LOADED PLATES --- */}
          {/* Inner 45 Plate */}
          <Animated.View
            style={[
              styles.plate,
              styles.plate45,
              styles.rightPlateInner,
              { opacity: plateOpacity, transform: [{ translateX: innerRightTranslate }] },
            ]}>
            <View style={styles.plateRib} />
            <View style={styles.plateHole} />
          </Animated.View>

          {/* Middle 35 Plate */}
          <Animated.View
            style={[
              styles.plate,
              styles.plate35,
              styles.rightPlateMid,
              { opacity: plateOpacity, transform: [{ translateX: midRightTranslate }] },
            ]}>
            <View style={styles.plateRib} />
            <View style={styles.plateHole} />
          </Animated.View>

          {/* Outer 25 Plate */}
          <Animated.View
            style={[
              styles.plate,
              styles.plate25,
              styles.rightPlateOuter,
              { opacity: plateOpacity, transform: [{ translateX: outerRightTranslate }] },
            ]}>
            <View style={styles.plateRib} />
            <View style={styles.plateHole} />
          </Animated.View>

          {/* Right Collar Clip */}
          <Animated.View
            style={[
              styles.collar,
              styles.rightCollar,
              { opacity: plateOpacity, transform: [{ translateX: collarRightTranslate }] },
            ]}
          />
        </View>
      </Animated.View>

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
    borderRadius: 3,
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
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  flangeRight: {
    position: 'absolute',
    right: 40,
    width: 5,
    height: 24,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  sleeveLeft: {
    position: 'absolute',
    left: 2,
    width: 38,
    height: 9,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  sleeveRight: {
    position: 'absolute',
    right: 2,
    width: 38,
    height: 9,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  plate: {
    position: 'absolute',
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
  },
  plate45: {
    width: 9,
    height: 62,
    borderRadius: 4,
  },
  plate35: {
    width: 8,
    height: 52,
    borderRadius: 3,
  },
  plate25: {
    width: 7,
    height: 42,
    borderRadius: 3,
  },
  plateRib: {
    position: 'absolute',
    width: 3,
    top: 4,
    bottom: 4,
    borderRadius: 1,
    backgroundColor: '#2C2C2E',
  },
  plateHole: {
    width: 3,
    height: 9,
    borderRadius: 1.5,
    backgroundColor: colors.background,
  },
  /* Left plates positioning against left flange (at x=40) */
  leftPlateInner: {
    left: 30,
  },
  leftPlateMid: {
    left: 21,
  },
  leftPlateOuter: {
    left: 13,
  },
  leftCollar: {
    left: 6,
  },
  /* Right plates positioning against right flange */
  rightPlateInner: {
    right: 30,
  },
  rightPlateMid: {
    right: 21,
  },
  rightPlateOuter: {
    right: 13,
  },
  rightCollar: {
    right: 6,
  },
  collar: {
    position: 'absolute',
    width: 5,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    borderWidth: 1,
    borderColor: colors.text,
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
