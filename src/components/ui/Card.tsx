import type { ReactNode } from 'react';
import { cn } from './cn';

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** Conteneur de section, calqué sur les cartes de bornes_factory. */
export function Card({ children, className }: CardProps) {
  return (
    <section
      className={cn('rounded-xl border border-[--k-border] bg-[--k-surface] p-4', className)}
    >
      {children}
    </section>
  );
}

interface CardTitleProps {
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function CardTitle({ title, hint, action }: CardTitleProps) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[14px] font-semibold text-[--k-text]">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] text-[--k-muted]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
