'use client';

import { use, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Copy, Plus, Swords, MoreHorizontal, Trash2, LogOut, UserMinus, Pencil, ImageIcon, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { Avatar } from '@/components/ui/avatar';
import { pickImage, compressImage, MAX_AVATAR_SIZE, AVATAR_MAX_DIM } from '@/lib/image-utils';
import { getBaseUrl, shareLink } from '@/lib/share';
import type { Challenge, ChallengeMetric } from '@/types';

const METRICS: { value: ChallengeMetric; label: string; emoji: string }[] = [
  { value: 'total_drinks', label: 'Most Drinks', emoji: '🍺' },
  { value: 'most_sessions', label: 'Most Sessions', emoji: '📅' },
  { value: 'session_duration', label: 'Longest Session', emoji: '⏱️' },
  { value: 'unique_drinks', label: 'Most Variety', emoji: '🌈' },
  { value: 'most_rounds_bought', label: 'Most Generous', emoji: '💰' },
];

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const groups = useGroupsStore((s) => s.groups);
  const allChallenges = useGroupsStore((s) => s.challenges);
  const addChallenge = useGroupsStore((s) => s.addChallenge);
  const deleteChallenge = useGroupsStore((s) => s.deleteChallenge);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const removeMember = useGroupsStore((s) => s.removeMember);
  const leaveGroup = useGroupsStore((s) => s.leaveGroup);
  const group = groups.find((g) => g.id === id);
  const challenges = allChallenges.filter((c) => c.groupId === id);
  const addToast = useUIStore((s) => s.addToast);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [showCreate, setShowCreate] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<ChallengeMetric>('total_drinks');
  const [stake, setStake] = useState('');
  const [editName, setEditName] = useState('');

  if (!group || !currentUser) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-zinc-500">Group not found</p>
      </div>
    );
  }

  const isAdmin = group.createdByUserId === currentUser.id;
  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');

  const copyInviteCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    addToast('Invite code copied!', 'success');
  };

  const shareInviteLink = async () => {
    const url = `${getBaseUrl()}/invite/${group.inviteCode}`;
    const result = await shareLink(url, `Join ${group.name} on hevydrinkr`, `Use this link to join ${group.name}`);
    if (result === 'copied') addToast('Invite link copied!', 'success');
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const challenge: Challenge = {
      id: crypto.randomUUID(), groupId: id, title: title.trim(), description: '', type: 'individual', metric,
      targetValue: null, startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'active',
      participants: group.members.map((m, i) => ({
        userId: m.userId, userName: m.userName, userAvatar: m.userAvatar, currentValue: 0, rank: i + 1,
      })),
      winnerId: null,
      wager: stake.trim() ? {
        id: crypto.randomUUID(), challengeId: '', createdByUserId: currentUser.id,
        description: stake.trim(), stake: stake.trim(),
        participants: group.members.map((m) => ({
          userId: m.userId, userName: m.userName, accepted: m.userId === currentUser.id, outcome: 'pending' as const,
        })),
      } : null,
    };
    addChallenge(challenge);
    setShowCreate(false);
    setTitle('');
    setStake('');
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteGroup = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteGroup(id);
    router.replace('/groups');
    addToast('Group deleted', 'info');
  };

  const handleLeave = () => {
    leaveGroup(id, currentUser.id);
    router.replace('/groups');
    addToast('Left group', 'info');
  };

  const handleRemoveMember = (userId: string, name: string) => {
    removeMember(id, userId);
    addToast(`Removed ${name}`, 'info');
  };

  const handleRename = () => {
    if (!editName.trim()) return;
    updateGroup(id, { name: editName.trim() });
    setShowEditName(false);
    addToast('Group renamed', 'success');
  };

  const handleChangeIcon = async () => {
    const file = await pickImage();
    if (!file) return;
    const dataUrl = await compressImage(file, MAX_AVATAR_SIZE, AVATAR_MAX_DIM);
    updateGroup(id, { iconUrl: dataUrl });
    setShowMenu(false);
    addToast('Icon updated', 'success');
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold flex-1 truncate">{group.name}</h1>
          <button onClick={() => setShowMenu(true)} className="p-1.5 -mr-1.5 rounded-lg hover:bg-white/5">
            <MoreHorizontal className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Invite code */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3.5 flex items-center justify-between">
          <button onClick={copyInviteCode} className="text-left flex-1">
            <p className="text-[10px] text-zinc-600 mb-0.5">Invite Code</p>
            <p className="text-lg font-mono font-bold tracking-wider text-accent">{group.inviteCode}</p>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={copyInviteCode} className="p-2 rounded-lg hover:bg-white/5">
              <Copy className="w-4 h-4 text-zinc-600" />
            </button>
            <button onClick={shareInviteLink} className="p-2 rounded-lg hover:bg-white/5">
              <Share2 className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>

        {/* Members */}
        <div>
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1"
          >
            Members ({group.members.length})
          </button>

          {showMembers && (
            <div className="space-y-1.5 mb-4">
              {group.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <Avatar name={m.userName} size="sm" src={m.userAvatar} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.userName}
                      {m.userId === currentUser.id && <span className="text-zinc-600 ml-1">(you)</span>}
                    </p>
                    <p className="text-[10px] text-zinc-700 capitalize">{m.role}</p>
                  </div>
                  {isAdmin && m.userId !== currentUser.id && (
                    <button
                      onClick={() => handleRemoveMember(m.userId, m.userName)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10"
                    >
                      <UserMinus className="w-4 h-4 text-zinc-600 hover:text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!showMembers && (
            <div className="flex -space-x-1.5 mb-4">
              {group.members.slice(0, 6).map((m) => (
                <div key={m.userId} className="ring-2 ring-[#09090b] rounded-full">
                  <Avatar name={m.userName} size="sm" src={m.userAvatar} />
                </div>
              ))}
              {group.members.length > 6 && (
                <div className="w-8 h-8 rounded-full bg-zinc-800 ring-2 ring-[#09090b] flex items-center justify-center text-[10px] text-zinc-400">
                  +{group.members.length - 6}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Challenges */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5" />
            Challenges
          </h3>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="w-full mb-3 p-3.5 rounded-2xl border border-dashed border-accent/20 bg-accent/[0.04] flex items-center gap-3 active:bg-accent/[0.08] transition-colors"
          >
            <Plus className="w-5 h-5 text-accent" />
            <div className="text-left">
              <p className="text-sm font-semibold text-accent">New Challenge</p>
              <p className="text-[10px] text-zinc-600">Compete with your crew</p>
            </div>
          </motion.button>

          {activeChallenges.map((ch) => (
            <ChallengeCard key={ch.id} challenge={ch} currentUserId={currentUser.id} isAdmin={isAdmin} onDelete={() => deleteChallenge(ch.id)} />
          ))}

          {completedChallenges.length > 0 && (
            <>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 mt-4">Completed</p>
              {completedChallenges.map((ch) => (
                <ChallengeCard key={ch.id} challenge={ch} currentUserId={currentUser.id} isAdmin={isAdmin} onDelete={() => deleteChallenge(ch.id)} />
              ))}
            </>
          )}

          {challenges.length === 0 && (
            <p className="text-sm text-zinc-700 text-center py-4">No challenges yet</p>
          )}
        </div>
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
              style={{ background: '#111114' }}
            >
              <div className="flex justify-center mb-3">
                <div className="w-9 h-1 rounded-full bg-white/15" />
              </div>

              {isAdmin && (
                <>
                  <button
                    onClick={() => { setShowMenu(false); setEditName(group.name); setShowEditName(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/5 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm">Rename Group</span>
                  </button>
                  <button
                    onClick={handleChangeIcon}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/5 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm">Change Icon</span>
                  </button>
                </>
              )}

              <button
                onClick={() => { setShowMenu(false); setShowMembers(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/5 transition-colors"
              >
                <UserMinus className="w-4 h-4 text-zinc-400" />
                <span className="text-sm">{isAdmin ? 'Manage Members' : 'View Members'}</span>
              </button>

              {!isAdmin && (
                <button
                  onClick={() => { setShowMenu(false); handleLeave(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/5 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm">Leave Group</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => { if (confirmDelete) { setShowMenu(false); handleDeleteGroup(); } else { setConfirmDelete(true); } }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-red-500/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{confirmDelete ? 'Tap again to confirm' : 'Delete Group'}</span>
                </button>
              )}

              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3 mt-2 rounded-xl bg-white/[0.04] text-sm text-zinc-400 font-medium"
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
              style={{ background: '#141418' }}
            >
              <h3 className="text-lg font-bold">Rename Group</h3>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white focus:outline-none focus:border-accent/40 transition-colors"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowEditName(false)} className="flex-1 py-3 rounded-xl bg-white/[0.04] text-zinc-400 font-medium text-sm">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleRename} className="flex-1 py-3 rounded-xl bg-accent text-black font-bold text-sm">Save</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Challenge modal ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowCreate(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
              style={{ background: '#111114' }}
            >
              <div>
                <h2 className="text-lg font-bold mb-0.5">New Challenge</h2>
                <p className="text-xs text-zinc-600">Everyone in the group competes</p>
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Weekend Showdown"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
              />

              <div>
                <p className="text-xs text-zinc-500 mb-2">What counts?</p>
                <div className="space-y-1.5">
                  {METRICS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMetric(m.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                        metric === m.value ? 'bg-accent/10 border border-accent/20' : 'bg-white/[0.03] border border-white/[0.05]'
                      }`}
                    >
                      <span className="text-lg">{m.emoji}</span>
                      <span className={`text-sm ${metric === m.value ? 'text-accent font-medium' : 'text-zinc-400'}`}>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-2">Wager <span className="text-zinc-700">(optional)</span></p>
                <input
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  placeholder="e.g., Loser buys pizza"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-white/[0.04] text-zinc-400 font-medium">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={!title.trim()} className="flex-1 py-3 rounded-xl bg-accent text-black font-bold disabled:opacity-20">Create</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChallengeCard({ challenge, currentUserId, isAdmin, onDelete }: {
  challenge: Challenge; currentUserId: string; isAdmin: boolean; onDelete: () => void;
}) {
  const sorted = [...challenge.participants].sort((a, b) => a.rank - b.rank);
  const isActive = challenge.status === 'active';

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 space-y-3 mb-2.5">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex-1">{challenge.title}</h4>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            isActive ? 'bg-accent/15 text-accent' : 'bg-zinc-800 text-zinc-500'
          }`}>
            {challenge.status}
          </span>
          {isAdmin && (
            <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-500/10">
              <Trash2 className="w-3.5 h-3.5 text-zinc-600 hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {challenge.wager && (
        <div className="flex items-center gap-2 text-xs bg-amber-400/[0.08] border border-amber-400/10 rounded-xl px-3 py-2">
          <span>💰</span>
          <span className="text-amber-400 font-medium">{challenge.wager.stake}</span>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div key={p.userId} className={`flex items-center gap-2.5 ${p.userId === currentUserId ? 'text-accent' : ''}`}>
            <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
              {i === 0 ? '👑' : i + 1}
            </span>
            <Avatar name={p.userName} size="sm" src={p.userAvatar} />
            <span className="text-sm flex-1 truncate">{p.userId === currentUserId ? 'You' : p.userName}</span>
            <span className="text-sm font-mono font-bold text-zinc-400">{p.currentValue}</span>
          </div>
        ))}
      </div>

      {isActive && (
        <p className="text-[10px] text-zinc-700">
          Ends {new Date(challenge.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}
    </div>
  );
}
