'use client';

import { useEffect } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useAppRouter } from '@/hooks/use-app-router';
import { CHANGELOG, LATEST_CHANGELOG } from '@/lib/changelog';
import { useChangelogStore } from '@/stores/use-changelog-store';

export default function ChangelogPage() {
  const router = useAppRouter();
  const markSeen = useChangelogStore((s) => s.markSeen);

  // Visiting the changelog counts as seeing the latest entry.
  useEffect(() => {
    if (LATEST_CHANGELOG) markSeen(LATEST_CHANGELOG.version);
  }, [markSeen]);

  return (
    <div className="min-h-full">
      <div
        className="sticky top-0 z-20 safe-top"
        style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between h-14 px-4">
          <div className="w-10 flex items-center">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="p-2 -ml-2 text-zinc-400 hover:text-white active:text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
          <h1 className="text-base font-semibold text-white">What&apos;s New</h1>
          <div className="w-10" />
        </div>
      </div>

      {CHANGELOG.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="w-10 h-10 text-zinc-700 mb-3" />
          <h3 className="text-base font-semibold text-zinc-400 mb-1">Nothing new yet</h3>
          <p className="text-sm text-zinc-600 max-w-[240px]">Check back after the next update.</p>
        </div>
      ) : (
        <div className="px-4 py-5 space-y-4">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <h2 className="text-base font-bold text-white">{entry.title}</h2>
              </div>
              <p className="text-xs text-zinc-500 mb-4">v{entry.version} · {entry.date}</p>
              <ul className="space-y-2.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-relaxed">
                    <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
