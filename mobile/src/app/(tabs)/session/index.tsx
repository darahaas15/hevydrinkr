import { useSessionStore } from '@/stores/use-session-store';
import { ActiveSession } from '~/features/session/active-session';
import { StartSession } from '~/features/session/start-session';
import { useSessionHistory } from '~/features/session/use-session-history';

/** The Sesh tab: start a session, or the one in progress. */
export default function SessionScreen() {
  const loadingHistory = useSessionHistory();
  const hasActiveSession = useSessionStore((s) => !!s.activeSession);
  return hasActiveSession ? <ActiveSession /> : <StartSession loadingHistory={loadingHistory} />;
}
