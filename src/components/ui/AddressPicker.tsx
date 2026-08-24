import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookUser, Search, Star, ChevronDown, Check } from 'lucide-react';
import { api } from '../../services/api';
import type { Address, SavedAddress } from '../../types/ups';
import { cn } from './cn';
import Button from './Button';

interface AddressPickerProps {
  /** Reçoit l'adresse choisie, prête à remplir un formulaire. */
  onSelect: (address: Address) => void;
  /** Charge automatiquement l'adresse par défaut au premier affichage. */
  autoLoadDefault?: boolean;
  label?: string;
  className?: string;
}

/**
 * Sélecteur du carnet d'adresses, à poser au-dessus d'un bloc d'adresse.
 *
 * Il *remplit* les champs sans les verrouiller : la saisie manuelle et les
 * corrections restent toujours possibles, comme avec AddressAutocomplete.
 *
 * Sans base de données configurée, le carnet renvoie 503 : le composant
 * s'efface alors silencieusement plutôt que d'afficher une erreur sur des
 * pages qui fonctionnent parfaitement sans lui.
 */
export function AddressPicker({
  onSelect,
  autoLoadDefault = false,
  label = 'Charger depuis le carnet',
  className,
}: AddressPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const addresses = useQuery({
    queryKey: ['addresses', 'picker'],
    queryFn: () => api.listAddresses(),
    // Le carnet bouge peu : inutile de le recharger à chaque ouverture.
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const groups = useQuery({
    queryKey: ['address-groups'],
    queryFn: () => api.listAddressGroups(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Le compteur d'utilisation alimente le tri : son échec ne doit jamais
  // gêner la saisie en cours.
  const useMutationCounter = useMutation({
    mutationFn: (id: number) => api.markAddressUsed(id),
    onError: () => {},
  });

  const items = addresses.data?.addresses ?? [];

  // onSelect est stocké dans une ref : le chargement automatique ne doit pas
  // se rejouer à chaque rendu du parent.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const loadedDefault = useRef(false);
  useEffect(() => {
    if (!autoLoadDefault || loadedDefault.current || !items.length) return;
    const fallback = items.find((a) => a.isDefault);
    if (!fallback) return;

    loadedDefault.current = true;
    setPicked(fallback.id);
    onSelectRef.current(toAddress(fallback));
  }, [autoLoadDefault, items]);

  // Fermeture au clic extérieur et à Échap : le panneau recouvre le formulaire.
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
    return items.filter((a) =>
      [a.label, a.name, a.city, a.postalCode, a.addressLine1]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, search]);

  /** Regroupe pour l'affichage, en conservant l'ordre de tri du backend. */
  const sections = useMemo(() => {
    const names = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
    const bucket = new Map<string, SavedAddress[]>();

    for (const address of filtered) {
      const key = address.groupId ? (names.get(address.groupId) ?? 'Autres') : 'Sans groupe';
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(address);
    }

    // « Sans groupe » en dernier : les groupes nommés sont les plus utiles.
    return [...bucket.entries()].sort(([a], [b]) =>
      a === 'Sans groupe' ? 1 : b === 'Sans groupe' ? -1 : a.localeCompare(b),
    );
  }, [filtered, groups.data]);

  function choose(address: SavedAddress) {
    setPicked(address.id);
    setOpen(false);
    setSearch('');
    onSelect(toAddress(address));
    useMutationCounter.mutate(address.id);
  }

  // Carnet indisponible (pas de base) ou vide : le composant disparaît.
  if (addresses.isError || (!addresses.isLoading && items.length === 0)) return null;

  const current = items.find((a) => a.id === picked);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[--k-border]',
          'bg-[--k-surface-2] px-3 py-2 text-[13px] font-medium text-[--k-text] transition',
          'hover:bg-[--k-surface] hover:border-[--k-primary]',
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <BookUser className="h-4 w-4 shrink-0 text-[--k-primary]" />
          <span className="truncate">{current ? current.label : label}</span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[--k-muted] transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[--k-border] bg-[--k-surface] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[--k-border] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[--k-muted]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une adresse…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[--k-muted]"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-[--k-muted]">
                Aucune adresse ne correspond.
              </p>
            ) : (
              sections.map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[--k-muted]">
                    {groupName}
                  </div>
                  {groupItems.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => choose(address)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-[--k-surface-2]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-[--k-text]">
                            {address.label}
                          </span>
                          {address.isDefault && (
                            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[--k-muted]">
                          {[address.addressLine1, address.postalCode, address.city, address.country]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </span>
                      {picked === address.id && (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[--k-primary]" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Ne garde que les champs d'une Address : les métadonnées ne doivent pas partir chez UPS. */
export function toAddress(saved: SavedAddress): Address {
  return {
    name: saved.name ?? '',
    attentionName: saved.attentionName ?? '',
    phone: saved.phone ?? '',
    addressLine1: saved.addressLine1 ?? '',
    addressLine2: saved.addressLine2 ?? '',
    city: saved.city ?? '',
    state: saved.state ?? '',
    postalCode: saved.postalCode ?? '',
    country: saved.country ?? 'FR',
    residential: saved.residential ?? false,
  };
}

interface SaveToBookProps {
  address: Address;
  /** Nom pré-rempli, généralement celui du destinataire. */
  suggestedLabel?: string;
  onSaved?: () => void;
}

/**
 * Bouton « Enregistrer dans le carnet », à afficher après un envoi réussi.
 *
 * C'est le moment où l'adresse vient d'être acceptée par UPS : alimenter le
 * carnet devient un sous-produit du travail normal plutôt qu'une saisie
 * initiale à faire d'un bloc.
 */
export function SaveToBook({ address, suggestedLabel, onSaved }: SaveToBookProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(suggestedLabel ?? address.name ?? '');
  const [groupId, setGroupId] = useState<string>('');

  const groups = useQuery({
    queryKey: ['address-groups'],
    queryFn: () => api.listAddressGroups(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      api.createAddress({
        label: label.trim(),
        groupId: groupId ? Number(groupId) : null,
        name: address.name ?? '',
        attentionName: address.attentionName,
        phone: address.phone,
        addressLine1: address.addressLine1 ?? '',
        addressLine2: address.addressLine2,
        city: address.city ?? '',
        state: address.state,
        postalCode: address.postalCode ?? '',
        country: address.country ?? 'FR',
        residential: address.residential,
      }),
    onSuccess: () => {
      setEditing(false);
      onSaved?.();
    },
  });

  // Carnet indisponible : le bouton n'a pas lieu d'être.
  if (groups.isError) return null;

  if (save.isSuccess) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-green-700">
        <Check className="h-3.5 w-3.5" />
        Enregistrée dans le carnet
      </p>
    );
  }

  if (!editing) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
        <BookUser className="h-4 w-4" />
        Enregistrer dans le carnet
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-[--k-border] bg-[--k-surface-2] p-3">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nom : Antenne Lyon, Client Dupont…"
        className="input-field"
      />
      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="input-field"
      >
        <option value="">Sans groupe</option>
        {(groups.data ?? []).map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {save.isError && (
        <p className="text-[12px] text-[--k-danger]">{(save.error as Error).message}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          isLoading={save.isPending}
          disabled={!label.trim()}
          onClick={() => save.mutate()}
        >
          Enregistrer
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
