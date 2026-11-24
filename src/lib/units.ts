/**
 * Measurement helpers.
 *
 * GymPal stores a single canonical value (centimetres and kilograms) and
 * converts at the edges of the interface, so switching units never changes the
 * underlying profile.
 */

export type MeasurementSystem = 'metric' | 'imperial';

export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Trims trailing zeros so `72.50` reads as `72.5`. */
export function formatDecimal(value: number, maxDecimals = 1): string {
  const fixed = value.toFixed(maxDecimals);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function formatHeight(cm: number, system: MeasurementSystem): string {
  if (system === 'metric') {
    return `${formatDecimal(cm)} cm`;
  }
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
}

export function formatWeight(kg: number, system: MeasurementSystem): string {
  // Pounds are quoted in whole pounds, kilograms keep a decimal when it
  // carries information.
  return system === 'metric'
    ? `${formatDecimal(kg)} kg`
    : `${Math.round(kgToLb(kg))} lb`;
}

/**
 * Parses user input into a number.
 *
 * Accepts a comma as the decimal separator because iOS locales outside the US
 * commonly produce it.
 */
export function parseNumeric(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
