'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SessionForm } from '@/components/session/session-form';
import { useSessionStore } from '@/stores/use-session-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';

export default function EditSessionPage() {
  return (
    <Suspense>
      <EditSessionInner />
    </Suspense>
  );
}

function EditSessionInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const getSessionById = useSessionStore((s) => s.getSessionById);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const userPosts = useFeedStore((s) => s.userPosts);
  const fetchUserPosts = useFeedStore((s) => s.fetchUserPosts);

  const session = sessionId ? getSessionById(sessionId) : undefined;
  const feedItem =
    currentUser && sessionId
      ? (userPosts[currentUser.id] ?? []).find((f) => f.sessionId === sessionId) ?? null
      : null;

  // Hydrate stores if the user deep-linked here before state was loaded.
  useEffect(() => {
    if (!currentUser) return;
    if (!session) fetchSessions(currentUser.id);
    if (!userPosts[currentUser.id]) fetchUserPosts(currentUser.id);
  }, [currentUser, session, userPosts, fetchSessions, fetchUserPosts]);

  if (!sessionId) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-sm text-fg-secondary">No session specified</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-sm text-fg-secondary">Loading…</p>
      </div>
    );
  }

  // Only owners can edit.
  if (currentUser && session.userId !== currentUser.id) {
    router.replace(`/session?id=${sessionId}`);
    return null;
  }

  // Only completed sessions can be edited (active session has its own flow).
  if (session.status !== 'completed') {
    router.replace(`/session?id=${sessionId}`);
    return null;
  }

  return <SessionForm mode="edit" existingSession={session} existingFeedItem={feedItem} />;
}
