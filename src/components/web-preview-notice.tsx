import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { isWebPreview } from '@/db/platform';

/**
 * Shown in the browser preview.
 *
 * The web build has no secure keystore and no SQLCipher, so the database is
 * stored unencrypted in the browser. The app says so plainly instead of
 * pretending the data is protected.
 */
export function WebPreviewNotice() {
  if (!isWebPreview) {
    return null;
  }

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text variant="label">Browser preview</Text>
      <Text variant="caption" style={styles.body}>
        This preview stores your data unencrypted in this browser. The iOS and Android app keeps
        everything in an encrypted database on the device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.xs,
  },
  body: {
    marginTop: spacing.xxs,
  },
});
