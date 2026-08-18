import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const initial = searchParams.get('number') ?? '';
  const [trackingNumber, setTrackingNumber] = useState(initial);

  const mutation = useMutation<TrackingResult, Error, string>({
    mutationFn: (value) => api.track(value),
  });

  // Recherche automatique quand on arrive depuis la liste des envois.
  useEffect(() => {
    if (initial) mutation.mutate(initial);
    // Volontairement limité au montage : relancer à chaque rendu bouclerait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = trackingNumber.trim();
    if (value) mutation.mutate(value);
  };

  /**
   * Le backend compare le numéro interrogé à TOUS les colis renvoyés
   * (alias inclus) et porte son verdict dans `matched` : ni duplication de
   * la règle ici, ni fausse alerte sur les envois multi-colis.
   * `=== false` : un backend antérieur sans ce champ ne déclenche rien.
   */
  const mismatch =
    mutation.isSuccess && (mutation.data.packages?.length ?? 0) > 0 && mutation.data.matched === false;
  const returnedNumber = mutation.data?.packages?.[0]?.trackingNumber;

  return (
    <div>
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

      {/* UPS renvoie un colis de démonstration quand le numéro n'existe pas.
          Sans avertissement, l'utilisateur prendrait ces données pour les
          siennes après une simple faute de frappe. */}
      {mismatch && (
        <Alert type="info" className="mb-4">
          {returnedNumber ? (
            <>
              UPS a répondu pour le numéro <strong>{returnedNumber}</strong>, différent de celui
              saisi (<strong>{mutation.variables}</strong>).
            </>
          ) : (
            <>Aucun des colis renvoyés ne correspond au numéro saisi ({mutation.variables}).</>
          )}
          <span className="mt-1 block text-[12px] opacity-80">
            Vérifiez votre saisie : les informations ci-dessous concernent un autre colis.
          </span>
        </Alert>
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
