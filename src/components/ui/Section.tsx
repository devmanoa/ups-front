import type { ReactNode } from 'react';

interface SectionProps {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}

/** Groupe de contenu précédé d'un intitulé en petites capitales. */
export function Section({ label, action, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[--k-muted]">
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
