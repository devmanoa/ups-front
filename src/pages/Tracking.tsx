import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, PackageCheck } from 'lucide-react';
import { api } from '../services/api';
import type { TrackedPackage, TrackingResult } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
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
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Suivi de colis" subtitle="Recherchez un colis par son numéro de suivi UPS." />

      <Card className="mb-4">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field
              label="Numéro de suivi"
              required
              placeholder="1Z12345E1512345676"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <Button type="submit" isLoading={mutation.isPending} disabled={!trackingNumber.trim()}>
            {!mutation.isPending && <Search className="h-4 w-4" />}
            Suivre
          </Button>
        </form>
      </Card>

      {mutation.isError && (
        <Alert type="error" className="mb-4">
          {mutation.error.message}
        </Alert>
      )}

      {mutation.isSuccess && mutation.data.packages.length === 0 && (
        <Alert type="info">Aucun colis trouvé pour ce numéro.</Alert>
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
  // UPS renvoie 011 pour "livré" ; le libellé est vérifié en repli car le
  // code n'est pas toujours présent selon le type de service.
  const delivered = pkg.currentStatusCode === '011' || /livr/i.test(pkg.currentStatus);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[--k-text]">
            <PackageCheck className="h-4 w-4 text-[--k-primary]" />
            {pkg.trackingNumber}
          </h2>
          <p className="mt-1 text-[12px] text-[--k-muted]">
            {[
              pkg.service && `Service : ${pkg.service}`,
              pkg.weight && `Poids : ${pkg.weight}`,
              pkg.deliveryDate && `Livraison : ${formatDate(pkg.deliveryDate)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {pkg.deliveredTo && (
            <p className="mt-0.5 text-[12px] text-[--k-muted]">Réceptionné par : {pkg.deliveredTo}</p>
          )}
        </div>
        <Badge tone={delivered ? 'success' : 'primary'}>{pkg.currentStatus}</Badge>
      </div>

      {pkg.activities.length > 0 ? (
        <ol className="mt-4 border-l-2 border-[--k-border] pl-5">
          {pkg.activities.map((act, i) => (
            <li key={i} className="relative pb-4 last:pb-0">
              <span
                className={`absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  i === 0 ? 'bg-[--k-primary]' : 'bg-[--k-border]'
                }`}
              />
              <div className="text-[13px] font-medium text-[--k-text]">{act.status}</div>
              <div className="text-[12px] text-[--k-muted]">
                {[formatDate(act.date), act.location].filter(Boolean).join(' — ')}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-[12px] text-[--k-muted]">Aucun événement disponible.</p>
      )}
    </Card>
  );
}
