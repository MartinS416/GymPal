import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';

import { colors } from '@/constants/theme';

/** How rounded the glow is, so it follows the screen corners. */
const GLOW_RADIUS = 44;

/** Angular size of one wedge of the conic gradient. */
const WEDGE_DEGREES = 4;

/** A hair of overlap, so neighbouring wedges never show a seam. */
const WEDGE_OVERLAP = 0.4;

/**
 * The halo, as concentric strokes: wide and faint at the inside, narrowing to
 * the crisp edge. The strokes overlap, so their opacities build a smooth
 * fall-off away from the screen edge.
 */
const BANDS = [
  { width: 40, opacity: 0.025 },
  { width: 28, opacity: 0.04 },
  { width: 18, opacity: 0.06 },
  { width: 11, opacity: 0.1 },
  { width: 6, opacity: 0.16 },
  { width: 3, opacity: 0.32 },
  { width: 1.75, opacity: 0.9 },
] as const;

/**
 * The four-stop gradient from `edge-glow.html`. The first colour is repeated at
 * the end, so the loop has no seam.
 */
const STOPS: readonly { angle: number; color: string }[] = [
  { angle: 0, color: colors.successBright },
  { angle: 84, color: colors.success },
  { angle: 168, color: colors.successCool },
  { angle: 252, color: colors.successDeep },
  { angle: 360, color: colors.successBright },
];

const MASK_ID = 'new-exercise-glow-band';

type Wedge = { key: number; d: string; fill: string };

/**
 * A steady green glow around the edge of the screen, played once when a new
 * exercise starts.
 *
 * The edge is a four-green conic gradient masked down to a rounded border: the
 * colour hugs the screen and fades inward through a soft halo. There is no
 * pulsing and nothing travels around the screen — only the glow's opacity
 * rises and falls once, so it reads as ambient light rather than a blinking
 * notification. Everything is static SVG, so it never blocks the workout.
 */
export function NewExerciseGlow({ trigger }: { trigger: string | null }) {
  const { width, height } = useWindowDimensions();
  const [opacity] = useState(() => new Animated.Value(0));
  const wedges = useMemo(() => buildWedges(width, height), [width, height]);

  useEffect(() => {
    if (!trigger) {
      opacity.setValue(0);
      return;
    }

    opacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 700,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [opacity, trigger]);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { opacity }]}>
      {trigger ? (
        <Svg width={width} height={height}>
          <Defs>
            <Mask
              id={MASK_ID}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={width}
              height={height}>
              {BANDS.map((band) => (
                <Rect
                  key={band.width}
                  x={band.width / 2}
                  y={band.width / 2}
                  width={Math.max(0, width - band.width)}
                  height={Math.max(0, height - band.width)}
                  rx={Math.max(0, GLOW_RADIUS - band.width / 2)}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={band.width}
                  opacity={band.opacity}
                />
              ))}
            </Mask>
          </Defs>

          <G mask={`url(#${MASK_ID})`}>
            {wedges.map((wedge) => (
              <Path key={wedge.key} d={wedge.d} fill={wedge.fill} />
            ))}
          </G>
        </Svg>
      ) : null}
    </Animated.View>
  );
}

/**
 * Builds the conic gradient out of thin wedges around the screen centre.
 *
 * SVG has no conic gradient, so the colour at each angle is interpolated by
 * hand and painted into its own wedge. The mask decides which wedges are
 * visible; the paint itself is a plain radial fan, exactly like the CSS
 * `conic-gradient(from 0deg, ...)` in the prototype.
 */
function buildWedges(width: number, height: number): Wedge[] {
  const centreX = width / 2;
  const centreY = height / 2;
  const radius = Math.hypot(width, height) / 2 + 8;
  const wedges: Wedge[] = [];

  for (let angle = 0; angle < 360; angle += WEDGE_DEGREES) {
    const start = toRadians(angle);
    const end = toRadians(angle + WEDGE_DEGREES + WEDGE_OVERLAP);
    const x1 = centreX + radius * Math.sin(start);
    const y1 = centreY - radius * Math.cos(start);
    const x2 = centreX + radius * Math.sin(end);
    const y2 = centreY - radius * Math.cos(end);

    wedges.push({
      key: angle,
      d: `M${centreX} ${centreY} L${round(x1)} ${round(y1)} A${round(radius)} ${round(radius)} 0 0 1 ${round(x2)} ${round(y2)} Z`,
      fill: colorAt(angle + WEDGE_DEGREES / 2),
    });
  }

  return wedges;
}

/** The gradient colour at a clockwise angle from the top of the screen. */
function colorAt(angle: number): string {
  const normalized = ((angle % 360) + 360) % 360;

  for (let index = 1; index < STOPS.length; index += 1) {
    const previous = STOPS[index - 1];
    const next = STOPS[index];
    if (!previous || !next) {
      break;
    }
    if (normalized <= next.angle) {
      const span = next.angle - previous.angle;
      return mixHex(previous.color, next.color, span === 0 ? 0 : (normalized - previous.angle) / span);
    }
  }

  return STOPS[0]?.color ?? colors.successBright;
}

function mixHex(from: string, to: string, amount: number): string {
  const start = rgb(from);
  const end = rgb(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return `rgb(${channel(start[0], end[0])}, ${channel(start[1], end[1])}, ${channel(start[2], end[2])})`;
}

function rgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
