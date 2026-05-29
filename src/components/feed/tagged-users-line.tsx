'use client';

import { useRouter } from 'next/navigation';
import { Tag } from 'lucide-react';
import { useAuthStore } from '@/stores/use-auth-store';
import type { UserProfile } from '@/types';

interface TaggedUsersLineProps {
  taggedUserIds: string[];
  className?: string;
}

/**
 * "with @alice, @bob +2" row for a post's tagged users. Resolves names from
 * the auth store and links each to their profile. Renders nothing if there's
 * nothing to show.
 */
export function TaggedUsersLine({ taggedUserIds, className = '' }: TaggedUsersLineProps) {
  const router = useRouter();
  const allUsers = useAuthStore((s) => s.allUsers);
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!taggedUserIds || taggedUserIds.length === 0) return null;

  const users = taggedUserIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter((u): u is UserProfile => !!u);
  if (users.length === 0) return null;

  const shown = users.slice(0, 3);
  const extra = users.length - shown.length;

  return (
    <p className={`flex flex-wrap items-center gap-x-1 text-[12px] text-zinc-500 ${className}`}>
      <Tag className="w-3 h-3 shrink-0" />
      <span>with</span>
      {shown.map((u, i) => (
        <span key={u.id}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(u.id === currentUser?.id ? '/profile' : `/profile/${u.id}`);
            }}
            className="text-accent font-semibold"
          >
            @{u.username}
          </button>
          {i < shown.length - 1 ? ',' : ''}
        </span>
      ))}
      {extra > 0 && <span>+{extra} more</span>}
    </p>
  );
}
