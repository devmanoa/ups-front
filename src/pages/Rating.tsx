import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { api, type RatePayload } from '../services/api';
import type { PackageInput, RatingResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Field, SelectField } from '../components/ui/Field';
import Button from '../components/ui/Button';
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
  const canSubmit = Boolean(shipTo.postalCode) && !invalidPackage;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({
      shipTo,
      packages,
      requestOption,
      // Le code service n'est transmis qu'en mode "Rate*", ignoré sinon.
      serviceCode: requestOption.startsWith('Rate') ? serviceCode : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Calcul de tarifs" subtitle="Comparez les services UPS pour une destination." />

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardTitle title="Destination" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Adresse"
              placeholder="10 rue Victor Hugo"
              value={shipTo.addressLine1 ?? ''}
              onChange={(e) => set({ addressLine1: e.target.value })}
            />
            <Field
              label="Ville"
              placeholder="Lyon"
              value={shipTo.city ?? ''}
              onChange={(e) => set({ city: e.target.value })}
            />
            <Field
              label="Code postal"
              required
              placeholder="69001"
              value={shipTo.postalCode ?? ''}
              onChange={(e) => set({ postalCode: e.target.value })}
            />
            <Field
              label="Pays (ISO 2)"
              required
              value={shipTo.country ?? ''}
              onChange={(e) => set({ country: e.target.value.toUpperCase() })}
            />
            <SelectField
              label="Type d'adresse"
              value={shipTo.residential ? '1' : ''}
              onChange={(e) => set({ residential: e.target.value === '1' })}
            >
              <option value="">Professionnelle</option>
              <option value="1">Résidentielle</option>
            </SelectField>
          </div>
        </Card>

        <Card>
          <CardTitle title="Colis" />
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
          <div className="mt-4">
            <Button type="submit" isLoading={mutation.isPending} disabled={!canSubmit}>
              {!mutation.isPending && <Calculator className="h-4 w-4" />}
              Calculer les tarifs
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
          {mutation.data.rates.length === 0 ? (
            <Alert type="info">Aucun tarif retourné pour cette destination.</Alert>
          ) : (
            <Card>
              <CardTitle title={`${mutation.data.rates.length} tarif(s) disponible(s)`} />
              <div className="space-y-2">
                {mutation.data.rates.map((rate) => (
                  <div
                    key={rate.serviceCode}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[--k-border] px-3 py-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[--k-text]">
                          {rate.serviceName}
                        </span>
                        {rate.isNegotiated && <Badge tone="success">Tarif négocié</Badge>}
                      </div>
                      <p className="mt-0.5 text-[12px] text-[--k-muted]">
                        {[
                          `Code ${rate.serviceCode}`,
                          rate.billingWeight && `Poids facturé : ${rate.billingWeight}`,
                          rate.guaranteedDays && `${rate.guaranteedDays} jour(s)`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="text-[18px] font-bold text-[--k-text]">
                      {money(rate.totalCharges, rate.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
