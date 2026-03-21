'use client';

import { use } from 'react';
import { ChevronLeft, Clock, Wine, Droplets, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/use-session-store';
import { formatDuration } from '@/lib/utils';
import { DRINK_CATEGORY_COLORS, DRINK_CATEGORY_EMOJIS } from '@/lib/constants';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.getSessionById(id));

  if (!session) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-zinc-500">Session not found</p>
      </div>
    );
  }

  const categoryCounts: Record<string, number> = {};
  session.drinks.forEach((d) => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });

  return (
    <div className="min-h-full pb-8">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold">{session.venue}</h1>
            <p className="text-xs text-zinc-500">
              {new Date(session.startedAt).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Wine, label: 'Drinks', value: session.drinks.length.toString(), color: 'text-accent' },
            { icon: Clock, label: 'Duration', value: formatDuration(session.durationMinutes), color: 'text-cyan-400' },
            { icon: Droplets, label: 'Std Drinks', value: session.totalStandardDrinks.toFixed(1), color: 'text-violet-400' },
            { icon: TrendingUp, label: 'Types', value: new Set(session.drinks.map(d => d.drinkDefinitionId)).size.toString(), color: 'text-amber-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 text-center">
              <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Breakdown */}
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4">
          <h3 className="text-sm font-medium text-zinc-500 mb-3">Drink Breakdown</h3>
          {Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([category, count]) => (
              <div key={category} className="flex items-center gap-2 py-1.5">
                <span>{DRINK_CATEGORY_EMOJIS[category]}</span>
                <span className="text-sm capitalize flex-1">{category}</span>
                <span className="text-sm font-mono text-zinc-400">{count}</span>
              </div>
            ))}
        </div>

        {/* Drink Timeline */}
        <div>
          <h3 className="text-sm font-medium text-zinc-500 mb-3">Timeline</h3>
          <div className="space-y-2">
            {session.drinks.map((drink) => (
              <div key={drink.id} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{drink.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{drink.drinkName}</p>
                  <p className="text-[10px] text-zinc-500">
                    {drink.abvPercent}% · {drink.volumeMl}ml
                  </p>
                </div>
                <span className="text-xs text-zinc-600">
                  {new Date(drink.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
