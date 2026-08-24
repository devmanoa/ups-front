import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Calculator, Clock, Weight, Trophy, Package } from 'lucide-react';
import { api, type RatePayload } from '../services/api';
import type { PackageInput, RatingResult, Address, Rate } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { AddressPicker } from '../components/ui/AddressPicker';
import { PackagesEditor, emptyPackage } from '../components/PackagesEditor';
import { money } from '../utils/format';

const REQUEST_OPTIONS = [
  { value: 'Shop', label: 'Tous les services' },
  { value: 'Shoptimeintransit', label: 'Tous les services + délais' },
  { value: 'Rate', label: 'Un service précis' },
];

export default function Rating() {
  const [shipTo, setShipTo] = useState<Address>({ country: 'FR' });
  const [packages, setPackages] = useState<PackageInput[]>([emptyPackage()]);
  const [requestOption, setRequestOption] = useState('Shop');
  const [serviceCode, setServiceCode] = useState('11');

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    staleTime: Infinity,
  });

  const mutation = useMutation<RatingResult, Error, RatePayload>({
    mutationFn: (payload) => api.getRates(payload),
  });

  const set = (patch: Partial<Address>) => setShipTo((prev) => ({ ...prev, ...patch }));

  const invalidPackage = packages.some((p) => !p.weight || Number(p.weight) <= 0);
  const blockedReason = !shipTo.postalCode
    ? 'Le code postal de destination est obligatoire'
    : invalidPackage
      ? 'Chaque colis doit avoir un poids supérieur à 0'
      : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    mutation.mutate({
      shipTo,
      packages,
      requestOption,
      // Le code service n'a de sens qu'en mode « Rate » ; ignoré sinon.
      serviceCode: requestOption.startsWith('Rate') ? serviceCode : undefined,
    });
  };

  return (
    <div>
      <PageHeader
        title="Calcul de tarifs"
        subtitle="Comparez les services UPS disponibles pour une destination."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardTitle title="Destination" />
            <AddressPicker className="mb-3" onSelect={(address) => setShipTo(address)} />
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <AddressAutocomplete
                  label="Adresse"
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
                  required
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
              <div className="sm:col-span-6">
                <SelectField
                  label="Type d'adresse"
                  value={shipTo.residential ? '1' : ''}
                  onChange={(e) => set({ residential: e.target.value === '1' })}
                >
                  <option value="">Professionnelle</option>
                  <option value="1">Résidentielle</option>
                </SelectField>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle title="Colis" hint={`${packages.length} colis dans l'expédition`} />
            <PackagesEditor packages={packages} onChange={setPackages} />
          </Card>

          <Card>
            <CardTitle title="Options" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Mode de calcul"
                value={requestOption}
                onChange={(e) => setRequestOption(e.target.value)}
              >
                {REQUEST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
              {requestOption.startsWith('Rate') && (
                <SelectField
                  label="Service"
                  value={serviceCode}
                  onChange={(e) => setServiceCode(e.target.value)}
                >
                  {(services.data ?? [{ code: '11', name: 'UPS Standard' }]).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<Calculator className="h-4 w-4" />}
            >
              Calculer les tarifs
            </SubmitBar>
          </Card>
        </form>

        <div className="lg:sticky lg:top-4">
          {mutation.isError ? (
            <Alert type="error">{mutation.error.message}</Alert>
          ) : mutation.isSuccess ? (
            mutation.data.rates.length === 0 ? (
              <Alert type="info">Aucun tarif retourné pour cette destination.</Alert>
            ) : (
              <div className="space-y-3">
                <Card>
                  <CardTitle
                    title={`${mutation.data.rates.length} tarif(s)`}
                    hint="Classés du moins cher au plus cher."
                  />
                  <div className="space-y-2">
                    {mutation.data.rates.map((rate, i) => (
                      <RateRow key={rate.serviceCode} rate={rate} best={i === 0} />
                    ))}
                  </div>
                </Card>

                {/* Services écartés par UPS : informatif, les tarifs ci-dessus restent valides. */}
                {mutation.data.warnings && mutation.data.warnings.length > 0 && (
                  <details className="rounded-xl border border-[--k-border] bg-[--k-surface] px-3 py-2">
                    <summary className="cursor-pointer text-[12px] font-medium text-[--k-muted]">
                      {mutation.data.warnings.length} service(s) non applicable(s)
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {mutation.data.warnings.map((w, i) => (
                        <li key={i} className="text-[12px] text-[--k-muted]">
                          {w.message}
                          {w.code && <span className="opacity-60"> (UPS {w.code})</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )
          ) : (
            <EmptyState
              icon={Package}
              title="Aucun tarif calculé"
              description="Renseignez la destination et le poids des colis, puis lancez le calcul pour comparer les services UPS."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RateRow({ rate, best }: { rate: Rate; best: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        best
          ? 'border-[--k-primary]/40 bg-[--k-primary-2]/40'
          : 'border-[--k-border] hover:border-[--k-primary]/30'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-semibold text-[--k-text]">{rate.serviceName}</span>
            {best && (
              <Badge tone="primary">
                <Trophy className="h-3 w-3" />
                Le moins cher
              </Badge>
            )}
            {rate.isNegotiated && <Badge tone="success">Négocié</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[--k-muted]">
            <span>Code {rate.serviceCode}</span>
            {rate.billingWeight && (
              <span className="inline-flex items-center gap-1">
                <Weight className="h-3 w-3" />
                {rate.billingWeight}
              </span>
            )}
            {rate.guaranteedDays && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {rate.guaranteedDays} jour(s)
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-bold text-[--k-text]">
            {money(rate.totalCharges, rate.currency)}
          </div>
          {rate.isNegotiated && rate.publishedCharges != null && (
            <div className="text-[11px] text-[--k-muted] line-through">
              {money(rate.publishedCharges, rate.currency)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
