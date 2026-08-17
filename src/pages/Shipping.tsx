import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Tag, Download, XCircle, CheckCircle2, Receipt } from 'lucide-react';
import { api, type ShipmentPayload } from '../services/api';
import type { PackageInput, ShipmentResult, VoidResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import Button from '../components/ui/Button';
import { PackagesEditor, emptyPackage } from '../components/PackagesEditor';
import { money, downloadBase64 } from '../utils/format';

const LABEL_FORMATS = [
  { value: 'GIF', label: 'GIF (image)' },
  { value: 'PDF', label: 'PDF' },
  { value: 'ZPL', label: 'ZPL (imprimante thermique)' },
];

const REQUIRED_FIELDS: Array<{ key: keyof Address; label: string }> = [
  { key: 'name', label: 'nom' },
  { key: 'addressLine1', label: 'adresse' },
  { key: 'city', label: 'ville' },
  { key: 'postalCode', label: 'code postal' },
  { key: 'country', label: 'pays' },
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

  const missing = REQUIRED_FIELDS.filter((f) => !shipTo[f.key]);
  const invalidPackage = packages.some((p) => !p.weight || Number(p.weight) <= 0);
  const blockedReason = missing.length
    ? `Champs manquants : ${missing.map((f) => f.label).join(', ')}`
    : invalidPackage
      ? 'Chaque colis doit avoir un poids supérieur à 0'
      : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
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
    <div>
      <PageHeader
        title="Création d'étiquette"
        subtitle="Crée une expédition sur le compte UPS configuré et génère l'étiquette."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardTitle title="Destinataire" />
            <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="sm:col-span-2">
                <AddressAutocomplete
                  label="Adresse"
                  required
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
                maxLength={2}
                value={shipTo.state ?? ''}
                onChange={(e) => set({ state: e.target.value.toUpperCase() })}
              />
              <Field
                label="Pays (ISO 2)"
                required
                maxLength={2}
                value={shipTo.country ?? ''}
                onChange={(e) => set({ country: e.target.value.toUpperCase() })}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Téléphone"
                  placeholder="0102030405"
                  value={shipTo.phone ?? ''}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle title="Colis" hint={`${packages.length} colis dans l'expédition`} />
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
                placeholder="Copié depuis Points relais"
                value={accessPointLocationId}
                onChange={(e) => setAccessPointLocationId(e.target.value)}
              />
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<Tag className="h-4 w-4" />}
            >
              Créer l'expédition
            </SubmitBar>
          </Card>
        </form>

        <div className="lg:sticky lg:top-4">
          {mutation.isError ? (
            <Alert type="error">{mutation.error.message}</Alert>
          ) : mutation.isSuccess ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700" />
                <div>
                  <p className="text-[14px] font-semibold text-green-800">Expédition créée</p>
                  <p className="font-mono text-[12px] text-green-700">
                    {mutation.data.shipmentIdentificationNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] px-4 py-3">
                <span className="inline-flex items-center gap-2 text-[12px] text-[--k-muted]">
                  <Receipt className="h-4 w-4" />
                  {mutation.data.billingWeight
                    ? `Poids facturé : ${mutation.data.billingWeight}`
                    : 'Coût total'}
                </span>
                <span className="text-[18px] font-bold text-[--k-text]">
                  {money(mutation.data.totalCharges, mutation.data.currency)}
                </span>
              </div>

              {mutation.data.packages.map((pkg, i) => (
                <Card key={pkg.trackingNumber || i}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[--k-muted]">
                        Colis {i + 1}
                      </p>
                      <p className="font-mono text-[13px] font-medium text-[--k-text]">
                        {pkg.trackingNumber}
                      </p>
                    </div>
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
                      className="label-preview mt-3"
                      src={`data:${pkg.label.mime};base64,${pkg.label.base64}`}
                      alt={`Étiquette ${pkg.trackingNumber}`}
                    />
                  )}
                </Card>
              ))}

              <div className="rounded-xl border border-[--k-border] bg-[--k-surface] p-3">
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
            </div>
          ) : (
            <EmptyState
              icon={Tag}
              title="Aucune étiquette générée"
              description="Complétez le destinataire et les colis. En environnement test, aucune expédition réelle n'est facturée."
            />
          )}
        </div>
      </div>
    </div>
  );
}
