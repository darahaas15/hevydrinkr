'use client';

import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import type { GroupRecord, GroupRecordType } from '@/types/roast';

const RECORD_LABELS: Record<GroupRecordType, string> = {
  highest_weekly_std_drinks: 'Most Standards (Week)',
  most_weekly_sessions: 'Most Sessions (Week)',
  longest_single_session: 'Longest Session',
  highest_single_session_std_drinks: 'Biggest Single Session',
  most_weekly_unique_drinks: 'Most Variety (Week)',
};

interface GroupRecordsProps {
  records: GroupRecord[];
}

export function GroupRecords({ records }: GroupRecordsProps) {
  if (records.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" />
        Group Records
      </h3>
      <div className="space-y-1.5">
        {records.map((record, i) => (
          <motion.div
            key={record.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
          >
            <Avatar name={record.userName} size="sm" src={record.userAvatar} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-500 truncate">
                {RECORD_LABELS[record.recordType] ?? record.recordType}
              </p>
              <p className="text-sm font-medium truncate">{record.userName}</p>
            </div>
            <span className="text-sm font-mono font-bold text-accent shrink-0">
              {record.formattedValue}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
