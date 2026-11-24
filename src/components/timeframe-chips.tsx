import { ChipRow } from '@/components/chip-row';
import { TIMEFRAMES, type Timeframe } from '@/workouts/progress';

export type TimeframeChipsProps = {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
  label?: string;
  testID?: string;
};

/**
 * The range picker above a chart.
 *
 * Six ranges, always all visible on a phone. The selection is the inverted
 * chip, the same language the primary button uses.
 */
export function TimeframeChips({
  value,
  onChange,
  label = 'Time range',
  testID,
}: TimeframeChipsProps) {
  return (
    <ChipRow
      options={TIMEFRAMES}
      value={value}
      onChange={onChange}
      label={label}
      testID={testID}
      testIDPrefix="timeframe"
    />
  );
}
