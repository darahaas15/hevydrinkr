'use client';

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="h-dvh flex items-center justify-center" style={{ background: '#09090b' }}>
      <div className="text-center px-6">
        <div className="text-5xl mb-4">💥</div>
        <h1 className="text-xl font-extrabold mb-2 text-white">Something went wrong</h1>
        <p className="text-sm text-zinc-500 mb-6">An unexpected error occurred</p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl bg-accent text-black font-bold text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
