import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useProfile } from '@/state/profile-context';

/**
 * Entry point.
 *
 * The app opens here and is immediately routed to onboarding or to the home
 * tab, depending on whether a profile is stored in the local database.
 */
export default function IndexRoute() {
  const { status, profile } = useProfile();

  if (status === 'loading') {
    return <LoadingScreen label="Loading your profile" />;
  }

  return <Redirect href={profile ? '/(tabs)/home' : '/onboarding'} />;
}
