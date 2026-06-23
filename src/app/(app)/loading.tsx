export default function AppLoading() {
  return (
    <div className="min-h-full px-5 py-5 space-y-4 animate-pulse">
      <div className="h-8 w-32 rounded-lg bg-surface-secondary" />
      <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-raised" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-24 rounded bg-surface-raised" />
            <div className="h-2 w-16 rounded bg-surface-secondary" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-surface-secondary" />
        <div className="h-3 w-3/4 rounded bg-surface-secondary" />
      </div>
      <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-raised" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-20 rounded bg-surface-raised" />
            <div className="h-2 w-12 rounded bg-surface-secondary" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-surface-secondary" />
      </div>
    </div>
  );
}
