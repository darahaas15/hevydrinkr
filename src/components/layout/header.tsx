'use client';

import React from 'react';
import { ChevronLeft, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/use-ui-store';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export default function Header({
  title,
  showBack = false,
  rightAction,
}: HeaderProps) {
  const router = useRouter();
  const isOffline = useUIStore((s) => s.isOffline);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 glass safe-top"
      style={{ borderBottom: '1px solid var(--hairline)' }}
    >
      <div className="flex items-center justify-between h-14 px-4">
        <div className="w-10 flex items-center">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isOffline && <WifiOff size={14} className="text-danger-fg shrink-0" />}
          <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        </div>

        <div className="w-10 flex items-center justify-end">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
