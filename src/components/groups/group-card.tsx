'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Users } from 'lucide-react';
import { useRoastStore } from '@/stores/use-roast-store';
import { Avatar } from '@/components/ui/avatar';
import { hapticLight } from '@/lib/haptics';
import type { Group } from '@/types';

export const GroupCard = memo(function GroupCard({ group }: { group: Group }) {
  const router = useRouter();
  const latestRecap = useRoastStore((s) => s.getLatestRecap)(group.id);

  return (
    <div onClick={() => { hapticLight(); router.push(`/groups?id=${group.id}`); }} className="cursor-pointer">
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="group-card w-full rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 text-left active:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center gap-3">
        {group.iconUrl ? (
          <img src={group.iconUrl} alt={group.name} loading="lazy" decoding="async" className="w-12 h-12 rounded-2xl object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-lg font-bold text-accent">
            {group.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{group.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
            </span>
            {latestRecap && (
              <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full">
                {latestRecap.awards.length} awards
              </span>
            )}
          </div>
        </div>

        {/* Member Avatars */}
        <div className="flex -space-x-2">
          {group.members.slice(0, 3).map((member) => (
            <div key={member.userId} className="ring-2 ring-[#09090b] rounded-full">
              <Avatar name={member.userName} size="sm" src={member.userAvatar} />
            </div>
          ))}
          {group.members.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 ring-2 ring-[#09090b]">
              +{group.members.length - 3}
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-zinc-600 shrink-0" />
      </div>
    </motion.div>
    </div>
  );
});
