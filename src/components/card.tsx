import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

export type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Removes the internal padding for cards that lay out their own rows. */
  flush?: boolean;
};

/** Hairline bordered container. The only container style in the app. */
export function Card({ children, style, flush = false }: CardProps) {
  return <View style={[styles.card, flush ? styles.cardFlush : null, style]}>{children}</View>;
}

export type CardSectionProps = {
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
  children?: ReactNode;
  /** Trailing content, e.g. a chevron or a chip. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Title + description + content, the standard anatomy of a home card. */
export function CardSection({
  title,
  description,
  children,
  trailing,
  style,
}: CardSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <Text variant="heading" style={styles.sectionTitle}>
          {title}
        </Text>
        {trailing}
      </View>
      {description ? (
        <Text variant="caption" style={styles.sectionDescription}>
          {description}
        </Text>
      ) : null}
      {children ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

/** Thin horizontal rule used between rows inside a card. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardFlush: {
    padding: 0,
  },
  section: {
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  sectionTitle: {
    flexShrink: 1,
  },
  sectionDescription: {
    marginTop: spacing.xs,
  },
  sectionBody: {
    marginTop: spacing.base,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
