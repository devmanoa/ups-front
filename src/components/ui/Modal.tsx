import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  children: ReactNode;
  /** Barre d'actions collée en bas, hors de la zone défilante. */
  footer?: ReactNode;
  width?: keyof typeof WIDTHS;
}

/**
 * Fenêtre modale centrée.
 *
 * Rendue dans un portail sur `document.body` : à l'intérieur de la page, un
 * parent avec `overflow-hidden` ou un `transform` (la barre latérale en est
 * un) redéfinirait le référentiel de `position: fixed` et la fenêtre
 * s'afficherait décalée.
 */
export function Modal({ open, onClose, title, hint, children, footer, width = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Échap pour fermer, et défilement de la page bloqué : sans cela, la molette
  // fait défiler la liste derrière la fenêtre une fois le formulaire au bout.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Le focus part sur le premier champ à l'ouverture pour permettre la saisie
  // au clavier sans passer par la souris.
  useEffect(() => {
    if (!open) return;
    const field = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea',
    );
    field?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center sm:p-6"
      // Ne ferme que sur le fond lui-même : sans cette égalité, relâcher la
      // souris hors d'un champ après une sélection de texte fermerait la
      // fenêtre et perdrait la saisie.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex max-h-full w-full flex-col rounded-xl border border-[--k-border] bg-[--k-surface] shadow-xl',
          WIDTHS[width],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[--k-border] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[--k-text]">{title}</h2>
            {hint && <p className="mt-0.5 text-[12px] text-[--k-muted]">{hint}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 rounded-lg p-1 text-[--k-muted] transition hover:bg-[--k-surface-2] hover:text-[--k-text]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="border-t border-[--k-border] px-4 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
