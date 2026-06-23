import Link from 'next/link';
import { DrinkIcon } from '@/components/ui/drink-icon';

export default function NotFound() {
  return (
    <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center px-6">
        <DrinkIcon category="beer" className="w-12 h-12 mx-auto mb-4" />
        <h1 className="text-xl font-extrabold mb-2 text-foreground">Page not found</h1>
        <p className="text-sm text-fg-secondary mb-6">This page doesn&apos;t exist</p>
        <Link
          href="/feed"
          className="inline-block px-6 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
