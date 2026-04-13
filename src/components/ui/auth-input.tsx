'use client';

import { motion } from 'framer-motion';

export function AuthInput({ icon, type = 'text', value, onChange, placeholder, onSubmit, max }: {
  icon: React.ReactNode; type?: string; value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void; max?: string;
}) {
  return (
    <div className="relative group">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-accent transition-colors">{icon}</div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} max={max}
        onKeyDown={onSubmit ? (e) => e.key === 'Enter' && onSubmit() : undefined}
        className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/30 transition-colors${type === 'date' ? ' [color-scheme:dark] appearance-none' : ''}`}
      />
    </div>
  );
}

export function ErrorMsg({ message }: { message: string }) {
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400 mb-4 px-1">
      {message}
    </motion.p>
  );
}
