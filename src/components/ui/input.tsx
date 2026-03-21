'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps {
  label?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, value, onChange, placeholder, type = 'text', className, icon }, ref) => {
    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label className="block text-sm text-zinc-400 mb-1.5">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={cn(
              'w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder:text-zinc-600',
              'focus:outline-none focus:border-accent/40',
              'transition-all',
              !!icon && 'pl-10'
            )}
          />
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
