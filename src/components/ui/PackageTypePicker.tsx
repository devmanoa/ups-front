import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Boxes, Search, Star, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';
import type { PackageInput, PackageType } from '../../types/ups';
import { cn } from './cn';

interface PackageTypePickerProps {
  /** Reçoit les colis à insérer : un par unité demandée. */
  onSelect: (packages: PackageInput[]) => void;
  /** Propose une quantité : trois bornes = trois colis identiques. */
  withQuantity?: boolean;
  label?: string;
  className?: string;
}

/**
 * Sélecteur du catalogue de types de colis.
 *
 * Il *remplit* poids et dimensions sans les verrouiller : un cas particulier
 * se corrige à la main, sans créer un type dédié.
 *
 * Catalogue vide ou base absente : le composant s'efface plutôt que d'afficher
 * une erreur sur des pages qui fonctionnent sans lui.
 */
export function PackageTypePicker({
  onSelect,
  withQuantity = true,
  label = 'Charger un type de colis',
  className,
}: PackageTypePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const types = useQuery({
    queryKey: ['package-types', 'picker'],
    queryFn: () => api.listPackageTypes(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Le compteur alimente le tri : son échec ne doit pas gêner la saisie.
  const countUse = useMutation({
    mutationFn: (id: number) => api.markPackageTypeUsed(id),
    onError: () => {},
  });

  const items = types.data?.types ?? [];

  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) =>
      [t.label, t.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, search]);

  function choose(type: PackageType) {
    const count = withQuantity ? Math.max(1, Math.min(quantity, 50)) : 1;
    onSelect(Array.from({ length: count }, () => toPackage(type)));

    setOpen(false);
    setSearch('');
    setQuantity(1);
    countUse.mutate(type.id);
  }

  if (types.isError || (!types.isLoading && items.length === 0)) return null;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex gap-2">
        {withQuantity && (
          <input
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            title="Quantité à ajouter"
            aria-label="Quantité"
            // `.input-field` impose width:100% et l'emporte sur l'utilitaire
            // Tailwind (même spécificité, feuille chargée après) : le champ
            // occupait toute la ligne et chassait le bouton hors de la carte.
            style={{ width: '4rem' }}
            className="input-field shrink-0 text-center"
          />
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'inline-flex flex-1 items-center justify-between gap-2 rounded-xl border',
            'border-[--k-border] bg-[--k-surface-2] px-3 py-2 text-[13px] font-medium',
            'text-[--k-text] transition hover:border-[--k-primary] hover:bg-[--k-surface]',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Boxes className="h-4 w-4 shrink-0 text-[--k-primary]" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-[--k-muted] transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[--k-border] bg-[--k-surface] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[--k-border] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[--k-muted]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un matériel…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[--k-muted]"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-[--k-muted]">
                Aucun type ne correspond.
              </p>
            ) : (
              filtered.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => choose(type)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-[--k-surface-2]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-[--k-text]">
                        {type.label}
                      </span>
                      {type.isDefault && (
                        <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[--k-muted]">
                      {describe(type)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {withQuantity && (
            <p className="border-t border-[--k-border] px-3 py-2 text-[12px] text-[--k-muted]">
              {quantity > 1
                ? `${quantity} colis identiques seront ajoutés.`
                : 'Ajustez la quantité pour ajouter plusieurs colis identiques.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Résumé d'un type : poids, puis dimensions si elles sont connues. */
export function describe(type: PackageType): string {
  const dimensions =
    type.length && type.width && type.height
      ? `${type.length} × ${type.width} × ${type.height} cm`
      : null;

  return [`${type.weight} kg`, dimensions, type.description].filter(Boolean).join(' — ');
}

/** Ne garde que ce qui a un sens pour un colis : l'id du type ne part pas chez UPS. */
export function toPackage(type: PackageType): PackageInput {
  return {
    weight: type.weight,
    length: type.length || undefined,
    width: type.width || undefined,
    height: type.height || undefined,
    description: type.description || undefined,
    packagingType: type.packagingType || undefined,
    reference: type.reference || undefined,
  };
}
