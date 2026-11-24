import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

export type BrandHeaderProps = {
  /** Hides the product name, keeping only the maker line. */
  productOnly?: boolean;
};

/**
 * The signature masthead used on every screen.
 *
 * "A SkachCorp Product" sits above "GymPal" — small maker line, large product
 * name. The contrast between the two establishes the hierarchy for the rest of
 * the interface.
 */
export function BrandHeader({ productOnly = false }: BrandHeaderProps) {
  return (
    <View style={styles.container}>
      <Text variant="eyebrow">A SkachCorp Product</Text>
      {productOnly ? null : <Text variant="display" style={styles.title}>
        GymPal
      </Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
  },
});
