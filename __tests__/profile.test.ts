import {
  convertUnits,
  emptyProfileForm,
  hasErrors,
  profileToForm,
  toProfile,
  validateProfile,
  type ProfileFormValues,
} from '@/lib/profile';
import { cmToFeetInches, feetInchesToCm, formatHeight, formatWeight, kgToLb } from '@/lib/units';

function form(overrides: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return { ...emptyProfileForm, ...overrides };
}

describe('measurement helpers', () => {
  it('round-trips between centimetres and feet/inches', () => {
    const { feet, inches } = cmToFeetInches(180);
    expect(feet).toBe(5);
    expect(inches).toBe(11);
    expect(Math.round(feetInchesToCm(5, 11))).toBe(180);
  });

  it('formats height and weight in the requested system', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm');
    expect(formatHeight(180, 'imperial')).toBe('5\'11"');
    expect(formatWeight(80, 'metric')).toBe('80 kg');
    expect(formatWeight(80, 'imperial')).toBe('176 lb');
  });

  it('converts kilograms to pounds', () => {
    expect(Math.round(kgToLb(100))).toBe(220);
  });
});

describe('profile validation', () => {
  it('accepts a complete metric profile', () => {
    const values = form({ name: 'Alex Carter', heightCm: '180', weight: '80' });
    expect(hasErrors(validateProfile(values))).toBe(false);
  });

  it('requires a name, a height and a weight', () => {
    const errors = validateProfile(form());
    expect(errors.name).toBe('Enter your name');
    expect(errors.height).toBe('Enter your height');
    expect(errors.weight).toBe('Enter your weight');
  });

  it('rejects a name that is too short', () => {
    expect(validateProfile(form({ name: 'A' })).name).toBe(
      'Name must be at least 2 characters'
    );
  });

  it('rejects heights and weights outside a reasonable range', () => {
    const errors = validateProfile(form({ name: 'Alex', heightCm: '90', weight: '400' }));
    expect(errors.height).toBe('Height must be between 100 and 250 cm');
    expect(errors.weight).toBe('Weight must be between 25 and 300 kg');
  });

  it('validates imperial input', () => {
    const errors = validateProfile(
      form({
        name: 'Alex',
        system: 'imperial',
        heightFeet: '5',
        heightInches: '20',
        weight: '80',
      })
    );
    expect(errors.height).toBe('Inches must be between 0 and 11');

    const valid = validateProfile(
      form({
        name: 'Alex',
        system: 'imperial',
        heightFeet: '5',
        heightInches: '11',
        weight: '176',
      })
    );
    expect(hasErrors(valid)).toBe(false);
  });
});

describe('profile conversion', () => {
  it('stores a canonical profile in centimetres and kilograms', () => {
    const profile = toProfile(
      form({ name: 'Alex', system: 'imperial', heightFeet: '5', heightInches: '11', weight: '176' })
    );
    expect(profile).not.toBeNull();
    expect(Math.round(profile!.heightCm)).toBe(180);
    expect(Math.round(profile!.weightKg)).toBe(80);
    expect(profile!.name).toBe('Alex');
  });

  it('returns null for an invalid profile', () => {
    expect(toProfile(form({ name: '' }))).toBeNull();
  });

  it('keeps the entered values when switching unit system', () => {
    const converted = convertUnits(form({ heightCm: '180', weight: '80' }), 'imperial');
    expect(converted.heightFeet).toBe('5');
    expect(converted.heightInches).toBe('11');
    expect(converted.weight).toBe('176');

    const back = convertUnits(converted, 'metric');
    expect(back.heightCm).toBe('180');
    expect(back.weight).toBe('79.8');
  });

  it('rebuilds the form from a stored profile', () => {
    const values = profileToForm({
      name: 'Alex',
      heightCm: 180,
      weightKg: 80,
      system: 'metric',
    });
    expect(values.heightCm).toBe('180');
    expect(values.weight).toBe('80');
  });
});
