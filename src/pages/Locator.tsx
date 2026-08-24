import { useState, useEffect, useRef, type FormEvent, type MouseEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, ExternalLink, Phone, Copy, Check, Navigation } from 'lucide-react';
import { api, type LocatorPayload } from '../services/api';
import type { AccessPointLocation, LocatorResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { AccessPointsMap } from '../components/AccessPointsMap';
import { geocodeAddress } from '../utils/googleMaps';

export default function Locator() {
  const [address, setAddress] = useState<Address>({ country: 'FR' });
  const [radius, setRadius] = useState('25');
  const [unit, setUnit] = useState('KM');
  const [maxResults, setMaxResults] = useState('10');
  /** Point relais mis en avant, partagé entre la carte et la liste. */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  /** Distingue un clic sur la carte d'un survol dans la liste. */
  const [scrollToActive, setScrollToActive] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Position de l'adresse recherchée, affichée en repère sur la carte.
   * Alimentée par l'autocomplétion quand elle est utilisée, sinon par un
   * géocodage au moment de la recherche.
   */
  const [origin, setOrigin] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  /** Coordonnées issues d'une suggestion : évitent un géocodage inutile. */
  const pickedRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Amène la ligne active dans la vue lorsqu'elle a été choisie depuis la
   * carte. On ne défile pas sur un survol de la liste : le pointeur y est
   * déjà, et déplacer le contenu sous le curseur serait déroutant.
   */
  useEffect(() => {
    if (!scrollToActive || activeIndex === null || !listRef.current) return;

    const row = listRef.current.querySelector<HTMLElement>(`[data-row="${activeIndex}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setScrollToActive(false);
  }, [activeIndex, scrollToActive]);

  /** Sélection depuis la carte : elle doit entraîner le défilement. */
  const activateFromMap = (index: number | null) => {
    setActiveIndex(index);
    setScrollToActive(index !== null);
  };

  const mutation = useMutation<LocatorResult, Error, LocatorPayload>({
    mutationFn: (payload) => api.findAccessPoints(payload),
    // Les index d'une recherche précédente ne correspondent plus.
    onMutate: () => setActiveIndex(null),
  });

  /**
   * Toute modification manuelle périme les coordonnées de la suggestion :
   * corriger la ville après avoir choisi une adresse ne doit pas laisser le
   * repère à l'ancien endroit.
   */
  const set = (patch: Partial<Address>) => {
    pickedRef.current = null;
    setAddress((prev) => ({ ...prev, ...patch }));
  };

  const blockedReason =
    !address.postalCode && !address.city ? 'Renseignez une ville ou un code postal' : null;

  /** Résumé lisible de l'adresse, pour l'infobulle du repère. */
  const originLabel = () =>
    [address.addressLine1, address.postalCode, address.city].filter(Boolean).join(', ') ||
    undefined;

  /**
   * Situe l'adresse sur la carte. Les coordonnées d'une suggestion sont
   * réutilisées telles quelles ; sinon un géocodage est tenté.
   *
   * Volontairement détaché de la recherche : un échec de localisation ne
   * doit pas empêcher d'afficher les points relais.
   */
  const locateOrigin = () => {
    const picked = pickedRef.current;
    if (picked) {
      setOrigin({ ...picked, label: originLabel() });
      return;
    }

    setOrigin(null);
    geocodeAddress({
      addressLine1: address.addressLine1,
      city: address.city,
      postalCode: address.postalCode,
      country: address.country,
    }).then((found) => {
      if (found) setOrigin({ ...found, label: originLabel() });
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    locateOrigin();
    mutation.mutate({
      address,
      radius: Number(radius) || 25,
      unit,
      maxResults: Number(maxResults) || 10,
    });
  };

  return (
    <div>
      <PageHeader
        title="Points relais"
        subtitle="Recherchez les UPS Access Points autour d'une adresse de livraison."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} className="lg:sticky lg:top-4">
          <Card>
            <CardTitle title="Zone de recherche" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AddressAutocomplete
                  label="Adresse"
                  placeholder="Commencez à taper l'adresse…"
                  value={address.addressLine1 ?? ''}
                  onChange={(v) => set({ addressLine1: v })}
                  onSelect={(p) => {
                    set({
                      addressLine1: p.addressLine1,
                      city: p.city,
                      state: p.state,
                      postalCode: p.postalCode,
                      country: p.country,
                    });

                    // Posé APRÈS set(), qui périme volontairement les
                    // coordonnées à chaque modification de champ.
                    pickedRef.current =
                      p.latitude != null && p.longitude != null
                        ? { lat: p.latitude, lng: p.longitude }
                        : null;
                  }}
                />
              </div>
              <Field
                label="Ville"
                placeholder="Paris"
                value={address.city ?? ''}
                onChange={(e) => set({ city: e.target.value })}
              />
              <Field
                label="Code postal"
                placeholder="75002"
                value={address.postalCode ?? ''}
                onChange={(e) => set({ postalCode: e.target.value })}
              />
              <Field
                label="Pays (ISO 2)"
                required
                maxLength={2}
                value={address.country ?? ''}
                onChange={(e) => set({ country: e.target.value.toUpperCase() })}
              />
              <Field
                label="Résultats max."
                type="number"
                min="1"
                max="50"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
              />
              <Field
                label="Rayon"
                type="number"
                min="1"
                max="500"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
              <SelectField label="Unité" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="KM">Kilomètres</option>
                <option value="MI">Miles</option>
              </SelectField>
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<Search className="h-4 w-4" />}
            >
              Rechercher
            </SubmitBar>
          </Card>
        </form>

        <div>
          {mutation.isError ? (
            <Alert type="error">{mutation.error.message}</Alert>
          ) : mutation.isSuccess ? (
            mutation.data.locations.length === 0 ? (
              <Alert type="info">
                Aucun point relais trouvé dans ce rayon. Essayez d'élargir la recherche.
              </Alert>
            ) : (
              /* Carte et liste côte à côte, à hauteur égale : la liste défile
                 sans entraîner la carte. */
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                <AccessPointsMap
                  locations={mutation.data.locations}
                  activeIndex={activeIndex}
                  onActivate={activateFromMap}
                  origin={origin}
                />

                <div className="flex min-h-0 flex-col xl:h-[600px]">
                  <p className="mb-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[--k-muted]">
                    {mutation.data.locations.length} point(s) — du plus proche au plus éloigné
                  </p>
                  <div
                    ref={listRef}
                    className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 xl:pr-2"
                  >
                    {mutation.data.locations.map((loc, i) => (
                      <LocationRow
                        key={loc.locationId || i}
                        loc={loc}
                        index={i}
                        active={activeIndex === i}
                        onActivate={() => setActiveIndex(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            <EmptyState
              icon={Navigation}
              title="Aucune recherche lancée"
              description="Indiquez une ville ou un code postal pour afficher les points relais UPS les plus proches, avec leurs horaires."
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface LocationRowProps {
  loc: AccessPointLocation;
  index: number;
  active: boolean;
  onActivate: () => void;
}

function LocationRow({ loc, index, active, onActivate }: LocationRowProps) {
  const [copied, setCopied] = useState(false);
  const address = [...loc.addressLines, loc.postalCode, loc.city].filter(Boolean).join(', ');

  // L'ID public est celui à communiquer au destinataire ; on retombe sur le
  // LocationID quand UPS ne le fournit pas.
  const displayId = loc.publicAccessPointId || loc.locationId;

  // Cet ID alimente le champ « ID point relais » de la page Étiquettes.
  const copyId = async (e: MouseEvent<HTMLButtonElement>) => {
    // Sans cela, le clic sélectionnerait aussi la ligne.
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible (contexte non sécurisé) */
    }
  };

  return (
    <div
      data-row={index}
      onMouseEnter={onActivate}
      onClick={onActivate}
      className={`cursor-pointer rounded-xl border bg-[--k-surface] p-3 transition ${
        active
          ? 'border-[--k-primary] ring-2 ring-[--k-primary]/15'
          : 'border-[--k-border] hover:border-[--k-primary]/30'
      }`}
    >
      {/* Photo de la façade : permet de reconnaître le commerce sur place. */}
      {loc.imageUrl && (
        <img
          src={loc.imageUrl}
          alt=""
          loading="lazy"
          className="mb-2 h-20 w-full rounded-lg object-cover"
          // Une URL UPS cassée laisserait un cadre vide : on retire l'image.
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[--k-text]">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${
              active ? 'bg-[--k-sidebar-bg]' : 'bg-[--k-primary]'
            }`}
          >
            {index + 1}
          </span>
          {loc.name || 'Point relais'}
        </h3>
        {loc.distance && (
          <Badge tone="primary">
            {loc.distance.value} {loc.distance.unit}
          </Badge>
        )}
      </div>

      <p className="mt-1 text-[12px] text-[--k-muted]">{address}</p>

      {loc.comments && (
        <p className="mt-1 text-[11px] italic text-[--k-muted]">{loc.comments}</p>
      )}

      {loc.promotions.length > 0 && (
        <div className="mt-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] text-orange-800">
          {loc.promotions.join(' · ')}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px]">
        {loc.phone && (
          <span className="inline-flex items-center gap-1 text-[--k-muted]">
            <Phone className="h-3 w-3" />
            {loc.phone}
          </span>
        )}
        {displayId && (
          <button
            type="button"
            onClick={copyId}
            className="inline-flex items-center gap-1 text-[--k-muted] transition hover:text-[--k-primary]"
            title="Copier l'ID pour créer une étiquette vers ce point relais"
          >
            {copied ? <Check className="h-3 w-3 text-[--k-success]" /> : <Copy className="h-3 w-3" />}
            <code className="rounded bg-[--k-surface-2] px-1 py-0.5 text-[11px]">{displayId}</code>
          </button>
        )}
        {loc.latitude != null && loc.longitude != null && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[--k-primary] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Itinéraire
          </a>
        )}
      </div>

      {/* Grille structurée en priorité ; texte libre UPS en repli. */}
      {loc.openingHours.length > 0 ? (
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-[--k-border] pt-2.5 text-[12px]">
          {loc.openingHours.map((h) => (
            <div key={h.day} className={h.closed ? 'text-[--k-muted]/60' : 'text-[--k-muted]'}>
              <span className="font-medium">{h.day.slice(0, 3)}</span> {h.hours}
            </div>
          ))}
        </div>
      ) : loc.hoursText.length > 0 ? (
        <div className="mt-2.5 border-t border-[--k-border] pt-2.5 text-[12px] text-[--k-muted]">
          {loc.hoursText.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      ) : null}

      {loc.services.length > 0 && (
        <details className="mt-2 border-t border-[--k-border] pt-2">
          <summary
            className="cursor-pointer text-[11px] font-medium text-[--k-muted]"
            // Le dépliage ne doit pas changer la sélection courante.
            onClick={(e) => e.stopPropagation()}
          >
            {loc.services.length} service(s) proposé(s)
          </summary>
          <div className="mt-1 space-y-0.5">
            {loc.services.map((s, i) => (
              <div key={i} className="text-[11px] text-[--k-muted]">
                • {s}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
