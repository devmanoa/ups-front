import { cn } from './cn';

/**
 * Palettes attribuées par hachage du nom : deux auteurs différents ne
 * partagent pas la même couleur, et la couleur d'un même auteur ne change
 * pas d'un écran à l'autre.
 */
const PALETTES = [
  'from-indigo-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-sky-600',
];

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-10 w-10 text-[13px]',
};

/** Deux premières initiales : « Sébastien Mahé » donne « SM ». */
export function initialsOf(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Hachage stable : la même chaîne donne toujours la même teinte. */
function paletteFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

interface AvatarProps {
  name: string | null | undefined;
  /** Clé de couleur : l'identifiant Keycloak de préférence, stable au renommage. */
  seed?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}

export function Avatar({ name, seed, size = 'md', className, title }: AvatarProps) {
  const known = Boolean(name?.trim());

  return (
    <span
      title={title ?? name ?? undefined}
      aria-hidden={!known}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white',
        SIZES[size],
        // Un auteur inconnu reste gris : lui donner une couleur laisserait
        // croire qu'on sait de qui il s'agit.
        known ? `bg-gradient-to-br ${paletteFor(seed || name || '')}` : 'bg-slate-300',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
