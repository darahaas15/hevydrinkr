import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeDrink, makeSession, makeUser } from '../../tests/helpers/factories';

// Supabase writes are captured instead of sent; every call succeeds.
vi.mock('@/lib/supabase/client', () => {
  const query = () => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'order', 'single', 'maybeSingle', 'limit']) {
      q[m] = () => q;
    }
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
    return q;
  };
  return { supabase: { from: () => query(), rpc: () => query(), auth: {} } };
});

const { useSessionStore } = await import('@/stores/use-session-store');
const { useAuthStore } = await import('@/stores/use-auth-store');
const { useProfileStore } = await import('@/stores/use-profile-store');
const { useFeedStore } = await import('@/stores/use-feed-store');
const { useUIStore } = await import('@/stores/use-ui-store');
const { useDrinkPrefsStore } = await import('@/stores/use-drink-prefs-store');
const { finishActiveSession, lastLoggedDrink, logDrink, relogDrink, removeDrinkWithUndo } = await import(
  './session-actions'
);

const alice = makeUser({ id: 'alice' });
const drinks = () => useSessionStore.getState().activeSession?.drinks ?? [];
const toasts = () => useUIStore.getState().toasts;

beforeEach(() => {
  vi.useRealTimers();
  useAuthStore.setState({ currentUser: alice });
  useSessionStore.setState({
    activeSession: makeSession({ id: 'live', userId: 'alice', status: 'active', endedAt: null, drinks: [] }),
    sessionsByUser: {},
  });
  useUIStore.setState({ toasts: [] });
  useDrinkPrefsStore.setState({ byUser: {} });
});

describe('logDrink', () => {
  it('adds the drink and cheers only the milestone counts', () => {
    for (let i = 1; i <= 4; i++) logDrink(makeDrink());
    expect(drinks()).toHaveLength(4);
    expect(toasts()).toHaveLength(0);

    logDrink(makeDrink());
    expect(drinks()).toHaveLength(5);
    expect(toasts().map((t) => t.message)).toEqual(['5 drinks deep!']);
  });
});

describe('removeDrinkWithUndo', () => {
  it('removes the drink and puts it back on Undo', () => {
    const beer = makeDrink({ drinkName: 'Kingfisher' });
    logDrink(beer);
    removeDrinkWithUndo(beer);
    expect(drinks()).toHaveLength(0);

    const toast = toasts().find((t) => t.message === 'Removed Kingfisher');
    expect(toast?.action?.label).toBe('Undo');
    toast!.action!.onPress();
    expect(drinks().map((d) => d.id)).toEqual([beer.id]);
  });
});

describe('lastLoggedDrink / relogDrink', () => {
  const quick = {
    definitionId: 'beer-kf',
    name: 'Kingfisher',
    emoji: '🍺',
    category: 'beer' as const,
    abvPercent: 4.8,
    volumeMl: 330,
    standardDrinks: 0.9,
  };

  it('offers the most recently logged drink, per user', () => {
    useDrinkPrefsStore.getState().recordUse('alice', quick);
    const byUser = useDrinkPrefsStore.getState().byUser;
    expect(lastLoggedDrink(byUser, 'alice')?.definitionId).toBe('beer-kf');
    expect(lastLoggedDrink(byUser, 'bob')).toBeNull();
    expect(lastLoggedDrink(byUser, undefined)).toBeNull();
  });

  it('logs it again at the remembered price, with an Undo', () => {
    useDrinkPrefsStore.getState().setCost('alice', 'beer-kf', 350);
    relogDrink('alice', quick);
    expect(drinks()).toHaveLength(1);
    expect(drinks()[0]).toMatchObject({ drinkDefinitionId: 'beer-kf', cost: 350 });

    const toast = toasts().find((t) => t.message === 'Kingfisher logged');
    toast!.action!.onPress();
    expect(drinks()).toHaveLength(0);
  });
});

describe('finishActiveSession', () => {
  it('does nothing without an active session', () => {
    useSessionStore.setState({ activeSession: null });
    expect(finishActiveSession({ mood: 'good', share: true, caption: '', taggedUserIds: [] })).toBeNull();
  });

  it('completes the session and posts it with the caption and tags', () => {
    const post = vi.fn();
    useFeedStore.setState({ createFeedItemFromSession: post });
    useProfileStore.setState({ recordsByUser: {}, addPR: vi.fn() });
    logDrink(makeDrink());

    const completed = finishActiveSession({ mood: 'legendary', share: true, caption: 'Big night', taggedUserIds: ['bob'] });

    expect(completed).toMatchObject({ id: 'live', status: 'completed', mood: 'legendary' });
    expect(useSessionStore.getState().activeSession).toBeNull();
    expect(useSessionStore.getState().sessionsByUser.alice?.[0]?.id).toBe('live');
    expect(post).toHaveBeenCalledWith(completed, alice, 'Big night', ['bob']);
  });

  it('keeps it private when not sharing, and says so', () => {
    const post = vi.fn();
    useFeedStore.setState({ createFeedItemFromSession: post });
    useProfileStore.setState({ recordsByUser: {}, addPR: vi.fn() });
    logDrink(makeDrink());

    finishActiveSession({ mood: 'good', share: false, caption: '', taggedUserIds: [] });

    expect(post).not.toHaveBeenCalled();
    expect(toasts().map((t) => t.message)).toContain('Saved to your history — you can share it any time');
  });

  it('records the personal records the session set', () => {
    const addPR = vi.fn();
    useFeedStore.setState({ createFeedItemFromSession: vi.fn() });
    useProfileStore.setState({ recordsByUser: {}, addPR });
    logDrink(makeDrink());

    finishActiveSession({ mood: 'good', share: false, caption: '', taggedUserIds: [] });

    // A first-ever session sets at least the per-session records.
    expect(addPR).toHaveBeenCalled();
    expect(addPR.mock.calls.every(([pr]) => pr.userId === 'alice')).toBe(true);
  });
});
