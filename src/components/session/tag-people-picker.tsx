'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Search, Check, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/use-auth-store';
import { hapticLight } from '@/lib/haptics';
import type { UserProfile } from '@/types';

interface TagPeopleFieldProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Trigger row + picker modal for tagging people in a post. The picker is
 * limited to accounts the current user follows (matching the DB-side
 * `tags ⊆ following` rule). Names/avatars resolve from the auth store.
 */
export function TagPeopleField({ value, onChange }: TagPeopleFieldProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const allUsers = useAuthStore((s) => s.allUsers);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // People you follow, resolved to full profiles (skip any not yet cached).
  const followingUsers = useMemo(() => {
    const following = currentUser?.following ?? [];
    const byId = new Map(allUsers.map((u) => [u.id, u]));
    return following
      .map((id) => byId.get(id))
      .filter((u): u is UserProfile => !!u)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [currentUser?.following, allUsers]);

  const selectedUsers = useMemo(
    () => value.map((id) => allUsers.find((u) => u.id === id)).filter((u): u is UserProfile => !!u),
    [value, allUsers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return followingUsers;
    return followingUsers.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
    );
  }, [followingUsers, query]);

  const toggle = (id: string) => {
    hapticLight();
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <>
      {/* Trigger row */}
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(true); }}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-secondary border border-card-border active:bg-surface-raised transition-colors text-left"
      >
        <Tag className="w-4 h-4 text-fg-secondary shrink-0" />
        {selectedUsers.length === 0 ? (
          <span className="text-sm text-muted">Tag people</span>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-1.5 shrink-0">
              {selectedUsers.slice(0, 3).map((u) => (
                <Avatar key={u.id} name={u.displayName} size="xs" src={u.avatarUrl} className="ring-1 ring-background" />
              ))}
            </div>
            <span className="text-sm text-fg-strong truncate">
              {selectedUsers[0].displayName}
              {selectedUsers.length > 1 && ` and ${selectedUsers.length - 1} other${selectedUsers.length - 1 !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </button>

      {/* Picker modal — portaled to body so its fixed overlay isn't trapped by
          the transformed (animated) modal card it's rendered inside. */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative w-full max-w-sm mx-0 sm:mx-6 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[75dvh]"
              style={{ background: 'var(--popover-strong-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-hairline shrink-0">
                <h3 className="text-base font-bold">Tag people</h3>
                <button onClick={() => setOpen(false)} className="p-2 -mr-2 rounded-lg hover:bg-surface-subtle active:bg-surface-strong">
                  <X className="w-5 h-5 text-fg-secondary" />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people you follow"
                    autoCapitalize="none"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-subtle border border-card-border text-[16px] md:text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
                {followingUsers.length === 0 ? (
                  <p className="text-sm text-muted text-center py-10 px-6">
                    Follow people to tag them in your posts.
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted text-center py-10">No matches</p>
                ) : (
                  filtered.map((user) => {
                    const selected = value.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggle(user.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:bg-surface-secondary transition-colors text-left"
                      >
                        <Avatar name={user.displayName} size="sm" src={user.avatarUrl} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.displayName}</p>
                          <p className="text-[11px] text-muted truncate">@{user.username}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            selected ? 'bg-accent border-accent' : 'border-[var(--selection-border)]'
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5 text-accent-foreground" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Done */}
              <div className="px-4 py-3 border-t border-hairline shrink-0 safe-bottom">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm"
                >
                  {value.length > 0 ? `Done (${value.length})` : 'Done'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
