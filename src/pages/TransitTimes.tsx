import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Clock, Search, CalendarDays, Zap, ShieldCheck } from 'lucide-react';
import { api, type TransitPayload } from '../services/api';
import type { TransitResult, TransitService, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';

/** Date du jour au format AAAA-MM-JJ, valeur par défaut d'expédition. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TransitTimes() {
  const [shipTo, setShipTo] = useState<Address>({ country: 'FR' });
  const [weight, setWeight] = useState('1');
  const [weightUnit, setWeightUnit] = useState('KGS');
  const [shipDate, setShipDate] = useState(today());
  const [numberOfPackages, setNumberOfPackages] = useState('1');

  const mutation = useMutation<TransitResult, Error, TransitPayload>({
    mutationFn: (payload) => api.getTransitTimes(payload),
  });

  const set = (patch: Partial<Address>) => setShipTo((prev) => ({ ...prev, ...patch }));

  const weightNum = Number(weight);
  const blockedReason =
    !shipTo.postalCode && !shipTo.city
      ? 'Renseignez une ville ou un code postal de destination'
      : !Number.isFinite(weightNum) || weightNum <= 0
        ? 'Le poids doit être supérieur à 0'
        : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    mutation.mutate({
      shipTo,
      weight: weightNum,
      weightUnit,
      shipDate,
      numberOfPackages: Number(numberOfPackages) || 1,
    });
  };

  return (
    <div>
      <PageHeader
        title="Délais de livraison"
        subtitle="Estimez les délais d'acheminement UPS entre votre adresse d'expédition et une destination."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit}>
          <Card>
            <CardTitle title="Destination et envoi" />
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <AddressAutocomplete
                  label="Adresse de destination"
                  placeholder="Commencez à taper l'adresse…"
                  value={shipTo.addressLine1 ?? ''}
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
              <div className="sm:col-span-3">
                <Field
                  label="Ville"
                  placeholder="Lyon"
                  value={shipTo.city ?? ''}
                  onChange={(e) => set({ city: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Code postal"
                  placeholder="69001"
                  value={shipTo.postalCode ?? ''}
                  onChange={(e) => set({ postalCode: e.target.value })}
                />
              </div>
              <div className="sm:col-span-1">
                <Field
                  label="Pays"
                  required
                  maxLength={2}
                  value={shipTo.country ?? ''}
                  onChange={(e) => set({ country: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Poids"
                  required
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <SelectField
                  label="Unité"
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value)}
                >
                  <option value="KGS">Kilogrammes</option>
                  <option value="LBS">Livres</option>
                </SelectField>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Nb de colis"
                  type="number"
                  min="1"
                  value={numberOfPackages}
                  onChange={(e) => setNumberOfPackages(e.target.value)}
                />
              </div>
              <div className="sm:col-span-6">
                <Field
                  label="Date d'expédition"
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                />
              </div>
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<Search className="h-4 w-4" />}
            >
              Estimer les délais
            </SubmitBar>
          </Card>
        </form>

        <div className="lg:sticky lg:top-4">
          {mutation.isError ? (
            <Alert type="error">{mutation.error.message}</Alert>
          ) : mutation.isSuccess ? (
            mutation.data.services.length === 0 ? (
              <Alert type="info">Aucun délai retourné pour cette destination.</Alert>
            ) : (
              <Card>
                <CardTitle
                  title={`${mutation.data.services.length} service(s)`}
                  hint="Du plus rapide au plus lent."
                />
                <div className="space-y-2">
                  {mutation.data.services.map((s, i) => (
                    <TransitRow key={s.serviceCode || i} service={s} fastest={i === 0} />
                  ))}
                </div>
              </Card>
            )
          ) : (
            <EmptyState
              icon={Clock}
              title="Aucun délai estimé"
              description="Renseignez la destination et le poids, puis lancez l'estimation pour comparer les délais de chaque service UPS."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TransitRow({ service, fastest }: { service: TransitService; fastest: boolean }) {
  const date = service.deliveryDate
    ? new Date(service.deliveryDate).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      })
    : null;

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        fastest
          ? 'border-[--k-primary]/40 bg-[--k-primary-2]/40'
          : 'border-[--k-border] hover:border-[--k-primary]/30'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-semibold text-[--k-text]">{service.serviceName}</span>
            {fastest && (
              <Badge tone="primary">
                <Zap className="h-3 w-3" />
                Le plus rapide
              </Badge>
            )}
            {service.guaranteed && (
              <Badge tone="success">
                <ShieldCheck className="h-3 w-3" />
                Garanti
              </Badge>
            )}
          </div>
          {date && (
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-[--k-muted]">
              <CalendarDays className="h-3 w-3" />
              Livraison estimée : {date}
              {service.deliveryTime && ` à ${service.deliveryTime}`}
            </p>
          )}
        </div>
        {service.businessDaysInTransit != null && (
          <div className="text-right">
            <div className="text-[18px] font-bold text-[--k-text]">
              {service.businessDaysInTransit}
            </div>
            <div className="text-[11px] text-[--k-muted]">jour(s) ouvré(s)</div>
          </div>
        )}
      </div>
    </div>
  );
}
