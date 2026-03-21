'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

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

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 glass safe-top',
        'flex items-center justify-between h-14 px-4'
      )}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="w-10 flex items-center">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        )}
      </div>

      <h1 className="text-base font-semibold text-white truncate">{title}</h1>

      <div className="w-10 flex items-center justify-end">
        {rightAction}
      </div>
    </header>
  );
}
