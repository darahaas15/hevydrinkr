'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';

interface MentionTextProps {
  text: string;
  className?: string;
}

export function MentionText({ text, className = '' }: MentionTextProps) {
  const router = useRouter();
  const allUsers = useAuthStore((s) => s.allUsers);
  const currentUser = useAuthStore((s) => s.currentUser);

  // Split text by @username patterns
  const parts = text.split(/(@\w+)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1).toLowerCase();
          const user = allUsers.find((u) => u.username.toLowerCase() === username);
          if (user) {
            return (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(user.id === currentUser?.id ? '/profile' : `/profile?user=${user.id}`);
                }}
                className="text-accent font-semibold"
              >
                @{user.username}
              </button>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
