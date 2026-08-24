import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { BUTTON_BASE, VARIANTS, SIZES } from './Button';
import { cn } from './cn';

interface ButtonLinkProps {
  to: string;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
  /** Ouvre dans un nouvel onglet, avec le rel qui va avec. */
  external?: boolean;
}

/**
 * Lien ayant l'apparence d'un bouton.
 *
 * À préférer à `<Link><Button/></Link>` : un `<button>` dans un `<a>` est du
 * HTML invalide, et le navigateur n'y propose ni « Ouvrir dans un nouvel
 * onglet » ni Ctrl+clic. Ici la cible est un vrai `<a href>`.
 */
export function ButtonLink({
  to,
  children,
  variant = 'ghost',
  size = 'sm',
  className,
  title,
  external,
}: ButtonLinkProps) {
  const classes = cn(BUTTON_BASE, SIZES[size], VARIANTS[variant], className);

  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        // noreferrer : la page ouverte ne doit pas pouvoir manipuler la nôtre.
        rel="noreferrer"
        title={title}
        className={classes}
      >
        {children}
      </a>
    );
  }

  return (
    <Link to={to} title={title} className={classes}>
      {children}
    </Link>
  );
}
