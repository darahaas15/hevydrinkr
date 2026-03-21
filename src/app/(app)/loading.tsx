export default function AppLoading() {
  return (
    <div className="min-h-full px-5 py-5 space-y-4 animate-pulse">
      <div className="h-8 w-32 rounded-lg bg-white/[0.04]" />
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-24 rounded bg-white/[0.06]" />
            <div className="h-2 w-16 rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-white/[0.04]" />
        <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
      </div>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-20 rounded bg-white/[0.06]" />
            <div className="h-2 w-12 rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}
