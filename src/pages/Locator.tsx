import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPin, Search, ExternalLink, Phone, Copy, Check, Navigation } from 'lucide-react';
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

export default function Locator() {
  const [address, setAddress] = useState<Address>({ country: 'FR' });
  const [radius, setRadius] = useState('25');
  const [unit, setUnit] = useState('KM');
  const [maxResults, setMaxResults] = useState('10');

  const mutation = useMutation<LocatorResult, Error, LocatorPayload>({
    mutationFn: (payload) => api.findAccessPoints(payload),
  });

  const set = (patch: Partial<Address>) => setAddress((prev) => ({ ...prev, ...patch }));

  const blockedReason =
    !address.postalCode && !address.city ? 'Renseignez une ville ou un code postal' : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    mutation.mutate({
      address,
      radius: Number(radius) || 25,
      unit,
      maxResults: Number(maxResults) || 10,
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Points relais"
        subtitle="Recherchez les UPS Access Points autour d'une adresse de livraison."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
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
                  onSelect={(p) =>
                    set({
                      addressLine1: p.addressLine1,
                      city: p.city,
                      state: p.state,
                      postalCode: p.postalCode,
                      country: p.country,
                    })
                  }
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
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[--k-muted]">
                  {mutation.data.locations.length} point(s) relais — du plus proche au plus éloigné
                </p>
                {mutation.data.locations.map((loc, i) => (
                  <LocationRow key={loc.locationId || i} loc={loc} />
                ))}
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

function LocationRow({ loc }: { loc: AccessPointLocation }) {
  const [copied, setCopied] = useState(false);
  const address = [...loc.addressLines, loc.postalCode, loc.city].filter(Boolean).join(', ');

  // L'ID du point relais alimente le champ « ID point relais » de la page Étiquettes.
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(loc.locationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible (contexte non sécurisé) */
    }
  };

  return (
    <div className="rounded-xl border border-[--k-border] bg-[--k-surface] p-3 transition hover:border-[--k-primary]/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[--k-text]">
          <MapPin className="h-4 w-4 shrink-0 text-[--k-primary]" />
          {loc.name || 'Point relais'}
        </h3>
        {loc.distance && (
          <Badge tone="primary">
            {loc.distance.value} {loc.distance.unit}
          </Badge>
        )}
      </div>

      <p className="mt-1 text-[12px] text-[--k-muted]">{address}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px]">
        {loc.phone && (
          <span className="inline-flex items-center gap-1 text-[--k-muted]">
            <Phone className="h-3 w-3" />
            {loc.phone}
          </span>
        )}
        {loc.locationId && (
          <button
            type="button"
            onClick={copyId}
            className="inline-flex items-center gap-1 text-[--k-muted] transition hover:text-[--k-primary]"
            title="Copier l'ID pour créer une étiquette vers ce point relais"
          >
            {copied ? <Check className="h-3 w-3 text-[--k-success]" /> : <Copy className="h-3 w-3" />}
            <code className="rounded bg-[--k-surface-2] px-1 py-0.5 text-[11px]">
              {loc.locationId}
            </code>
          </button>
        )}
        {loc.latitude != null && loc.longitude != null && (
          <a
            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[--k-primary] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Carte
          </a>
        )}
      </div>

      {loc.openingHours.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-[--k-border] pt-2.5 text-[12px] sm:grid-cols-4">
          {loc.openingHours.map((h) => (
            <div key={h.day} className={h.closed ? 'text-[--k-muted]/60' : 'text-[--k-muted]'}>
              <span className="font-medium">{h.day.slice(0, 3)}</span> {h.hours}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
