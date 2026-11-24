import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { Button } from '@/components/button';

import { Chevron } from '@/components/chevron';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useDatabase } from '@/db/database-provider';
import type { Plan } from '@/db/repositories/plans';
import { useAsyncData } from '@/hooks/use-async-data';
import { SPLIT_TEMPLATES } from '@/workouts/templates';
import { useProfile } from '@/state/profile-context';

function splitLabel(splitType: Plan['splitType']): string {
  return (
    SPLIT_TEMPLATES.find((template) => template.splitType === splitType)?.label ?? 'Custom'
  );
}

/**
 * The plan list.
 *
 * Every plan lives in the encrypted database, on this device.
 */
export default function PlansScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { status, profile } = useProfile();

  const loader = useCallback(() => database.listPlans(), [database]);
  const { data: plans, loading } = useAsyncData(loader);

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const items = plans ?? [];

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="My plans" subtitle="Stored on this device, encrypted" />
      </View>

      <View style={styles.list}>
        {loading ? (
          <LoadingState lines={3} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No plans yet"
            description="Build a plan and it will show up here, ready to train from."
          />
        ) : (
          items.map((plan) => (
            <Pressable
              key={plan.id}
              accessibilityRole="button"
              accessibilityLabel={`${plan.name}, ${splitLabel(plan.splitType)}, ${plan.weeklyFrequency} days a week`}
              onPress={() => router.push(`/plans/${plan.id}`)}
              style={({ pressed }) => [styles.plan, pressed ? styles.planPressed : null]}
              testID={`plan-${plan.id}`}>
              <View style={styles.planText}>
                <Text variant="subheading">{plan.name}</Text>
                <Text variant="caption">
                  {splitLabel(plan.splitType)} · {plan.weeklyFrequency} day
                  {plan.weeklyFrequency === 1 ? '' : 's'} a week
                </Text>
              </View>
              <Chevron direction="right" />
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label="New plan"
          onPress={() => router.push('/plans/new')}
          testID="plans-new"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    marginTop: spacing.xl,
  },
});
