import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { ComponentRef } from 'react';
import { useRouter } from 'expo-router';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { ProgressSteps } from '@/components/progress-steps';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { Field } from '@/components/text-input';
import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';
import {
  convertUnits,
  emptyProfileForm,
  hasErrors,
  toProfile,
  validateProfile,
  type ProfileFormErrors,
  type ProfileFormValues,
} from '@/lib/profile';
import type { MeasurementSystem } from '@/lib/units';
import { useProfile } from '@/state/profile-context';

const UNIT_OPTIONS: { value: MeasurementSystem; label: string }[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

const UNIT_HELP: Record<MeasurementSystem, string> = {
  metric: 'Height in centimetres, weight in kilograms.',
  imperial: 'Height in feet and inches, weight in pounds.',
};

const STEPS = [
  {
    title: 'What should we call you?',
    body: 'Your name greets you every time you open GymPal.',
  },
  {
    title: 'A few numbers about you',
    body: 'Height and weight let GymPal size your plans and track your progress.',
  },
] as const;

const STEP_NAME = 0;
const STEP_MEASUREMENTS = 1;
const STEP_COUNT = STEPS.length;

/**
 * Onboarding.
 *
 * A two step flow: the name first, then the measurements. Each step only
 * validates its own fields, and the answers are held in app state for now —
 * persistence lands in Stage 2.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { saveProfile, profile } = useProfile();

  const [step, setStep] = useState(STEP_NAME);
  const [values, setValues] = useState<ProfileFormValues>(emptyProfileForm);
  const [touched, setTouched] = useState<Partial<Record<keyof ProfileFormErrors, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const heightRef = useRef<ComponentRef<typeof TextInput>>(null);
  const weightRef = useRef<ComponentRef<typeof TextInput>>(null);

  const errors = useMemo(() => validateProfile(values), [values]);

  const errorFor = useCallback(
    (field: keyof ProfileFormErrors) => (touched[field] ? errors[field] : undefined),
    [errors, touched]
  );

  const update = useCallback((patch: Partial<ProfileFormValues>) => {
    setValues((previous) => ({ ...previous, ...patch }));
  }, []);

  const markTouched = useCallback((field: keyof ProfileFormErrors) => {
    setTouched((previous) => (previous[field] ? previous : { ...previous, [field]: true }));
  }, []);

  const handleSystemChange = useCallback((system: MeasurementSystem) => {
    setValues((previous) => convertUnits(previous, system));
  }, []);

  const handleNext = useCallback(() => {
    markTouched('name');
    if (errors.name) {
      return;
    }
    setStep(STEP_MEASUREMENTS);
  }, [errors.name, markTouched]);

  const handleBack = useCallback(() => {
    setStep(STEP_NAME);
  }, []);

  const handleSubmit = useCallback(async () => {
    setTouched({ name: true, height: true, weight: true });

    const nextErrors = validateProfile(values);
    if (hasErrors(nextErrors)) {
      // A missing name belongs to the first step, so send the user back to it.
      if (nextErrors.name) {
        setStep(STEP_NAME);
      }
      return;
    }

    const profile = toProfile(values);
    if (!profile) {
      return;
    }

    setSubmitting(true);
    try {
      // The profile is written to the encrypted database before the app
      // moves on, so a restart never loses it.
      await saveProfile(profile);
    } catch {
      setSubmitting(false);
      return;
    }
  }, [saveProfile, values]);

  // Navigation happens once the profile has been written to the database, so
  // the home screen never renders without a name.
  useEffect(() => {
    if (profile) {
      router.replace('/(tabs)/home');
    }
  }, [profile, router]);

  const isMetric = values.system === 'metric';

  return (
    <Screen
      scroll={false}
      footer={
        step === STEP_NAME ? (
          <Button label="Continue" onPress={handleNext} testID="onboarding-continue" />
        ) : (
          <View style={styles.footerRow}>
            <Button
              label="Back"
              variant="secondary"
              onPress={handleBack}
              style={styles.footerBack}
              testID="onboarding-back"
            />
            <Button
              label="Get Started"
              onPress={handleSubmit}
              loading={submitting}
              style={styles.footerPrimary}
              testID="onboarding-submit"
            />
          </View>
        )
      }>
      <BrandHeader />

      <ProgressSteps current={step} total={STEP_COUNT} style={styles.progress} />

      <View style={styles.intro}>
        <Text variant="heading">{STEPS[step].title}</Text>
        <Text variant="body" tone="textSecondary">
          {STEPS[step].body}
        </Text>
      </View>

      <View style={styles.form}>
        {step === STEP_NAME ? (
          <Field
            label="Name"
            value={values.name}
            onChangeText={(name) => update({ name })}
            onBlur={() => markTouched('name')}
            placeholder="Alex Carter"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
            onSubmitEditing={handleNext}
            error={errorFor('name')}
            maxLength={40}
            testID="field-name"
          />
        ) : (
          <>
            <View style={styles.units}>
              <Text variant="label" tone="textSecondary">
                Units
              </Text>
              <SegmentedControl
                options={UNIT_OPTIONS}
                value={values.system}
                onChange={handleSystemChange}
                label="Measurement units"
                testID="units"
              />
              <Text variant="caption">{UNIT_HELP[values.system]}</Text>
            </View>

            {isMetric ? (
              <Field
                label="Height"
                value={values.heightCm}
                onChangeText={(heightCm) => update({ heightCm })}
                onBlur={() => markTouched('height')}
                placeholder="180"
                suffix="cm"
                keyboardType="decimal-pad"
                error={errorFor('height')}
                inputRef={heightRef}
                testID="field-height"
              />
            ) : (
              <View style={styles.heightRow}>
                <Field
                  label="Feet"
                  value={values.heightFeet}
                  onChangeText={(heightFeet) => update({ heightFeet })}
                  onBlur={() => markTouched('height')}
                  placeholder="5"
                  suffix="ft"
                  keyboardType="number-pad"
                  invalid={Boolean(errorFor('height'))}
                  inputRef={heightRef}
                  style={styles.heightField}
                  testID="field-height-feet"
                />
                <Field
                  label="Inches"
                  value={values.heightInches}
                  onChangeText={(heightInches) => update({ heightInches })}
                  onBlur={() => markTouched('height')}
                  placeholder="11"
                  suffix="in"
                  keyboardType="number-pad"
                  error={errorFor('height')}
                  inputRef={weightRef}
                  style={styles.heightField}
                  testID="field-height-inches"
                />
              </View>
            )}

            <Field
              label="Weight"
              value={values.weight}
              onChangeText={(weight) => update({ weight })}
              onBlur={() => markTouched('weight')}
              placeholder={isMetric ? '80' : '176'}
              suffix={isMetric ? 'kg' : 'lb'}
              keyboardType="decimal-pad"
              error={errorFor('weight')}
              testID="field-weight"
            />
          </>
        )}
      </View>

      {step === STEP_NAME ? (
        <View style={styles.footnote}>
          <Text variant="caption">
            No account needed. GymPal works offline and never sends your details anywhere.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    marginTop: spacing.xxl,
  },
  intro: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.xl,
  },
  units: {
    gap: spacing.sm,
  },
  heightRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  heightField: {
    flex: 1,
  },
  footnote: {
    marginTop: spacing.xxl,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  footerBack: {
    flexGrow: 0,
    flexBasis: 96,
  },
  footerPrimary: {
    flex: 1,
  },
});
