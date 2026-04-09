'use client';

import { use, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Trophy, Beer, Calendar, Timer, Palette } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { Avatar } from '@/components/ui/avatar';
import type { Challenge, ChallengeMetric } from '@/types';

const METRICS: { value: ChallengeMetric; label: string; icon: typeof Beer }[] = [
  { value: 'total_drinks', label: 'Most Drinks', icon: Beer },
  { value: 'unique_drinks', label: 'Most Variety', icon: Palette },
  { value: 'session_duration', label: 'Longest Session', icon: Timer },
  { value: 'most_sessions', label: 'Most Sessions', icon: Calendar },
];

export default function ChallengesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const groups = useGroupsStore((s) => s.groups);
  const allChallenges = useGroupsStore((s) => s.challenges);
  const group = groups.find((g) => g.id === id);
  const challenges = allChallenges.filter((c) => c.groupId === id);
  const addChallenge = useGroupsStore((s) => s.addChallenge);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<ChallengeMetric>('total_drinks');
  const [stake, setStake] = useState('');

  if (!group) return null;

  const activeChallenges = challenges.filter((c) => c.status === 'active' || c.status === 'pending');
  const completedChallenges = challenges.filter((c) => c.status === 'completed');

  const handleCreate = () => {
    if (!title.trim() || !currentUser) return;

    const challenge: Challenge = {
      id: crypto.randomUUID(),
      groupId: id,
      title: title.trim(),
      description: '',
      type: 'individual',
      metric,
      targetValue: null,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'active',
      participants: group.members.map((m, i) => ({
        userId: m.userId,
        userName: m.userName,
        userAvatar: m.userAvatar,
        currentValue: 0,
        rank: i + 1,
      })),
      winnerId: null,
      wager: stake.trim() ? {
        id: crypto.randomUUID(),
        challengeId: '',
        createdByUserId: currentUser.id,
        description: stake.trim(),
        stake: stake.trim(),
        participants: group.members.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          accepted: m.userId === currentUser.id,
          outcome: 'pending',
        })),
      } : null,
    };

    addChallenge(challenge);
    setShowCreate(false);
    setTitle('');
    setStake('');
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1">
              <ChevronLeft className="w-6 h-6 text-zinc-400" />
            </button>
            <h1 className="text-lg font-bold">Challenges</h1>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreate(true)}
            className="p-2.5 rounded-xl bg-accent"
          >
            <Plus className="w-5 h-5 text-black" />
          </motion.button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Active Challenges */}
        <div>
          <h3 className="text-sm font-medium text-zinc-500 mb-3">Active</h3>
          {activeChallenges.length === 0 ? (
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-8 text-center">
              <Trophy className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No active challenges</p>
              <p className="text-zinc-600 text-xs mt-1">Create one to start competing!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeChallenges.map((challenge) => (
                <ChallengeDetail key={challenge.id} challenge={challenge} />
              ))}
            </div>
          )}
        </div>

        {/* Completed */}
        {completedChallenges.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-500 mb-3">Completed</h3>
            <div className="space-y-3">
              {completedChallenges.map((challenge) => (
                <ChallengeDetail key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Challenge Modal */}
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl p-6 space-y-5"
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <h2 className="text-xl font-bold text-accent font-extrabold">New Challenge</h2>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Challenge title"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
              />

              <div>
                <p className="text-xs text-zinc-500 mb-2">Metric</p>
                <div className="space-y-2">
                  {METRICS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMetric(m.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        metric === m.value ? 'bg-white/[0.04] border border-white/[0.06] ring-1 ring-accent/30' : 'bg-white/5'
                      }`}
                    >
                      <m.icon className="w-5 h-5" />
                      <span className="text-sm">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-2">Wager (optional)</p>
                <input
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  placeholder="e.g., Loser buys pizza"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-400 font-medium">
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={!title.trim()}
                  className="flex-1 py-3 rounded-xl bg-accent text-black font-medium disabled:opacity-30"
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChallengeDetail({ challenge }: { challenge: Challenge }) {
  const sorted = [...challenge.participants].sort((a, b) => a.rank - b.rank);

  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{challenge.title}</h4>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          challenge.status === 'active' ? 'bg-accent/15 text-accent' :
          challenge.status === 'completed' ? 'bg-zinc-800 text-zinc-500' :
          'bg-zinc-500/20 text-zinc-400'
        }`}>
          {challenge.status}
        </span>
      </div>

      {challenge.wager && (
        <div className="flex items-center gap-2 text-xs bg-amber-400/10 rounded-lg px-3 py-2">
          <span>💰</span>
          <span className="text-amber-400 font-medium">{challenge.wager.stake}</span>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div key={p.userId} className="flex items-center gap-3">
            <span className={`text-sm font-bold w-6 text-center ${
              i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-zinc-600'
            }`}>
              {i === 0 ? '👑' : `#${p.rank}`}
            </span>
            <Avatar name={p.userName} size="sm" src={p.userAvatar} />
            <span className="text-sm flex-1">{p.userName}</span>
            <span className="text-sm font-mono font-bold text-zinc-300">{p.currentValue}</span>
            <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${sorted[0].currentValue > 0 ? (p.currentValue / sorted[0].currentValue) * 100 : 0}%` }}
                className="h-full rounded-full bg-accent"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600">
        Ends {new Date(challenge.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </p>
    </div>
  );
}
