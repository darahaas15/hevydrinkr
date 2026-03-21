'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-full flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-5xl mb-4">💥</div>
        <h1 className="text-xl font-extrabold mb-2">Something went wrong</h1>
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
