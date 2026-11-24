import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chevron } from '@/components/chevron';
import { Button } from '@/components/button';
import { Divider } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { spacing } from '@/constants/theme';
import { useDatabaseState } from '@/db/database-provider';
import { isUnencryptedDevBuild, supportsEncryption } from '@/db/platform';

/**
 * Privacy and local data.
 *
 * Explains what is stored on the device, what the encryption does and does
 * not protect against, and offers the only way to remove the local data.
 */
export default function PrivacyScreen() {
  const router = useRouter();
  const { deleteAllData } = useDatabaseState();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteAllData();
      // The profile is gone, so the app returns to onboarding.
      router.replace('/onboarding');
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed ? styles.backPressed : null]}
        testID="privacy-back">
        <Chevron direction="left" size={8} color="text" />
        <Text variant="subheading">Back</Text>
      </Pressable>

      <View style={styles.content}>
        <Text variant="eyebrow">GymPal</Text>
        <Text variant="title" style={styles.title}>
          Your data stays here
        </Text>
        <Text variant="body" tone="textSecondary" style={styles.lead}>
          {supportsEncryption
            ? 'GymPal has no account, no server and no sync. Everything you enter is written to an encrypted database on this device and never leaves it.'
            : isUnencryptedDevBuild
              ? 'GymPal has no account, no server and no sync. Everything you enter stays on this device, but this development run stores it without encryption.'
              : 'GymPal has no account, no server and no sync. Everything you enter stays in this browser and is never sent anywhere.'}
        </Text>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.sections}>
        {supportsEncryption ? (
          <Section
            title="How it is stored"
            body="Your measurements, plans and logged sets live in a local SQLite database. The database file is encrypted with SQLCipher using a randomly generated 256-bit key. That key is held in the iOS Keychain, or the Android Keystore, and is never written next to the database."
          />
        ) : isUnencryptedDevBuild ? (
          <Section
            title="How it is stored"
            body="This is a development run with encryption switched off. Expo Go ships without SQLCipher, and a development build only skips it when explicitly asked. The data lives in a plain SQLite file in this app's sandbox. A development build of GymPal with SQLCipher enabled encrypts the same data on the device."
          />
        ) : (
          <Section
            title="How it is stored"
            body="This is the browser preview. The data lives in this browser's own storage, without encryption — a browser has no secure keystore and no SQLCipher. Treat it as a development copy: the iOS and Android app stores the same data in an encrypted database on the device."
          />
        )}
        <Section
          title="What encryption does not do"
          body="The database is encrypted at rest. It does not protect data while the app is open on an unlocked device, and it cannot protect anything on a rooted, jailbroken or otherwise compromised device. Anyone who can run code as you, or read the app's memory, can read the data. A device backup may also contain the encrypted file; without the key it cannot be read, and the key is excluded from backups."
        />
        <Section
          title="Recovery"
          body={
            supportsEncryption
              ? 'There is no cloud copy. If the database or the key is lost — through a device failure, a restore that does not include the keychain, or a reinstall that clears the key — the data cannot be recovered. GymPal will tell you rather than quietly starting over with an empty database.'
              : isUnencryptedDevBuild
                ? 'There is no cloud copy. Removing this development app, or clearing its data, removes this database. A development build with SQLCipher enabled uses its own encrypted database; the two do not share data.'
                : 'There is no cloud copy. If this browser’s storage is cleared, the data cannot be recovered. GymPal will tell you rather than quietly starting over with an empty database.'
          }
        />
      </View>

      <View style={styles.danger}>
        {confirming ? (
          <Text variant="caption" style={styles.warning}>
            This permanently removes your profile, every plan and every logged set from this
            device, and destroys the encryption key. It cannot be undone.
          </Text>
        ) : null}
        <Button
          label={confirming ? 'Confirm deletion' : 'Delete all local data'}
          variant="secondary"
          loading={deleting}
          onPress={handleDelete}
          testID="privacy-delete-data"
        />
        {confirming ? (
          <Button
            label="Keep my data"
            variant="ghost"
            onPress={() => setConfirming(false)}
            testID="privacy-cancel-delete"
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text variant="subheading">{title}</Text>
      <Text variant="caption" style={styles.sectionBody}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  backPressed: {
    opacity: 0.6,
  },
  content: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    marginTop: spacing.xxs,
  },
  lead: {
    marginTop: spacing.xs,
  },
  divider: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  sections: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.xs,
  },
  sectionBody: {
    marginTop: spacing.xxs,
  },
  danger: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  warning: {
    marginBottom: spacing.xs,
  },
});
