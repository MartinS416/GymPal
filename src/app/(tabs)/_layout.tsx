import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { TabBar } from '@/components/tab-bar';
import { colors } from '@/constants/theme';
import { useProfile } from '@/state/profile-context';

/**
 * Bottom tabs.
 *
 * Destinations: home, workout history, progress and settings. GymPal draws
 * its own tab bar so it matches the monochrome interface exactly.
 */
export default function TabsLayout() {
  const { status, profile } = useProfile();

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarAccessibilityLabel: 'Workout history',
          tabBarButtonTestID: 'tab-history',
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarAccessibilityLabel: 'Progress',
          tabBarButtonTestID: 'tab-progress',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          // Keep Settings in the visible tab set when using the custom tab bar.
          href: '/settings',
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarButtonTestID: 'tab-settings',
        }}
      />
    </Tabs>
  );
}
