import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';
import type { DatabaseError } from '@/db';

export type DatabaseErrorScreenProps = {
  error: DatabaseError | null;
  onRetry: () => void;
  onDeleteAllData: () => Promise<void>;
};

/**
 * Shown when the local database cannot be opened.
 *
 * The app stops here rather than starting again with an empty database, so
 * data that cannot be read is never overwritten by accident.
 */
export function DatabaseErrorScreen({
  error,
  onRetry,
  onDeleteAllData,
}: DatabaseErrorScreenProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A binary without SQLCipher cannot be fixed from the app: the data is
  // untouched and deleting it would only lose it. Point at the rebuild.
  const binaryProblem = error?.code === 'ENCRYPTION_UNAVAILABLE';

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await onDeleteAllData();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.content}>
        <Text variant="eyebrow">GymPal</Text>
        <Text variant="title" style={styles.title}>
          {error?.title ?? 'Something went wrong'}
        </Text>
        <Text variant="body" tone="textSecondary" style={styles.message}>
          {error?.userMessage ??
            'GymPal could not open its local database on this device.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Try again" onPress={onRetry} testID="database-retry" />

        {binaryProblem ? (
          <Text variant="caption" tone="textSecondary" style={styles.warning}>
            Rebuild the app with SQLCipher enabled: npx expo prebuild --clean, then npx expo
            run:ios or npx expo run:android.
          </Text>
        ) : (
          <View style={styles.secondaryActions}>
            {confirming ? (
              <Text variant="caption" style={styles.warning}>
                This permanently removes every workout, plan and measurement stored on this
                device. It cannot be undone.
              </Text>
            ) : null}
            <Button
              label={confirming ? 'Confirm deletion' : 'Delete all local data'}
              variant="secondary"
              loading={deleting}
              onPress={handleDelete}
              testID="database-delete-data"
            />
            {confirming ? (
              <Button label="Keep my data" variant="ghost" onPress={() => setConfirming(false)} />
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    marginTop: spacing.xxs,
  },
  message: {
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: spacing.xxxl,
    gap: spacing.base,
  },
  secondaryActions: {
    gap: spacing.sm,
  },
  warning: {
    marginBottom: spacing.xs,
  },
});
