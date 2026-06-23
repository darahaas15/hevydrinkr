'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Link2, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { GroupCard } from '@/components/groups/group-card';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import GroupDetailPage from './[id]/group-detail';
import type { Group, GroupMember } from '@/types';

export default function GroupsPage() {
  return (
    <Suspense>
      <GroupsPageInner />
    </Suspense>
  );
}

function GroupsPageInner() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get('id');

  if (groupId) {
    return <GroupDetailPage groupId={groupId} />;
  }

  return <GroupsPageList />;
}

function GroupsPageList() {
  const groups = useGroupsStore((s) => s.groups);
  const loading = useGroupsStore((s) => s.loading);
  const addGroup = useGroupsStore((s) => s.addGroup);
  const fetchGroups = useGroupsStore((s) => s.fetchGroups);
  const joinGroup = useGroupsStore((s) => s.joinGroup);
  const addToast = useUIStore((s) => s.addToast);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [emoji] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleRefresh = useCallback(async () => {
    if (currentUser) await fetchGroups(currentUser.id, true);
  }, [currentUser, fetchGroups]);

  useEffect(() => {
    if (currentUser) fetchGroups(currentUser.id);
    const refetch = () => { if (currentUser) fetchGroups(currentUser.id, true); };
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const myGroups = groups.filter((g) =>
    g.members.some((m) => m.userId === currentUser?.id)
  );

  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !currentUser || creating) return;
    setCreating(true);

    const member: GroupMember = {
      userId: currentUser.id,
      userName: currentUser.displayName,
      userAvatar: currentUser.avatarUrl,
      role: 'admin',
      joinedAt: new Date().toISOString(),
    };

    const group: Group = {
      id: crypto.randomUUID(),
      name: name.trim(),
      emoji,
      description: description.trim(),
      createdByUserId: currentUser.id,
      members: [member],
      iconUrl: null,
      inviteCode: crypto.randomUUID().slice(0, 6).toUpperCase(),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    await addGroup(group);
    setCreating(false);
    setShowCreate(false);
    setName('');
    setDescription('');
  };

  const handleJoin = async () => {
    if (!inviteCode.trim() || !currentUser) return;

    const member: GroupMember = {
      userId: currentUser.id,
      userName: currentUser.displayName,
      userAvatar: currentUser.avatarUrl,
      role: 'member',
      joinedAt: new Date().toISOString(),
    };

    const success = await joinGroup(inviteCode.trim().toUpperCase(), member);
    if (success) {
      setShowJoin(false);
      setInviteCode('');
      addToast('Joined group!', 'success');
    } else {
      addToast('Invalid invite code', 'error');
    }
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Groups</h1>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowJoin(true)}
              aria-label="Join group"
              className="p-2.5 rounded-xl bg-surface-secondary border border-card-border"
            >
              <Link2 className="w-5 h-5 text-muted-foreground" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreate(true)}
              aria-label="Create group"
              className="p-2.5 rounded-xl bg-accent"
            >
              <Plus className="w-5 h-5 text-accent-foreground" />
            </motion.button>
          </div>
        </div>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-4 py-4">
        {loading && myGroups.length === 0 ? (
          /* Skeleton placeholders while loading */
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-hairline p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-subtle" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-surface-subtle" />
                    <div className="h-3 w-48 rounded bg-surface-subtle" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3 w-20 rounded bg-surface-subtle" />
                  <div className="h-3 w-24 rounded bg-surface-subtle" />
                </div>
              </div>
            ))}
          </div>
        ) : myGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-fg-strong mb-2">No groups yet</h3>
            <p className="text-sm text-fg-secondary max-w-xs">
              Create a group for your crew or join one with an invite code
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myGroups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GroupCard group={group} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
      </PullToRefresh>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl p-6 space-y-5" style={{background: 'var(--popover-strong-bg)'}}
            >
              <h2 className="text-lg font-bold">Create Group</h2>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                className="w-full px-4 py-3 rounded-xl bg-surface-secondary border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />

              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-4 py-3 rounded-xl bg-surface-secondary border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl glass text-muted-foreground font-medium"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground font-medium disabled:opacity-20"
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Group Modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowJoin(false)} />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl p-6 space-y-5" style={{background: 'var(--popover-strong-bg)'}}
            >
              <h2 className="text-lg font-bold">Join Group</h2>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-secondary" />
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter invite code"
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-secondary border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors uppercase font-mono tracking-wider"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoin(false)}
                  className="flex-1 py-3 rounded-xl glass text-muted-foreground font-medium"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleJoin}
                  disabled={!inviteCode.trim()}
                  className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground font-medium disabled:opacity-20"
                >
                  Join
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
