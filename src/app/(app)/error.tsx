'use client';

import { useEffect, useState } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  const detailText = `${error.name}: ${error.message}\n${error.stack ?? ''}\n${error.digest ?? ''}`.trim();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(detailText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-10">
      <div className="text-center max-w-md w-full">
        <div className="text-5xl mb-4">💥</div>
        <h1 className="text-xl font-extrabold mb-2">Something went wrong</h1>
        <p className="text-sm text-zinc-500 mb-2 break-words">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl bg-accent text-black font-bold text-sm"
          >
            Try Again
          </button>
          <button
            onClick={() => setShowDetails((s) => !s)}
            className="text-xs text-zinc-500 underline"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        </div>
        {showDetails && (
          <div className="mt-4 text-left">
            <pre className="text-[10px] text-zinc-400 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 whitespace-pre-wrap break-all max-h-64 overflow-auto">
              {detailText}
            </pre>
            <button onClick={copy} className="mt-2 px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs text-zinc-300">
              {copied ? 'Copied' : 'Copy error'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
