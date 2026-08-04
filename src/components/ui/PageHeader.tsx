import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[18px] font-semibold text-[--k-text]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-[--k-muted]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
