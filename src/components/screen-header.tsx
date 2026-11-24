import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

/**
 * Title block for the tab screens.
 *
 * The tab bar already identifies the app, so these screens lead straight into
 * their subject with a title and a single supporting line.
 */
export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <Text variant="title">{title}</Text>
      {subtitle ? (
        <Text variant="body" tone="textSecondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
});
