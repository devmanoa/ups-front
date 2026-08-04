import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import Button from './Button';

interface SubmitBarProps {
  children: ReactNode;
  isLoading?: boolean;
  /** Motif du blocage. Renseigné → bouton désactivé et raison affichée. */
  blockedReason?: string | null;
  icon?: ReactNode;
}

/**
 * Barre d'action de formulaire. Affiche explicitement pourquoi l'envoi est
 * bloqué : un bouton grisé sans explication laisse l'utilisateur chercher.
 */
export function SubmitBar({ children, isLoading, blockedReason, icon }: SubmitBarProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[--k-border] pt-4">
      <Button type="submit" isLoading={isLoading} disabled={Boolean(blockedReason)}>
        {!isLoading && icon}
        {children}
      </Button>
      {blockedReason && (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[--k-muted]">
          <AlertCircle className="h-3.5 w-3.5 text-[--k-warning]" />
          {blockedReason}
        </span>
      )}
    </div>
  );
}
