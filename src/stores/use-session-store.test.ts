import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeSession } from '../../tests/helpers/factories';

// Every write the store sends to Supabase, captured instead of sent.
const writes = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('@/lib/supabase/client', () => {
  const query = () => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'delete', 'eq', 'in', 'order', 'single', 'limit']) q[m] = () => q;
    q.update = (row: Record<string, unknown>) => {
      writes.push(row);
      return q;
    };
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
    return q;
  };
  return {
    supabase: {
      from: () => query(),
      rpc: () => query(),
      auth: {
        // A stored login whose profile can't be loaded, as on an offline launch.
        getSession: async () => ({ data: { session: { user: { id: 'alice' } } } }),
        signOut: async () => ({ error: null }),
      },
    },
  };
});

const { useSessionStore, PEAK_SYNC_INTERVAL_MS } = await import('./use-session-store');
const { useAuthStore } = await import('./use-auth-store');
const { makeUser } = await import('../../tests/helpers/factories');

const peakWrites = () => writes.filter((w) => Object.keys(w).join() === 'peak_bac_estimate');

describe('live peak BAC sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writes.length = 0;
    useSessionStore.setState({ activeSession: makeSession({ status: 'active', peakBacEstimate: 0 }) });
  });
  afterEach(() => {
    useSessionStore.setState({ activeSession: null });
    vi.useRealTimers();
  });

  it('saves the first rise right away, then at most once a minute', () => {
    for (let second = 1; second <= 180; second++) {
      useSessionStore.getState().updatePeakBac(second / 10_000);
      vi.advanceTimersByTime(1000);
    }
    expect(peakWrites().length).toBeLessThanOrEqual(4);
    expect(peakWrites()[0]).toEqual({ peak_bac_estimate: 0.0001 });
  });

  it('keeps the local peak current every second', () => {
    useSessionStore.getState().updatePeakBac(0.01);
    useSessionStore.getState().updatePeakBac(0.02);
    expect(useSessionStore.getState().activeSession?.peakBacEstimate).toBe(0.02);
  });

  it('sends the newest peak when the queued save fires', () => {
    useSessionStore.getState().updatePeakBac(0.01);
    useSessionStore.getState().updatePeakBac(0.02);
    useSessionStore.getState().updatePeakBac(0.03);
    vi.advanceTimersByTime(PEAK_SYNC_INTERVAL_MS);
    expect(peakWrites()).toEqual([{ peak_bac_estimate: 0.01 }, { peak_bac_estimate: 0.03 }]);
  });

  it('drops a queued save once the session ends, which saves the final peak itself', () => {
    useSessionStore.getState().updatePeakBac(0.01);
    useSessionStore.getState().updatePeakBac(0.02);
    useSessionStore.getState().endSession('good');
    vi.advanceTimersByTime(PEAK_SYNC_INTERVAL_MS * 2);
    expect(peakWrites()).toEqual([{ peak_bac_estimate: 0.01 }]);
    expect(writes.at(-1)).toMatchObject({ status: 'completed', peak_bac_estimate: 0.02 });
  });
});

describe('account changes', () => {
  const alice = makeUser({ id: 'alice' });
  const bob = makeUser({ id: 'bob' });

  beforeEach(() => {
    useAuthStore.setState({ currentUser: alice });
    useSessionStore.setState({ activeSession: makeSession({ userId: 'alice', status: 'active' }) });
  });

  it('signing out clears the live session from the device', async () => {
    await useAuthStore.getState().logout();
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it('keeps it when an offline launch cannot load the profile', async () => {
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useSessionStore.getState().activeSession).not.toBeNull();
  });

  it('clears it when another account signs in', () => {
    useAuthStore.setState({ currentUser: bob });
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it('keeps it when the same account is only updated', () => {
    useAuthStore.setState({ currentUser: { ...alice, bio: 'new bio' } });
    expect(useSessionStore.getState().activeSession).not.toBeNull();
  });
});
