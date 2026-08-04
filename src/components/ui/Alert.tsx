import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

type AlertType = 'error' | 'success' | 'info';

const STYLES: Record<AlertType, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-indigo-200 bg-[--k-primary-2] text-indigo-900',
};

const ICONS: Record<AlertType, typeof Info> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

interface AlertProps {
  type?: AlertType;
  children: ReactNode;
  className?: string;
}

export function Alert({ type = 'info', children, className }: AlertProps) {
  const Icon = ICONS[type];
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px]',
        STYLES[type],
        className
      )}
    >
      <Icon className="mt-[1px] h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
