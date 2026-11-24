import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';

export type WidgetProps = {
  /** Optional eyebrow label above the content. */
  title?: string;
  children: React.ReactNode;
};

/**
 * Shared shell for the home screen widgets.
 *
 * Keeps every widget visually consistent (spacing, typography) so new widgets
 * can be dropped in without re-inventing the chrome. Add a new widget by
 * composing it inside this shell.
 */
export function Widget({ title, children }: WidgetProps) {
  return (
    <View style={styles.container}>
      {title ? <Text variant="eyebrow" style={styles.title}>{title}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  title: {
    marginBottom: spacing.xs,
  },
  body: {
    gap: spacing.sm,
  },
});
