import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/use-auth-store';

/** Launch lands here: the feed when signed in, otherwise sign-in. */
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Redirect href={isAuthenticated ? '/feed' : '/sign-in'} />;
}
