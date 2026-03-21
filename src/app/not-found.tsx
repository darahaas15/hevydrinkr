import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="h-dvh flex items-center justify-center" style={{ background: '#09090b' }}>
      <div className="text-center px-6">
        <div className="text-5xl mb-4">🍻</div>
        <h1 className="text-xl font-extrabold mb-2 text-white">Page not found</h1>
        <p className="text-sm text-zinc-500 mb-6">This page doesn&apos;t exist</p>
        <Link
          href="/feed"
          className="inline-block px-6 py-3 rounded-xl bg-accent text-black font-bold text-sm"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
