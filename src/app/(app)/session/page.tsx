'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Clock, Wine, ChevronRight, Camera, Trash2, Pencil, Check, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { DrinkIcon } from '@/components/ui/drink-icon';
import { hapticHeavy, hapticSuccess, hapticWarning } from '@/lib/haptics';
import SessionDetailPage from './[id]/session-detail';

export default function SessionPage() {
  return (
    <Suspense>
      <SessionPageRouter />
    </Suspense>
  );
}

function SessionPageRouter() {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('id');

  if (sessionIdParam) {
    return <SessionDetailPage sessionId={sessionIdParam} />;
  }

  return <SessionPageInner />;
}

function SessionPageInner() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const addDrink = useSessionStore((s) => s.addDrink);
  const removeDrink = useSessionStore((s) => s.removeDrink);
  const updateVenue = useSessionStore((s) => s.updateVenue);
  const abandonSession = useSessionStore((s) => s.abandonSession);
  const addPhoto = useSessionStore((s) => s.addPhoto);
  const removePhoto = useSessionStore((s) => s.removePhoto);
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const currentUser = useAuthStore((s) => s.currentUser);
  const personalRecords = useProfileStore((s) => s.personalRecords);
  const fetchPRs = useProfileStore((s) => s.fetchPRs);
  const addPR = useProfileStore((s) => s.addPR);
  const triggerCelebration = useUIStore((s) => s.triggerCelebration);
  const createFeedItemFromSession = useFeedStore((s) => s.createFeedItemFromSession);
  const addToast = useUIStore((s) => s.addToast);
  const feedItems = useFeedStore((s) => s.items);
  const fetchFeed = useFeedStore((s) => s.fetchFeed);
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      fetchSessions(currentUser.id).finally(() => setLoadingHistory(false));
      fetchPRs(currentUser.id);
      fetchFeed();
    }
  }, [currentUser, fetchSessions, fetchPRs, fetchFeed]);

  const [venue, setVenue] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showPostPreview, setShowPostPreview] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);
  const [venueEdit, setVenueEdit] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedMood, setSelectedMood] = useState<'legendary' | 'great' | 'good' | 'meh' | 'rough'>('good');
  const [posting, setPosting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastCompletedSession, setLastCompletedSession] = useState<ReturnType<typeof useSessionStore.getState>['sessionHistory'][0] | null>(null);

  const timer = useTimer(activeSession?.startedAt || null);

  const totalStdDrinks = activeSession?.drinks.reduce((sum, d) => sum + d.standardDrinks, 0) || 0;
  const totalVolumeMl = activeSession?.drinks.reduce((sum, d) => sum + d.volumeMl, 0) || 0;

  // Pace & context calculations
  const myPosts = feedItems.filter((f) => f.userId === currentUser?.id);
  const avgDrinksPerSession = myPosts.length > 0
    ? myPosts.reduce((sum, p) => sum + p.sessionSummary.totalDrinks, 0) / myPosts.length
    : 0;

  const hoursElapsed = activeSession
    ? (Date.now() - new Date(activeSession.startedAt).getTime()) / 3_600_000
    : 0;
  const drinksPerHour = hoursElapsed > 0.05 && activeSession
    ? activeSession.drinks.length / hoursElapsed
    : 0;

  const drinkDiff = activeSession ? activeSession.drinks.length - avgDrinksPerSession : 0;

  const handleAddPhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    const dataUrl = await compressImage(file);
    addPhoto(dataUrl);
  };

  const handleStart = () => {
    if (!venue.trim()) return;
    if (!currentUser) return;
    hapticHeavy();
    startSession(venue.trim(), currentUser.id);
    setVenue('');
  };

  const handlePost = () => {
    if (!activeSession || !currentUser || posting) return;
    setPosting(true);
    setShowPostPreview(false);
    hapticSuccess();
    endSession(selectedMood);

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
          <DrinkIcon category="beer" className="w-12 h-12 mb-5" />
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

          {loadingHistory ? (
            <div className="w-full mt-10">
              <div className="w-16 h-3 rounded bg-white/5 mb-3 animate-pulse" />
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse">
                    <div className="w-5 h-5 rounded bg-white/5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="w-28 h-3.5 rounded bg-white/5" />
                      <div className="w-20 h-2.5 rounded bg-white/[0.03]" />
                    </div>
                    <div className="w-12 h-2.5 rounded bg-white/[0.03]" />
                  </div>
                ))}
              </div>
            </div>
          ) : mySessions.length > 0 && (
            <div className="w-full mt-10">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Recent</h3>
              <div className="space-y-1.5">
                {mySessions.map((session) => {
                  const feedPost = feedItems.find((f) => f.sessionId === session.id);
                  return (
                    <button
                      key={session.id}
                      onClick={() => router.push(feedPost ? `/feed?post=${feedPost.id}` : `/session?id=${session.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-left active:bg-white/[0.05] transition-colors"
                    >
                      {session.drinks[0] ? <DrinkIcon category={session.drinks[0].category} className="w-5 h-5" /> : <DrinkIcon category="beer" className="w-5 h-5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session.venue}</p>
                        <p className="text-[11px] text-zinc-600">
                          {session.drinks.length} drink{session.drinks.length !== 1 ? 's' : ''} · {Math.floor(session.durationMinutes / 60)}h {session.durationMinutes % 60}m
                        </p>
                      </div>
                      <p className="text-[11px] text-zinc-700">
                        {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <ChevronRight className="w-4 h-4 text-zinc-700" />
                    </button>
                  );
                })}
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
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center justify-between">
          <div>
            {editingVenue ? (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-zinc-500" />
                <input
                  autoFocus
                  value={venueEdit}
                  onChange={(e) => setVenueEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && venueEdit.trim()) {
                      updateVenue(venueEdit.trim());
                      setEditingVenue(false);
                    } else if (e.key === 'Escape') {
                      setEditingVenue(false);
                    }
                  }}
                  enterKeyHint="done"
                  autoCapitalize="words"
                  className="px-2 py-0.5 rounded-lg bg-white/[0.06] border border-accent/30 text-[11px] text-white focus:outline-none w-32"
                />
                <button
                  onClick={() => {
                    if (venueEdit.trim()) {
                      updateVenue(venueEdit.trim());
                      setEditingVenue(false);
                    }
                  }}
                  className="p-2 rounded hover:bg-white/5 active:bg-white/[0.08]"
                >
                  <Check className="w-4 h-4 text-accent" />
                </button>
                <button onClick={() => setEditingVenue(false)} className="p-2 rounded hover:bg-white/5 active:bg-white/[0.08]">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setVenueEdit(activeSession.venue); setEditingVenue(true); }}
                className="text-[11px] text-zinc-500 flex items-center gap-1 hover:text-zinc-400 transition-colors"
              >
                <MapPin className="w-3 h-3" />
                {activeSession.venue}
                <Pencil className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
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
              onClick={() => setShowAbandonConfirm(true)}
              className="px-3 py-2 rounded-xl bg-white/[0.06] text-zinc-500 text-sm"
            >
              Cancel
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

        {/* Pace & Context */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-3xl font-extrabold">{activeSession.drinks.length}</p>
              <p className="text-[11px] text-zinc-500">drinks</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-zinc-300">{totalVolumeMl >= 1000 ? `${(totalVolumeMl / 1000).toFixed(1)}L` : `${Math.round(totalVolumeMl)}ml`}</p>
              <p className="text-[10px] text-zinc-600">volume</p>
            </div>
          </div>
          <div className="flex gap-3">
            {drinksPerHour > 0 && (
              <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2">
                <p className="text-sm font-bold">{drinksPerHour.toFixed(1)}<span className="text-[10px] text-zinc-500 font-normal">/hr</span></p>
                <p className="text-[10px] text-zinc-600">Pace</p>
              </div>
            )}
            {avgDrinksPerSession > 0 && (
              <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2">
                <p className={`text-sm font-bold ${drinkDiff > 0 ? 'text-accent' : drinkDiff < 0 ? 'text-zinc-400' : 'text-zinc-300'}`}>
                  {drinkDiff > 0 ? '+' : ''}{drinkDiff.toFixed(0)}
                </p>
                <p className="text-[10px] text-zinc-600">vs your avg</p>
              </div>
            )}
            <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2">
              <p className="text-sm font-bold">{new Set(activeSession.drinks.map(d => d.drinkDefinitionId)).size}</p>
              <p className="text-[10px] text-zinc-600">Types</p>
            </div>
          </div>
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
            onSelect={(drink) => {
              addDrink(drink);
              setShowPicker(false);
              // Mid-session milestone toast
              const count = (activeSession?.drinks.length ?? 0) + 1;
              const milestones: Record<number, string> = { 5: '5 drinks deep!', 10: 'Double digits!', 15: 'On a roll!', 20: 'Unstoppable!', 25: 'Quarter century!', 30: 'Legend status!' };
              if (milestones[count]) { hapticSuccess(); addToast(milestones[count], 'success'); }
            }}
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
            style={{
              // Shrink the centering box by the keyboard height so the
              // modal (and its caption textarea) stays visible above the
              // keyboard. `--keyboard-height` is set by useKeyboardHeight.
              paddingBottom: 'var(--keyboard-height, 0px)',
              transition: 'padding-bottom 280ms cubic-bezier(0.17, 0.59, 0.4, 0.77)',
            }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPostPreview(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl p-6 space-y-4"
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
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
                    <DrinkIcon key={d.id} category={d.category} className="w-4 h-4" />
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

              {/* Mood */}
              <div className="flex justify-between">
                {[
                  { value: 'legendary' as const, emoji: '🤩' },
                  { value: 'great' as const, emoji: '😄' },
                  { value: 'good' as const, emoji: '🙂' },
                  { value: 'meh' as const, emoji: '😐' },
                  { value: 'rough' as const, emoji: '🤢' },
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMood(m.value)}
                    className={`p-2 rounded-lg transition-all ${
                      selectedMood === m.value ? 'bg-accent/10 ring-1 ring-accent/30 scale-110' : ''
                    }`}
                  >
                    <span className="text-xl">{m.emoji}</span>
                  </button>
                ))}
              </div>

              {/* Caption */}
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption (optional)"
                rows={2}
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
                  disabled={posting}
                  className="flex-1 py-3 rounded-xl bg-accent text-black font-bold text-sm disabled:opacity-50"
                >
                  Post
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Abandon Session Confirmation */}
      <AnimatePresence>
        {showAbandonConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowAbandonConfirm(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xs mx-6 rounded-3xl p-6 text-center"
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <Trash2 className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">Cancel session?</h3>
              <p className="text-sm text-zinc-500 mb-5">This session won&apos;t be saved</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAbandonConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.04] text-zinc-400 font-medium text-sm"
                >
                  Keep Going
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticWarning(); abandonSession(); setShowAbandonConfirm(false); }}
                  className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-bold text-sm"
                >
                  Cancel It
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
