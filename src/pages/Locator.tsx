import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPin, Search, ExternalLink, Phone } from 'lucide-react';
import { api, type LocatorPayload } from '../services/api';
import type { AccessPointLocation, LocatorResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Field, SelectField } from '../components/ui/Field';
import Button from '../components/ui/Button';

export default function Locator() {
  const [address, setAddress] = useState<Address>({ country: 'FR' });
  const [radius, setRadius] = useState('25');
  const [unit, setUnit] = useState('KM');
  const [maxResults, setMaxResults] = useState('10');

  const mutation = useMutation<LocatorResult, Error, LocatorPayload>({
    mutationFn: (payload) => api.findAccessPoints(payload),
  });

  const set = (patch: Partial<Address>) => setAddress((prev) => ({ ...prev, ...patch }));

  const canSubmit = Boolean(address.postalCode || address.city);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({
      address,
      radius: Number(radius) || 25,
      unit,
      maxResults: Number(maxResults) || 10,
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Points relais"
        subtitle="Recherchez les UPS Access Points autour d'une adresse."
      />

      <form onSubmit={submit}>
        <Card>
          <CardTitle title="Zone de recherche" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Adresse"
              placeholder="1 rue de la Paix"
              value={address.addressLine1 ?? ''}
              onChange={(e) => set({ addressLine1: e.target.value })}
            />
            <Field
              label="Ville"
              placeholder="Paris"
              value={address.city ?? ''}
              onChange={(e) => set({ city: e.target.value })}
            />
            <Field
              label="Code postal"
              required
              placeholder="75002"
              value={address.postalCode ?? ''}
              onChange={(e) => set({ postalCode: e.target.value })}
            />
            <Field
              label="Pays (ISO 2)"
              required
              value={address.country ?? ''}
              onChange={(e) => set({ country: e.target.value.toUpperCase() })}
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
            <Field
              label="Nombre de résultats"
              type="number"
              min="1"
              max="50"
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button type="submit" isLoading={mutation.isPending} disabled={!canSubmit}>
              {!mutation.isPending && <Search className="h-4 w-4" />}
              Rechercher
            </Button>
          </div>
        </Card>
      </form>

      {mutation.isError && (
        <Alert type="error" className="mt-4">
          {mutation.error.message}
        </Alert>
      )}

      {mutation.isSuccess && (
        <div className="mt-4">
          {mutation.data.locations.length === 0 ? (
            <Alert type="info">Aucun point relais trouvé dans ce rayon.</Alert>
          ) : (
            <Card>
              <CardTitle title={`${mutation.data.locations.length} point(s) relais trouvé(s)`} />
              <div className="space-y-2">
                {mutation.data.locations.map((loc, i) => (
                  <LocationRow key={loc.locationId || i} loc={loc} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function LocationRow({ loc }: { loc: AccessPointLocation }) {
  const address = [...loc.addressLines, loc.postalCode, loc.city].filter(Boolean).join(', ');

  return (
    <div className="rounded-xl border border-[--k-border] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[--k-text]">
          <MapPin className="h-4 w-4 text-[--k-primary]" />
          {loc.name || 'Point relais'}
        </h3>
        {loc.distance && (
          <Badge tone="primary">
            {loc.distance.value} {loc.distance.unit}
          </Badge>
        )}
      </div>

      <p className="mt-1 text-[12px] text-[--k-muted]">{address}</p>

      <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-[--k-muted]">
        {loc.phone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {loc.phone}
          </span>
        )}
        {loc.locationId && (
          <span>
            ID :{' '}
            <code className="rounded bg-[--k-surface-2] px-1 py-0.5 text-[11px]">
              {loc.locationId}
            </code>
          </span>
        )}
        {loc.latitude != null && loc.longitude != null && (
          <a
            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[--k-primary] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Voir sur la carte
          </a>
        )}
      </div>

      {loc.openingHours.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 text-[12px] text-[--k-muted] sm:grid-cols-3">
          {loc.openingHours.map((h) => (
            <div key={h.day}>
              <span className="font-medium">{h.day}</span> : {h.hours}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
