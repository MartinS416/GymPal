import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Card, Divider } from '@/components/card';
import { Chevron } from '@/components/chevron';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { useDatabaseState } from '@/db/database-provider';
import type { MeasurementSystem } from '@/lib/units';
import { useProfile } from '@/state/profile-context';

// No creator URL is configured in the project yet; keep the destination in one place.
const KOFI_URL = 'https://ko-fi.com/';
const UNIT_OPTIONS = [
  { value: 'metric', label: 'Metric · kg, cm' },
  { value: 'imperial', label: 'Imperial · lb, ft' },
] as const;

export default function SettingsScreen() {
  const { profile, saveProfile } = useProfile();
  const { deleteAllData } = useDatabaseState();
  const router = useRouter();
  const [savingUnits, setSavingUnits] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const changeUnits = useCallback(async (system: MeasurementSystem) => {
    if (!profile || system === profile.system || savingUnits) return;
    setSavingUnits(true);
    setError(null);
    try {
      // Measurements are stored canonically, so changing units only changes
      // how values are shown and entered throughout the app.
      await saveProfile({ ...profile, system });
    } catch {
      setError('Could not save your unit preference. Please try again.');
    } finally {
      setSavingUnits(false);
    }
  }, [profile, saveProfile, savingUnits]);

  const openKoFi = useCallback(async () => {
    try {
      await Linking.openURL(KOFI_URL);
    } catch {
      Alert.alert('Could not open Ko-fi', 'Please try again later.');
    }
  }, []);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete all local data?',
      'This permanently removes your profile, plans and workout history from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            void deleteAllData()
              .then(() => router.replace('/onboarding'))
              .catch(() => Alert.alert('Could not delete data', 'Your data is still on this device. Please try again.'))
              .finally(() => setDeleting(false));
          },
        },
      ]
    );
  }, [deleteAllData, router]);

  return (
    <Screen bottomInset={0}>
      <ScreenHeader title="Settings" subtitle="Make GymPal work the way you do." />

      <View style={styles.section}>
        <Text variant="eyebrow">PREFERENCES</Text>
        <Card>
          <Text variant="subheading">Measurement units</Text>
          <Text variant="caption" tone="textSecondary" style={styles.description}>
            Used for weights, body measurements and exercise targets.
          </Text>
          <View style={styles.control}>
            <SegmentedControl
              options={[...UNIT_OPTIONS]}
              value={profile?.system ?? 'metric'}
              onChange={(value) => void changeUnits(value)}
              label="Measurement units"
              testID="settings-units"
            />
          </View>
          {savingUnits ? <Text variant="caption" tone="textSecondary">Saving…</Text> : null}
          {error ? <Text variant="caption" tone="danger" accessibilityRole="alert">{error}</Text> : null}
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="eyebrow">YOUR DATA</Text>
        <Card flush>
          <SettingsRow
            title="Privacy & local data"
            subtitle="Learn how your information is stored"
            onPress={() => router.push('/privacy')}
            testID="settings-privacy"
          />
          <Divider style={styles.rowDivider} />
          <SettingsRow
            title="Delete all local data"
            subtitle="Permanently remove your profile, plans and workout history"
            destructive
            onPress={confirmDelete}
            disabled={deleting}
            testID="settings-delete-data"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="eyebrow">SUPPORT</Text>
        <Card flush>
          <SettingsRow
            title="Support GymPal on Ko-fi"
            subtitle="If GymPal helps your training, you can support its development."
            onPress={() => void openKoFi()}
            testID="settings-kofi"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="eyebrow">ABOUT</Text>
        <Card>
          <View style={styles.aboutHeader}>
            <Text variant="heading">GymPal</Text>
            <Text variant="caption" tone="textSecondary">Version {version}</Text>
          </View>
          <Text variant="caption" tone="textSecondary" style={styles.aboutCopy}>
            A free, offline-first workout tracker. No account, subscription or internet connection is required. Your training data stays on this device.
          </Text>
          <Text variant="caption" tone="textTertiary" style={styles.maker}>
            A SkachCorp product
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

function SettingsRow({
  title,
  subtitle,
  destructive = false,
  disabled = false,
  onPress,
  testID,
}: {
  title: string;
  subtitle: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      <View style={styles.rowText}>
        <Text variant="bodyStrong" tone={destructive ? 'danger' : 'text'}>{title}</Text>
        <Text variant="caption" tone="textSecondary">{subtitle}</Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  description: {
    marginTop: spacing.xs,
  },
  control: {
    marginTop: spacing.base,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowDivider: {
    marginLeft: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  aboutCopy: {
    marginTop: spacing.sm,
  },
  maker: {
    marginTop: spacing.md,
  },
});
