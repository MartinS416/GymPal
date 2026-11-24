import type { MeasurementSystem } from '@/lib/units';
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  parseNumeric,
} from '@/lib/units';

/** The profile the app works with internally. Always canonical units. */
export type Profile = {
  name: string;
  heightCm: number;
  weightKg: number;
  system: MeasurementSystem;
};

/** Raw, still-string values held by the onboarding form. */
export type ProfileFormValues = {
  name: string;
  system: MeasurementSystem;
  /** Height in centimetres (metric). */
  heightCm: string;
  /** Height in feet (imperial). */
  heightFeet: string;
  /** Height in inches (imperial). */
  heightInches: string;
  /** Weight in kilograms (metric) or pounds (imperial). */
  weight: string;
};

export type ProfileFormErrors = {
  name?: string;
  height?: string;
  weight?: string;
};

/**
 * Plausible ranges for an adult.
 *
 * These are deliberately generous: the goal is to catch typos, not to police
 * the user's body.
 */
export const LIMITS = {
  cm: { min: 100, max: 250 },
  kg: { min: 25, max: 300 },
  lb: { min: 55, max: 660 },
  feet: { min: 3, max: 8 },
  inches: { min: 0, max: 11 },
} as const;

export const emptyProfileForm: ProfileFormValues = {
  name: '',
  system: 'metric',
  heightCm: '',
  heightFeet: '',
  heightInches: '',
  weight: '',
};

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Validates the onboarding form.
 *
 * Returns a map of field name to message. An empty object means the form is
 * ready to submit.
 */
export function validateProfile(values: ProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  const name = values.name.trim();
  if (isBlank(values.name)) {
    errors.name = 'Enter your name';
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (name.length > 40) {
    errors.name = 'Name must be 40 characters or fewer';
  }

  if (values.system === 'metric') {
    const cm = parseNumeric(values.heightCm);
    if (cm === null) {
      errors.height = 'Enter your height';
    } else if (cm < LIMITS.cm.min || cm > LIMITS.cm.max) {
      errors.height = `Height must be between ${LIMITS.cm.min} and ${LIMITS.cm.max} cm`;
    }

    const kg = parseNumeric(values.weight);
    if (kg === null) {
      errors.weight = 'Enter your weight';
    } else if (kg < LIMITS.kg.min || kg > LIMITS.kg.max) {
      errors.weight = `Weight must be between ${LIMITS.kg.min} and ${LIMITS.kg.max} kg`;
    }
  } else {
    const feet = parseNumeric(values.heightFeet);
    const inches = parseNumeric(values.heightInches);

    if (feet === null) {
      errors.height = 'Enter your height';
    } else if (feet < LIMITS.feet.min || feet > LIMITS.feet.max) {
      errors.height = `Height must be between ${LIMITS.feet.min} and ${LIMITS.feet.max} ft`;
    } else if (inches !== null && (inches < LIMITS.inches.min || inches > LIMITS.inches.max)) {
      errors.height = `Inches must be between ${LIMITS.inches.min} and ${LIMITS.inches.max}`;
    } else if (feet !== null && inches !== null) {
      const cm = feetInchesToCm(feet, inches);
      if (cm < LIMITS.cm.min || cm > LIMITS.cm.max) {
        errors.height = `Height must be between ${LIMITS.cm.min} and ${LIMITS.cm.max} cm`;
      }
    }

    const lb = parseNumeric(values.weight);
    if (lb === null) {
      errors.weight = 'Enter your weight';
    } else if (lb < LIMITS.lb.min || lb > LIMITS.lb.max) {
      errors.weight = `Weight must be between ${LIMITS.lb.min} and ${LIMITS.lb.max} lb`;
    }
  }

  return errors;
}

export function hasErrors(errors: ProfileFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Converts validated form values into the canonical profile.
 *
 * Returns `null` when the values are not valid, so callers must validate
 * first.
 */
export function toProfile(values: ProfileFormValues): Profile | null {
  if (hasErrors(validateProfile(values))) {
    return null;
  }

  const name = values.name.trim();
  if (values.system === 'metric') {
    const heightCm = parseNumeric(values.heightCm);
    const weightKg = parseNumeric(values.weight);
    if (heightCm === null || weightKg === null) {
      return null;
    }
    return { name, heightCm, weightKg, system: 'metric' };
  }

  const feet = parseNumeric(values.heightFeet) ?? 0;
  const inches = parseNumeric(values.heightInches) ?? 0;
  const lb = parseNumeric(values.weight);
  if (lb === null) {
    return null;
  }
  return {
    name,
    heightCm: feetInchesToCm(feet, inches),
    weightKg: lbToKg(lb),
    system: 'imperial',
  };
}

/**
 * Rewrites the entered values into a different measurement system.
 *
 * Switching units mid-form keeps whatever the user has already typed instead
 * of clearing the form.
 */
export function convertUnits(
  values: ProfileFormValues,
  next: MeasurementSystem
): ProfileFormValues {
  if (next === values.system) {
    return values;
  }

  if (values.system === 'metric') {
    const cm = parseNumeric(values.heightCm);
    const kg = parseNumeric(values.weight);
    const imperial = cm !== null ? cmToFeetInches(cm) : null;
    return {
      ...values,
      system: next,
      heightCm: '',
      heightFeet: imperial ? String(imperial.feet) : '',
      heightInches: imperial ? String(imperial.inches) : '',
      weight: kg !== null ? String(Math.round(kgToLb(kg))) : '',
    };
  }

  const feet = parseNumeric(values.heightFeet) ?? 0;
  const inches = parseNumeric(values.heightInches) ?? 0;
  const lb = parseNumeric(values.weight);
  const hasHeight = values.heightFeet.trim() !== '' || values.heightInches.trim() !== '';

  return {
    ...values,
    system: next,
    heightFeet: '',
    heightInches: '',
    heightCm: hasHeight ? String(Math.round(feetInchesToCm(feet, inches))) : '',
    weight: lb !== null ? String(Math.round(lbToKg(lb) * 10) / 10) : '',
  };
}

/** Converts a canonical profile back into the form's current unit system. */
export function profileToForm(profile: Profile): ProfileFormValues {  if (profile.system === 'metric') {
    return {
      name: profile.name,
      system: 'metric',
      heightCm: String(Math.round(profile.heightCm)),
      heightFeet: '',
      heightInches: '',
      weight: String(Math.round(profile.weightKg * 10) / 10),
    };
  }

  const totalInches = profile.heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return {
    name: profile.name,
    system: 'imperial',
    heightCm: '',
    heightFeet: String(feet),
    heightInches: String(inches),
    weight: String(Math.round(kgToLb(profile.weightKg))),
  };
}
