import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Tag, Download, XCircle } from 'lucide-react';
import { api, type ShipmentPayload } from '../services/api';
import type { PackageInput, ShipmentResult, VoidResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Field, SelectField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { PackagesEditor, emptyPackage } from '../components/PackagesEditor';
import { money, downloadBase64 } from '../utils/format';

const LABEL_FORMATS = [
  { value: 'GIF', label: 'GIF (image)' },
  { value: 'PDF', label: 'PDF' },
  { value: 'ZPL', label: 'ZPL (imprimante thermique)' },
];

const REQUIRED_FIELDS: Array<keyof Address> = [
  'name',
  'addressLine1',
  'city',
  'postalCode',
  'country',
];

export default function Shipping() {
  const [shipTo, setShipTo] = useState<Address>({ country: 'FR' });
  const [packages, setPackages] = useState<PackageInput[]>([emptyPackage()]);
  const [description, setDescription] = useState('Marchandise');
  const [serviceCode, setServiceCode] = useState('11');
  const [labelFormat, setLabelFormat] = useState('GIF');
  const [accessPointLocationId, setAccessPointLocationId] = useState('');

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    staleTime: Infinity,
  });

  const mutation = useMutation<ShipmentResult, Error, ShipmentPayload>({
    mutationFn: (payload) => api.createShipment(payload),
  });

  const voidMutation = useMutation<VoidResult, Error, string>({
    mutationFn: (shipmentId) => api.voidShipment(shipmentId),
  });

  const set = (patch: Partial<Address>) => setShipTo((prev) => ({ ...prev, ...patch }));

  const missing = REQUIRED_FIELDS.filter((f) => !shipTo[f]);
  const invalidPackage = packages.some((p) => !p.weight || Number(p.weight) <= 0);
  const canSubmit = missing.length === 0 && !invalidPackage;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({
      shipTo,
      packages,
      serviceCode,
      description,
      labelFormat,
      accessPointLocationId: accessPointLocationId || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Création d'étiquette"
        subtitle="Crée une expédition sur le compte UPS configuré et génère l'étiquette."
      />

      <Alert type="info" className="mb-4">
        En environnement <strong>test</strong>, aucune expédition réelle n'est facturée.
      </Alert>

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardTitle title="Destinataire" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Nom"
              required
              placeholder="Jean Dupont"
              value={shipTo.name ?? ''}
              onChange={(e) => set({ name: e.target.value })}
            />
            <Field
              label="Contact"
              placeholder="Service réception"
              value={shipTo.attentionName ?? ''}
              onChange={(e) => set({ attentionName: e.target.value })}
            />
            <Field
              label="Téléphone"
              placeholder="0102030405"
              value={shipTo.phone ?? ''}
              onChange={(e) => set({ phone: e.target.value })}
            />
            <Field
              label="Adresse"
              required
              placeholder="10 rue Victor Hugo"
              value={shipTo.addressLine1 ?? ''}
              onChange={(e) => set({ addressLine1: e.target.value })}
            />
            <Field
              label="Ville"
              required
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
              label="État (si applicable)"
              value={shipTo.state ?? ''}
              onChange={(e) => set({ state: e.target.value.toUpperCase() })}
            />
            <Field
              label="Pays (ISO 2)"
              required
              value={shipTo.country ?? ''}
              onChange={(e) => set({ country: e.target.value.toUpperCase() })}
            />
          </div>
        </Card>

        <Card>
          <CardTitle title="Colis" />
          <PackagesEditor packages={packages} onChange={setPackages} withReference />
        </Card>

        <Card>
          <CardTitle title="Options d'expédition" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            <SelectField
              label="Format d'étiquette"
              value={labelFormat}
              onChange={(e) => setLabelFormat(e.target.value)}
            >
              {LABEL_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </SelectField>
            <Field
              label="ID point relais (optionnel)"
              placeholder="Livraison en point relais"
              value={accessPointLocationId}
              onChange={(e) => setAccessPointLocationId(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button type="submit" isLoading={mutation.isPending} disabled={!canSubmit}>
              {!mutation.isPending && <Tag className="h-4 w-4" />}
              Créer l'expédition
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
        <div className="mt-4 space-y-4">
          <Alert type="success">Expédition créée avec succès.</Alert>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[--k-text]">
                  Expédition {mutation.data.shipmentIdentificationNumber}
                </h2>
                {mutation.data.billingWeight && (
                  <p className="mt-0.5 text-[12px] text-[--k-muted]">
                    Poids facturé : {mutation.data.billingWeight}
                  </p>
                )}
              </div>
              <div className="text-[18px] font-bold text-[--k-text]">
                {money(mutation.data.totalCharges, mutation.data.currency)}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {mutation.data.packages.map((pkg, i) => (
                <div key={pkg.trackingNumber || i} className="rounded-xl border border-[--k-border] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-[--k-text]">
                      Colis {i + 1} — {pkg.trackingNumber}
                    </span>
                    {pkg.label && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          downloadBase64(
                            pkg.label!.base64,
                            pkg.label!.mime,
                            `etiquette-${pkg.trackingNumber}.${pkg.label!.ext}`
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                        Télécharger
                      </Button>
                    )}
                  </div>
                  {pkg.label?.mime.startsWith('image/') && (
                    <img
                      className="label-preview mt-2"
                      src={`data:${pkg.label.mime};base64,${pkg.label.base64}`}
                      alt={`Étiquette ${pkg.trackingNumber}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-[--k-border] pt-3">
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={voidMutation.isPending}
                onClick={() => voidMutation.mutate(mutation.data.shipmentIdentificationNumber)}
              >
                {!voidMutation.isPending && <XCircle className="h-4 w-4" />}
                Annuler cette expédition
              </Button>

              {voidMutation.isError && (
                <Alert type="error" className="mt-3">
                  {voidMutation.error.message}
                </Alert>
              )}
              {voidMutation.isSuccess && (
                <Alert type={voidMutation.data.success ? 'success' : 'error'} className="mt-3">
                  {voidMutation.data.message}
                </Alert>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
