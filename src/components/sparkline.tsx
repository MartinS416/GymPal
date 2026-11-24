import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { sparklinePath } from '@/workouts/progress';

export type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  testID?: string;
};

/**
 * The shape of a series, with no axes and no labels.
 *
 * On a dashboard card it is a hint — enough to tell a rise from a fall at a
 * glance — so the latest value is the only thing marked.
 */
export function Sparkline({
  values,
  width = 92,
  height = 40,
  color = colors.text,
  testID,
}: SparklineProps) {
  const { line, area, last } = sparklinePath(values, width, height);

  if (!last) {
    return <View style={{ width, height }} testID={testID} />;
  }

  return (
    <Svg width={width} height={height} testID={testID}>
      {area ? <Path d={area} fill="rgba(0, 0, 0, 0.06)" /> : null}
      {line ? (
        <Path
          d={line}
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
      <Circle cx={last.x} cy={last.y} r={2.6} fill={color} />
    </Svg>
  );
}
