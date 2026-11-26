import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { colors } from '@/constants/theme';
import { DatabaseProvider } from '@/db/database-provider';
import { ProfileProvider } from '@/state/profile-context';

/**
 * Root layout.
 *
 * Shows the GymPal launch loading screen with the barbell and loaded plates
 * before transitioning to the unlocked, encrypted database and app views.
 */
export default function RootLayout() {
  const [launching, setLaunching] = useState(process.env.NODE_ENV !== 'test');

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const timer = setTimeout(() => {
      setLaunching(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (launching) {
    return <LoadingScreen label="Starting GymPal…" />;
  }

  return (
    <DatabaseProvider>
      <ProfileProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="start" />
          <Stack.Screen name="plans" />
          <Stack.Screen name="plans/[planId]" />
          <Stack.Screen name="workouts/index" />
          <Stack.Screen name="workouts/[workoutId]" />
          <Stack.Screen name="progress/[metricKey]" />
          {/*
            The session owns horizontal swipes: they move between rest and
            activity. The platform back gesture would steal them, so it is off.
          */}
          <Stack.Screen
            name="session/[sessionId]"
            options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
          />
          <Stack.Screen name="sessions/[sessionId]" />
          <Stack.Screen name="privacy" />
        </Stack>
      </ProfileProvider>
    </DatabaseProvider>
  );
}
