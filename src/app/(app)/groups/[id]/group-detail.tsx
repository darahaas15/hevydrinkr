'use client';

import { use, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Copy, MoreHorizontal, Trash2, LogOut, UserMinus, Pencil, ImageIcon, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { Avatar } from '@/components/ui/avatar';
import { pickImage, uploadImage, MAX_AVATAR_SIZE, AVATAR_MAX_DIM } from '@/lib/image-utils';
import { getBaseUrl, shareLink } from '@/lib/share';
import { RoastSection } from './roast/roast-section';

export default function GroupDetailPage({ params, groupId }: { params?: Promise<{ id: string }>; groupId?: string }) {
  const resolvedId = groupId || (params ? use(params).id : '');
  const router = useRouter();
  const groups = useGroupsStore((s) => s.groups);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const removeMember = useGroupsStore((s) => s.removeMember);
  const leaveGroup = useGroupsStore((s) => s.leaveGroup);
  const fetchGroups = useGroupsStore((s) => s.fetchGroups);
  const group = groups.find((g) => g.id === resolvedId);
  const addToast = useUIStore((s) => s.addToast);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [showMenu, setShowMenu] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchGroups(currentUser.id);
    }
  }, [resolvedId, currentUser, fetchGroups]);

  if (!group || !currentUser) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-fg-secondary">Group not found</p>
      </div>
    );
  }

  const isAdmin = group.createdByUserId === currentUser.id;

  const copyInviteCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    addToast('Invite code copied!', 'success');
  };

  const shareInviteLink = async () => {
    const url = `${getBaseUrl()}/invite/${group.inviteCode}`;
    const result = await shareLink(url, `Join ${group.name} on Drinkr`, `Use this link to join ${group.name}`);
    if (result === 'copied') addToast('Invite link copied!', 'success');
  };

  const handleDeleteGroup = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteGroup(resolvedId);
    router.replace('/groups');
    addToast('Group deleted', 'info');
  };

  const handleLeave = () => {
    leaveGroup(resolvedId, currentUser.id);
    router.replace('/groups');
    addToast('Left group', 'info');
  };

  const handleRemoveMember = (userId: string, name: string) => {
    removeMember(resolvedId, userId);
    addToast(`Removed ${name}`, 'info');
  };

  const handleRename = () => {
    if (!editName.trim()) return;
    updateGroup(resolvedId, { name: editName.trim() });
    setShowEditName(false);
    addToast('Group renamed', 'success');
  };

  const handleChangeIcon = async () => {
    const file = await pickImage();
    if (!file) return;
    try {
      const url = await uploadImage(file, 'groups', MAX_AVATAR_SIZE, AVATAR_MAX_DIM);
      updateGroup(resolvedId, { iconUrl: url });
      setShowMenu(false);
      addToast('Icon updated', 'success');
    } catch {
      addToast("Couldn't upload icon", 'error');
    }
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/groups')} className="p-2 -ml-2 active:text-foreground">
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <h1 className="text-lg font-bold flex-1 truncate">{group.name}</h1>
          <button onClick={() => setShowMenu(true)} className="p-2.5 -mr-2.5 rounded-lg hover:bg-surface-subtle active:bg-surface-strong">
            <MoreHorizontal className="w-5 h-5 text-fg-secondary" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Invite code */}
        <div className="rounded-2xl bg-card border border-hairline p-3.5 flex items-center justify-between">
          <button onClick={copyInviteCode} className="text-left flex-1">
            <p className="text-[10px] text-muted mb-0.5">Invite Code</p>
            <p className="text-lg font-mono font-bold tracking-wider text-accent">{group.inviteCode}</p>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={copyInviteCode} className="p-2 rounded-lg hover:bg-surface-subtle">
              <Copy className="w-4 h-4 text-muted" />
            </button>
            <button onClick={shareInviteLink} className="p-2 rounded-lg hover:bg-surface-subtle">
              <Share2 className="w-4 h-4 text-muted" />
            </button>
          </div>
        </div>

        {/* Members */}
        <div>
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1"
          >
            Members ({group.members.length})
          </button>

          {showMembers && (
            <div className="space-y-1.5 mb-4">
              {group.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-faint border border-border-faint">
                  <div onClick={() => router.push(m.userId === currentUser.id ? '/profile' : `/profile/${m.userId}`)} className="cursor-pointer">
                    <Avatar name={m.userName} size="sm" src={m.userAvatar} />
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => router.push(m.userId === currentUser.id ? '/profile' : `/profile/${m.userId}`)}
                  >
                    <p className="text-sm font-medium truncate hover:underline">
                      {m.userName}
                      {m.userId === currentUser.id && <span className="text-muted ml-1">(you)</span>}
                    </p>
                    <p className="text-[10px] text-fg-faint capitalize">{m.role}</p>
                  </div>
                  {isAdmin && m.userId !== currentUser.id && (
                    <button
                      onClick={() => handleRemoveMember(m.userId, m.userName)}
                      className="p-2.5 rounded-lg hover:bg-red-500/10 active:bg-red-500/15"
                    >
                      <UserMinus className="w-4 h-4 text-muted active:text-danger-fg" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!showMembers && (
            <div className="flex -space-x-1.5 mb-4">
              {group.members.slice(0, 6).map((m) => (
                <div
                  key={m.userId}
                  className="ring-2 ring-background rounded-full cursor-pointer"
                  onClick={() => router.push(m.userId === currentUser.id ? '/profile' : `/profile/${m.userId}`)}
                >
                  <Avatar name={m.userName} size="sm" src={m.userAvatar} />
                </div>
              ))}
              {group.members.length > 6 && (
                <div className="w-8 h-8 rounded-full bg-chip ring-2 ring-background flex items-center justify-center text-[10px] text-muted-foreground">
                  +{group.members.length - 6}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Weekly Roundup */}
        <RoastSection groupId={resolvedId} members={group.members} />
      </div>

      {/* ── Group menu (⋯) ── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55]"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowMenu(false)} />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-w-lg mx-auto rounded-t-3xl p-5 space-y-1"
              style={{ background: 'var(--sheet-solid-bg)' }}
            >
              <div className="flex justify-center mb-3">
                <div className="w-9 h-1 rounded-full bg-[var(--grabber-bg)]" />
              </div>

              {isAdmin && (
                <>
                  <button
                    onClick={() => { setShowMenu(false); setEditName(group.name); setShowEditName(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-surface-subtle transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Rename Group</span>
                  </button>
                  <button
                    onClick={handleChangeIcon}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-surface-subtle transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Change Icon</span>
                  </button>
                </>
              )}

              <button
                onClick={() => { setShowMenu(false); setShowMembers(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-surface-subtle transition-colors"
              >
                <UserMinus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{isAdmin ? 'Manage Members' : 'View Members'}</span>
              </button>

              {!isAdmin && (
                <button
                  onClick={() => { setShowMenu(false); handleLeave(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-surface-subtle transition-colors"
                >
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Leave Group</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => { if (confirmDelete) { setShowMenu(false); handleDeleteGroup(); } else { setConfirmDelete(true); } }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-red-500/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-danger-fg" />
                  <span className="text-sm text-danger-fg">{confirmDelete ? 'Tap again to confirm' : 'Delete Group'}</span>
                </button>
              )}

              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3 mt-2 rounded-xl bg-surface-secondary text-sm text-muted-foreground font-medium"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rename modal ── */}
      <AnimatePresence>
        {showEditName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowEditName(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative rounded-3xl p-6 w-[300px] space-y-4"
              style={{ background: 'var(--popover-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <h3 className="text-lg font-bold">Rename Group</h3>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-surface-secondary border border-card-border text-foreground focus:outline-none focus:border-accent/40 transition-colors"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowEditName(false)} className="flex-1 py-3 rounded-xl bg-surface-secondary text-muted-foreground font-medium text-sm">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleRename} className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm">Save</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
