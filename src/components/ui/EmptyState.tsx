import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
}

/**
 * Occupe la zone de résultats tant qu'aucune recherche n'a été lancée.
 * Évite la page vide qui laisse l'utilisateur sans repère.
 */
export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--k-border] bg-[--k-surface]/60 px-6 py-10 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[--k-primary-2]">
        <Icon className="h-5 w-5 text-[--k-primary]" />
      </span>
      <p className="text-[14px] font-semibold text-[--k-text]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] text-[--k-muted]">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
