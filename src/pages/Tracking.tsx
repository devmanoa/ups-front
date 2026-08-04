import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  PackageSearch,
  CheckCircle2,
  Truck,
  MapPin,
  Clock,
  Weight,
  UserCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { TrackedPackage, TrackingResult } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { formatDate } from '../utils/format';

export default function Tracking() {
  const [trackingNumber, setTrackingNumber] = useState('');

  const mutation = useMutation<TrackingResult, Error, string>({
    mutationFn: (value) => api.track(value),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = trackingNumber.trim();
    if (value) mutation.mutate(value);
  };

  return (
    <div className="max-w-[1000px]">
      <PageHeader
        title="Suivi de colis"
        subtitle="Recherchez un colis par son numéro de suivi UPS."
      />

      <Card className="mb-4">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field
              label="Numéro de suivi"
              required
              placeholder="1Z12345E1512345676"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="font-mono"
            />
          </div>
          <Button type="submit" isLoading={mutation.isPending} disabled={!trackingNumber.trim()}>
            {!mutation.isPending && <Search className="h-4 w-4" />}
            Suivre
          </Button>
        </form>
      </Card>

      {mutation.isError && <Alert type="error">{mutation.error.message}</Alert>}

      {mutation.isSuccess && mutation.data.packages.length === 0 && (
        <Alert type="info">Aucun colis trouvé pour ce numéro.</Alert>
      )}

      {mutation.isIdle && (
        <EmptyState
          icon={PackageSearch}
          title="Aucun colis suivi"
          description="Saisissez un numéro de suivi UPS (format 1Z…) pour afficher son statut et l'historique de son acheminement."
        />
      )}

      <div className="space-y-4">
        {mutation.data?.packages.map((pkg) => (
          <PackageCard key={pkg.trackingNumber} pkg={pkg} />
        ))}
      </div>
    </div>
  );
}

function PackageCard({ pkg }: { pkg: TrackedPackage }) {
  // UPS renvoie 011 pour « livré » ; le libellé sert de repli car le code
  // n'est pas toujours présent selon le service.
  const delivered = pkg.currentStatusCode === '011' || /livr/i.test(pkg.currentStatus);

  const meta = [
    pkg.service && { icon: Truck, text: pkg.service },
    pkg.weight && { icon: Weight, text: pkg.weight },
    pkg.deliveryDate && { icon: Clock, text: formatDate(pkg.deliveryDate) },
    pkg.deliveredTo && { icon: UserCheck, text: `Reçu par ${pkg.deliveredTo}` },
  ].filter(Boolean) as Array<{ icon: typeof Truck; text: string }>;

  return (
    <Card className="overflow-hidden !p-0">
      {/* Bandeau de statut : l'information la plus recherchée en premier. */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
          delivered ? 'bg-green-50' : 'bg-[--k-primary-2]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              delivered ? 'bg-green-100' : 'bg-white'
            }`}
          >
            {delivered ? (
              <CheckCircle2 className="h-4 w-4 text-green-700" />
            ) : (
              <Truck className="h-4 w-4 text-[--k-primary]" />
            )}
          </span>
          <div>
            <p
              className={`text-[14px] font-semibold ${
                delivered ? 'text-green-800' : 'text-indigo-900'
              }`}
            >
              {pkg.currentStatus}
            </p>
            <p className="font-mono text-[12px] text-[--k-muted]">{pkg.trackingNumber}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {meta.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {meta.map((m, i) => {
              const Icon = m.icon;
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-[12px] text-[--k-muted]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.text}
                </span>
              );
            })}
          </div>
        )}

        {pkg.activities.length > 0 ? (
          <ol className="border-l-2 border-[--k-border] pl-5">
            {pkg.activities.map((act, i) => (
              <li key={i} className="relative pb-4 last:pb-0">
                <span
                  className={`absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    i === 0 ? 'bg-[--k-primary] ring-2 ring-[--k-primary]/20' : 'bg-[--k-border]'
                  }`}
                />
                <div
                  className={`text-[13px] ${
                    i === 0 ? 'font-semibold text-[--k-text]' : 'font-medium text-[--k-text]'
                  }`}
                >
                  {act.status}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-[--k-muted]">
                  {act.date && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(act.date)}
                    </span>
                  )}
                  {act.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {act.location}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px] text-[--k-muted]">Aucun événement disponible.</p>
        )}
      </div>
    </Card>
  );
}
