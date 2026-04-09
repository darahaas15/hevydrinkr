'use client';

import { use, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Play, Square, Users, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGroupsStore } from '@/stores/use-groups-store';
import { usePartyStore } from '@/stores/use-party-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTimer } from '@/hooks/use-timer';
import { Avatar } from '@/components/ui/avatar';
import { DrinkPicker } from '@/components/session/drink-picker';
import { useSessionStore } from '@/stores/use-session-store';
import { DrinkIcon } from '@/components/ui/drink-icon';

export default function PartyModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const groups = useGroupsStore((s) => s.groups);
  const group = groups.find((g) => g.id === id);
  const activeParty = usePartyStore((s) => s.activeParty);
  const createParty = usePartyStore((s) => s.createParty);
  const startParty = usePartyStore((s) => s.startParty);
  const endParty = usePartyStore((s) => s.endParty);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [partyName, setPartyName] = useState('');
  const [showDrinkPicker, setShowDrinkPicker] = useState(false);
  const addDrinkEvent = usePartyStore((s) => s.addDrinkEvent);
  const updateParticipantDrinks = usePartyStore((s) => s.updateParticipantDrinks);
  const joinParty = usePartyStore((s) => s.joinParty);
  const addDrink = useSessionStore((s) => s.addDrink);
  const activeSession = useSessionStore((s) => s.activeSession);
  const startSession = useSessionStore((s) => s.startSession);

  const timer = useTimer(activeParty?.startedAt || null);

  if (!group || !currentUser) return null;

  const isHost = activeParty?.hostUserId === currentUser.id;
  const isParticipant = activeParty?.participants.some((p) => p.userId === currentUser.id);

  const handleCreate = () => {
    const name = partyName.trim() || `${group.name} Party`;
    createParty(id, currentUser.id, name);
    setPartyName('');
  };

  const sortedParticipants = activeParty
    ? [...activeParty.participants].sort((a, b) => b.totalStandardDrinks - a.totalStandardDrinks)
    : [];

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Party Mode 🎉</h1>
            {activeParty && (
              <p className="text-xs text-zinc-500">{activeParty.name}</p>
            )}
          </div>
          {activeParty?.status === 'active' && (
            <span className="text-sm font-mono text-accent">{timer.formatted}</span>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {!activeParty ? (
          /* No Party — Create one */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-12"
          >
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-xl font-bold mb-2">Start a Party</h2>
            <p className="text-sm text-zinc-500 text-center mb-8 max-w-xs">
              Everyone in the group logs drinks together with a live leaderboard
            </p>

            <input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Party name (optional)"
              className="w-full max-w-sm px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 mb-4"
            />

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCreate}
              className="w-full max-w-sm py-4 rounded-2xl bg-accent text-black font-semibold text-lg"
            >
              Create Party
            </motion.button>
          </motion.div>
        ) : (
          /* Active Party */
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 text-center">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3 ${
                activeParty.status === 'active' ? 'bg-accent/15 text-accent' :
                activeParty.status === 'waiting' ? 'bg-amber-400/15 text-amber-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {activeParty.status === 'active' ? 'Party in Progress' :
                 activeParty.status === 'waiting' ? 'Waiting to Start' : 'Party Ended'}
              </div>

              {activeParty.status === 'waiting' && isHost && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={startParty}
                  className="w-full py-3 rounded-xl bg-accent text-black font-medium flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Party
                </motion.button>
              )}

              {activeParty.status === 'active' && isHost && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={endParty}
                  className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 font-medium flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  End Party
                </motion.button>
              )}
            </div>

            {/* Live Leaderboard */}
            <div>
              <h3 className="text-sm font-medium text-zinc-500 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Live Leaderboard
              </h3>
              <div className="space-y-2">
                {sortedParticipants.map((p, i) => (
                  <motion.div
                    key={p.userId}
                    layout
                    className={`bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 flex items-center gap-3 ${
                      p.userId === currentUser.id ? 'ring-1 ring-accent/30' : ''
                    }`}
                  >
                    <span className={`text-lg font-bold w-8 text-center ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      {i === 0 ? '👑' : `#${i + 1}`}
                    </span>
                    <Avatar name={p.userName} size="sm" src={p.userAvatar} />
                    <span className="text-sm flex-1">{p.userName}</span>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono text-accent font-extrabold">
                        {p.totalStandardDrinks.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-zinc-600">std drinks</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Log Drink Button */}
            {activeParty.status === 'active' && isParticipant && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDrinkPicker(true)}
                className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Log a Drink
              </motion.button>
            )}

            {/* Join Button */}
            {activeParty.status !== 'ended' && !isParticipant && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  joinParty(activeParty.id, {
                    userId: currentUser.id,
                    userName: currentUser.displayName,
                    userAvatar: currentUser.avatarUrl,
                    sessionId: '',
                    totalStandardDrinks: 0,
                    isActive: true,
                  });
                }}
                className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-lg"
              >
                Join Party
              </motion.button>
            )}

            {/* Live Drink Feed */}
            {activeParty.liveDrinkFeed.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-500 mb-3">Live Feed</h3>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {[...activeParty.liveDrinkFeed].reverse().slice(0, 20).map((event) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-sm py-1"
                      >
                        <DrinkIcon category={event.drinkCategory || 'custom'} className="w-4 h-4" />
                        <span className="text-zinc-400">
                          <span className="text-white font-medium">{event.userName}</span> had a {event.drinkName}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drink Picker */}
      <AnimatePresence>
        {showDrinkPicker && activeParty && (
          <DrinkPicker
            onSelect={(drink) => {
              // Log to party feed
              addDrinkEvent({
                id: crypto.randomUUID(),
                userId: currentUser.id,
                userName: currentUser.displayName,
                drinkName: drink.drinkName,
                drinkEmoji: drink.emoji,
                drinkCategory: drink.category,
                timestamp: new Date().toISOString(),
              });
              // Update participant total
              const me = activeParty.participants.find((p) => p.userId === currentUser.id);
              if (me) {
                updateParticipantDrinks(currentUser.id, me.totalStandardDrinks + drink.standardDrinks);
              }
              // Also add to personal session if active
              if (activeSession) {
                addDrink(drink);
              }
              setShowDrinkPicker(false);
            }}
            onClose={() => setShowDrinkPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
