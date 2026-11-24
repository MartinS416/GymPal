import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';

import { colors } from '@/constants/theme';

export type TabIconProps = {
  color?: ColorValue;
  size?: number;
};

/**
 * Hand-drawn tab bar glyphs.
 *
 * Every icon is built from plain views and hairline strokes so the tab bar
 * stays strictly monochrome and the app carries no icon-font dependency.
 */

const STROKE = 1.5;

/** A house: a pitched roof over a square body. */
export function HomeIcon({ color = colors.text, size = 24 }: TabIconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={[
          styles.absolute,
          {
            top: '14%',
            width: '44%',
            height: '44%',
            borderTopWidth: STROKE,
            borderLeftWidth: STROKE,
            borderColor: color,
            transform: [{ rotate: '45deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.absolute,
          {
            bottom: '16%',
            width: '58%',
            height: '40%',
            borderWidth: STROKE,
            borderColor: color,
            borderRadius: 2,
          },
        ]}
      />
    </View>
  );
}

/** A clock face with two hands. */
export function HistoryIcon({ color = colors.text, size = 24 }: TabIconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={[
          styles.absolute,
          {
            width: '76%',
            height: '76%',
            borderWidth: STROKE,
            borderColor: color,
            borderRadius: 999,
          },
        ]}
      />
      <View
        style={[
          styles.absolute,
          {
            top: '26%',
            width: STROKE,
            height: '24%',
            borderRadius: STROKE,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.absolute,
          {
            left: '50%',
            top: '46%',
            width: '24%',
            height: STROKE,
            borderRadius: STROKE,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

/** Three bars of increasing height. */
export function ProgressIcon({ color = colors.text, size = 24 }: TabIconProps) {
  return (
    <View style={[styles.box, styles.bars, { width: size, height: size }]}>
      <View style={[styles.bar, { height: '42%', backgroundColor: color }]} />
      <View style={[styles.bar, { height: '72%', backgroundColor: color }]} />
      <View style={[styles.bar, { height: '100%', backgroundColor: color }]} />
    </View>
  );
}

/** A simple outlined gear for Settings. */
export function SettingsIcon({ color = colors.text, size = 24 }: TabIconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.gear, { borderColor: color, width: size * 0.72, height: size * 0.72, borderRadius: size * 0.36 }]}>
        <View style={[styles.gearCenter, { borderColor: color, borderRadius: size * 0.12 }]} />
      </View>
      {Array.from({ length: 8 }, (_, index) => (
        <View
          key={`gear-tooth-${index}`}
          style={[
            styles.gearTooth,
            {
              backgroundColor: color,
              left: size * 0.44,
              top: size * 0.02,
              transform: [{ rotate: `${index * 45}deg` }, { translateY: size * 0.045 }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  absolute: {
    position: 'absolute',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.25,
  },
  gear: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: STROKE,
  },
  gearCenter: {
    width: '35%',
    height: '35%',
    borderWidth: STROKE,
  },
  gearTooth: {
    position: 'absolute',
    width: 3,
    height: 5,
    borderRadius: 1,
  },
});
