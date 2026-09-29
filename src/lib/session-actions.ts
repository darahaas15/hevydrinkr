import type { DrinkEntry, DrinkSession, SessionMood } from '@/types';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useProfileStore } from '@/stores/use-profile-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useUIStore } from '@/stores/use-ui-store';
import {
  useDrinkPrefsStore,
  entryFromQuickDrink,
  selectCost,
  selectPrefs,
  selectRecents,
  type QuickDrink,
  type UserDrinkPrefs,
} from '@/stores/use-drink-prefs-store';
import { detectPRs } from '@/lib/algorithms/pr-detection';
import { drinkMilestoneMessage } from '@/lib/milestones';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';

/**
 * What the live-session screens do, shared by the web app and the iOS app so
 * a drink logged, removed or a session ended behaves identically on both.
 */

/**
 * Logs a drink to the active session. The single entry point for every way of
 * adding one (picker, quick-add row, the "+" on a drink row), so the milestone
 * toast fires no matter which was used.
 */
export function logDrink(drink: DrinkEntry): void {
  const countBefore = useSessionStore.getState().activeSession?.drinks.length ?? 0;
  useSessionStore.getState().addDrink(drink);
  const milestone = drinkMilestoneMessage(countBefore + 1);
  if (milestone) {
    hapticSuccess();
    useUIStore.getState().addToast(milestone, 'success');
  }
}

/** Removes a drink, offering an Undo for a few seconds. */
export function removeDrinkWithUndo(drink: DrinkEntry): void {
  const { removeDrink, restoreDrink } = useSessionStore.getState();
  removeDrink(drink.id);
  useUIStore.getState().addToast(`Removed ${drink.drinkName}`, {
    type: 'info',
    durationMs: 6000,
    action: { label: 'Undo', onPress: () => restoreDrink(drink) },
  });
}

/** The drink the live-session banner offers to log again, if any. */
export function lastLoggedDrink(byUser: Record<string, UserDrinkPrefs>, userId: string | undefined): QuickDrink | null {
  return selectRecents(selectPrefs(byUser, userId), 1)[0] ?? null;
}

/**
 * Logs another of the most recent drink without leaving the current screen,
 * with an Undo because the button sits under the thumb on every tab.
 */
export function relogDrink(userId: string, drink: QuickDrink): void {
  hapticMedium();
  const prefsStore = useDrinkPrefsStore.getState();
  const entry = entryFromQuickDrink(drink, selectCost(selectPrefs(prefsStore.byUser, userId), drink.definitionId));
  prefsStore.recordUse(userId, drink);
  const { addDrink, removeDrink } = useSessionStore.getState();
  addDrink(entry);
  useUIStore.getState().addToast(`${drink.name} logged`, {
    type: 'success',
    durationMs: 6000,
    action: { label: 'Undo', onPress: () => removeDrink(entry.id) },
  });
}

/**
 * Ends the active session, records any personal records it set, and either
 * posts it to the feed or keeps it in the user's history only (it can still be
 * shared later from session detail). Returns the completed session, or null
 * when there was no active session to end.
 */
export function finishActiveSession(options: {
  mood: SessionMood;
  share: boolean;
  caption: string;
  taggedUserIds: string[];
}): DrinkSession | null {
  const currentUser = useAuthStore.getState().currentUser;
  const { activeSession, endSession } = useSessionStore.getState();
  if (!activeSession || !currentUser) return null;

  hapticSuccess();
  endSession(options.mood);

  // endSession moves the session to the top of its owner's history straight
  // away (and rolls it back, with a toast, if the database later refuses).
  const completed = useSessionStore.getState().sessionsByUser[currentUser.id]?.[0];
  if (!completed || completed.id !== activeSession.id) return null;

  const { recordsByUser, addPR } = useProfileStore.getState();
  const newPRs = detectPRs(completed, recordsByUser[currentUser.id] ?? []);
  newPRs.forEach((pr) => addPR(pr));
  if (newPRs.length > 0) {
    setTimeout(() => useUIStore.getState().triggerCelebration(newPRs[0]), 500);
  }

  if (options.share) {
    useFeedStore.getState().createFeedItemFromSession(completed, currentUser, options.caption, options.taggedUserIds);
  } else {
    useUIStore.getState().addToast('Saved to your history — you can share it any time', 'success');
  }
  return completed;
}
