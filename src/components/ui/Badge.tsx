import type { ReactNode } from 'react';
import { cn } from './cn';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[--k-surface-2] text-[--k-muted]',
  primary: 'bg-[--k-primary-2] text-indigo-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-orange-50 text-orange-700',
  danger: 'bg-red-50 text-red-700',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
