'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Clock, Wine, ChevronRight, Camera } from 'lucide-react';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useProfileStore } from '@/stores/use-profile-store';
import { useUIStore } from '@/stores/use-ui-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useTimer } from '@/hooks/use-timer';
import { detectPRs } from '@/lib/algorithms/pr-detection';
import { BacGauge } from '@/components/session/bac-gauge';
import { DrinkPicker } from '@/components/session/drink-picker';
import { DrinkList } from '@/components/session/drink-list';
import { SessionSummary } from '@/components/session/session-summary';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { pickImage, compressImage } from '@/lib/image-utils';

export default function SessionPage() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const addDrink = useSessionStore((s) => s.addDrink);
  const removeDrink = useSessionStore((s) => s.removeDrink);
  const addPhoto = useSessionStore((s) => s.addPhoto);
  const removePhoto = useSessionStore((s) => s.removePhoto);
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const currentUser = useAuthStore((s) => s.currentUser);
  const personalRecords = useProfileStore((s) => s.personalRecords);
  const addPR = useProfileStore((s) => s.addPR);
  const triggerCelebration = useUIStore((s) => s.triggerCelebration);
  const createFeedItemFromSession = useFeedStore((s) => s.createFeedItemFromSession);
  const addToast = useUIStore((s) => s.addToast);

  const [venue, setVenue] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showPostPreview, setShowPostPreview] = useState(false);
  const [caption, setCaption] = useState('');
  const [lastCompletedSession, setLastCompletedSession] = useState<ReturnType<typeof useSessionStore.getState>['sessionHistory'][0] | null>(null);

  const timer = useTimer(activeSession?.startedAt || null);

  const totalStdDrinks = activeSession?.drinks.reduce((sum, d) => sum + d.standardDrinks, 0) || 0;

  const handleAddPhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    const dataUrl = await compressImage(file);
    addPhoto(dataUrl);
  };

  const handleStart = () => {
    if (!venue.trim()) return;
    if (!currentUser) return;
    startSession(venue.trim(), currentUser.id);
    setVenue('');
  };

  const handlePost = () => {
    if (!activeSession || !currentUser) return;
    setShowPostPreview(false);
    endSession('good');

    const completed = useSessionStore.getState().sessionHistory[0];
    if (completed) {
      setLastCompletedSession(completed);
      const newPRs = detectPRs(completed, personalRecords);
      newPRs.forEach((pr) => addPR(pr));
      if (newPRs.length > 0) {
        setTimeout(() => triggerCelebration(newPRs[0]), 500);
      }
      createFeedItemFromSession(completed, currentUser, caption);
      setCaption('');
      setShowSummary(true);
    }
  };

  // ── Start screen ──
  if (!activeSession && !showSummary) {
    const mySessions = sessionHistory.filter(s => s.userId === currentUser?.id).slice(0, 5);

    return (
      <div className="min-h-full px-5 pt-14">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center pt-8"
        >
          <span className="text-5xl mb-5">🍻</span>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Start a Sesh</h1>
          <p className="text-zinc-500 text-sm mb-8">Log drinks, track your score, beat PRs</p>

          <div className="w-full max-w-sm space-y-3">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Where are you drinking?"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              disabled={!venue.trim()}
              className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-base disabled:opacity-20 transition-all"
            >
              Start Drinking
            </motion.button>
          </div>

          {mySessions.length > 0 && (
            <div className="w-full mt-10">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Recent</h3>
              <div className="space-y-1.5">
                {mySessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-xl">{session.drinks[0]?.emoji || '🍻'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.venue}</p>
                      <p className="text-[11px] text-zinc-600">
                        {session.drinks.length} drinks · {Math.floor(session.durationMinutes / 60)}h {session.durationMinutes % 60}m
                      </p>
                    </div>
                    <p className="text-[11px] text-zinc-700">
                      {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <ChevronRight className="w-4 h-4 text-zinc-700" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Summary ──
  if (showSummary && lastCompletedSession) {
    return (
      <SessionSummary
        session={lastCompletedSession}
        onDone={() => { setShowSummary(false); setLastCompletedSession(null); }}
      />
    );
  }

  // ── Active session ──
  if (!activeSession) return null;

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-zinc-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {activeSession.venue}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className="w-4 h-4 text-accent" />
              <span className="text-lg font-mono font-bold text-white">{timer.formatted}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleAddPhoto}
              className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08]"
            >
              <Camera className="w-4 h-4 text-zinc-400" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => activeSession.drinks.length > 0 ? setShowPostPreview(true) : addToast('Add at least one drink first', 'error')}
              className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-semibold"
            >
              End
            </motion.button>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <BacGauge standardDrinks={totalStdDrinks} drinks={activeSession.drinks} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Drinks', value: activeSession.drinks.length },
            { label: 'Std Drinks', value: totalStdDrinks.toFixed(1) },
            { label: 'Types', value: new Set(activeSession.drinks.map(d => d.drinkDefinitionId)).size },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-zinc-600">{s.label}</p>
            </div>
          ))}
        </div>

        <DrinkList drinks={activeSession.drinks} onRemove={removeDrink} />

        {/* Session Photos */}
        {activeSession.photos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Photos</p>
            <PhotoGallery photos={activeSession.photos} onRemove={removePhoto} />
          </div>
        )}

      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setShowPicker(true)}
        className="fixed bottom-24 w-14 h-14 rounded-2xl bg-accent flex items-center justify-center z-30 shadow-[0_4px_24px_rgba(20,184,166,0.25)]"
        style={{ right: 'max(1.25rem, calc(50% - 240px + 1.25rem))' }}
      >
        <Plus className="w-6 h-6 text-black" />
      </motion.button>

      {/* Drink Picker */}
      <AnimatePresence>
        {showPicker && (
          <DrinkPicker
            onSelect={(drink) => { addDrink(drink); setShowPicker(false); }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Post Preview Modal */}
      <AnimatePresence>
        {showPostPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPostPreview(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl p-6 space-y-4"
              style={{ background: '#141418' }}
            >
              {/* Session info */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">End Session</h2>
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {activeSession.venue} · {activeSession.drinks.length} drinks · {timer.formatted}
                  </p>
                </div>
                <div className="flex flex-wrap gap-0.5 max-w-[80px] justify-end">
                  {activeSession.drinks.slice(0, 6).map((d) => (
                    <span key={d.id} className="text-base">{d.emoji}</span>
                  ))}
                  {activeSession.drinks.length > 6 && (
                    <span className="text-[10px] text-zinc-600">+{activeSession.drinks.length - 6}</span>
                  )}
                </div>
              </div>

              {/* Photos */}
              {activeSession.photos.length > 0 && (
                <PhotoGallery photos={activeSession.photos} />
              )}

              {/* Caption */}
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption (optional)"
                rows={2}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors resize-none"
              />

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPostPreview(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.04] text-zinc-400 font-medium text-sm"
                >
                  Back
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePost}
                  className="flex-1 py-3 rounded-xl bg-accent text-black font-bold text-sm"
                >
                  Post
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
