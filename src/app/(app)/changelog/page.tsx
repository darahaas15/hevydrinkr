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
        style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        <div className="flex items-center justify-between h-14 px-4">
          <div className="w-10 flex items-center">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground">What&apos;s New</h1>
          <div className="w-10" />
        </div>
      </div>

      {CHANGELOG.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="w-10 h-10 text-fg-faint mb-3" />
          <h3 className="text-base font-semibold text-muted-foreground mb-1">Nothing new yet</h3>
          <p className="text-sm text-muted max-w-[240px]">Check back after the next update.</p>
        </div>
      ) : (
        <div className="px-4 py-5 space-y-4">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="rounded-2xl bg-card border border-hairline p-5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-info-fg shrink-0" />
                <h2 className="text-base font-bold text-foreground">{entry.title}</h2>
              </div>
              <p className="text-xs text-fg-secondary mb-4">v{entry.version} · {entry.date}</p>
              <ul className="space-y-2.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-fg-strong leading-relaxed">
                    <span className="text-info-fg mt-0.5 shrink-0">•</span>
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
