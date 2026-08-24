import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Tag, Download, XCircle, CheckCircle2, Receipt, Printer, Truck, Building2 } from 'lucide-react';
import { api, type ShipmentPayload } from '../services/api';
import type { PackageInput, ShipmentResult, VoidResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { AddressPicker, SaveToBook } from '../components/ui/AddressPicker';
import Button from '../components/ui/Button';
import { PackagesEditor, emptyPackage } from '../components/PackagesEditor';
import { money, downloadBase64, printBase64, isPrintable } from '../utils/format';

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

/** Préférence d'impression automatique, retenue d'une session à l'autre. */
const AUTOPRINT_KEY = 'ups.autoprint';

function readAutoPrint(): boolean {
  try {
    // Activée par défaut : c'est le comportement du site UPS, et l'intérêt
    // même de la fonction. Le réglage sert à s'en passer.
    return localStorage.getItem(AUTOPRINT_KEY) !== 'false';
  } catch {
    // Navigation privée ou stockage bloqué : on garde le défaut.
    return true;
  }
}

export default function Shipping() {
  const [searchParams] = useSearchParams();
  // Identifiant d'antenne passé par l'application Antennes
  // (`/shipping?antenne=10`). Le jeton d'accès reste côté backend.
  const antenneId = searchParams.get('antenne');

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

  const [autoPrint, setAutoPrint] = useState(readAutoPrint);

  const antenne = useQuery({
    queryKey: ['antenne', antenneId],
    queryFn: () => api.getAntenneContact(antenneId!),
    enabled: Boolean(antenneId),
    retry: false,
    staleTime: Infinity,
  });

  /**
   * Remplit le destinataire dès que l'antenne est chargée.
   *
   * `hasFilled` évite d'écraser une correction : sans lui, react-query
   * réhydratant le cache remettrait l'adresse d'origine et effacerait ce que
   * l'utilisateur vient de saisir.
   */
  const hasFilled = useRef(false);
  useEffect(() => {
    if (!antenne.data || hasFilled.current) return;
    hasFilled.current = true;

    const { email, ...address } = antenne.data.recipient;
    setShipTo((prev) => ({ ...prev, ...address }));
  }, [antenne.data]);

  const mutation = useMutation<ShipmentResult, Error, ShipmentPayload>({
    mutationFn: (payload) => api.createShipment(payload),
    onSuccess: (result) => {
      if (!autoPrint) return;

      // Une seule boîte de dialogue par expédition : imprimer colis par colis
      // enchaînerait autant de dialogues qu'il y a d'étiquettes.
      const first = result.packages?.find((p) => p.label && isPrintable(p.label.mime));
      if (first?.label) printBase64(first.label.base64, first.label.mime);
    },
  });

  const voidMutation = useMutation<VoidResult, Error, string>({
    mutationFn: (shipmentId) => api.voidShipment(shipmentId),
  });

  /** Numéros des colis créés, à rattacher à un éventuel enlèvement. */
  const trackingNumbers =
    mutation.data?.packages
      ?.map((p) => p.trackingNumber)
      .filter((n): n is string => Boolean(n)) ?? [];

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
      // Rattache l'envoi à son antenne d'origine : sans cela, impossible de
      // savoir plus tard pour quelle antenne l'étiquette a été faite.
      antenne: antenne.data
        ? { contactId: antenne.data.contactId, antenneId: antenne.data.antenneId }
        : undefined,
    });
  };

  return (
    <div>
      <PageHeader
        title="Création d'étiquette"
        subtitle="Crée une expédition sur le compte UPS configuré et génère l'étiquette."
      />

      {/* Provenance annoncée : sans elle, on ne saurait pas d'où vient une
          adresse déjà remplie, ni qu'elle reste modifiable. */}
      {antenneId && antenne.isLoading && (
        <Alert type="info" className="mb-4">
          Chargement de l’adresse de l’antenne…
        </Alert>
      )}

      {antenne.isError && (
        <Alert type="error" className="mb-4">
          {(antenne.error as Error).message} — saisissez l’adresse à la main.
        </Alert>
      )}

      {antenne.data && (
        <Alert type="info" className="mb-4">
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <Building2 className="h-4 w-4" />
            Adresse préremplie depuis l’antenne
            <strong>
              {antenne.data.antenneVille ?? `n° ${antenne.data.contactId}`}
            </strong>
            {antenne.data.etat && antenne.data.etat !== 'actif' && (
              <strong className="text-[--k-danger]">— antenne {antenne.data.etat}</strong>
            )}
            <span className="text-[--k-muted]">· modifiable avant validation</span>
          </span>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardTitle title="Destinataire" />
            <AddressPicker
              className="mb-3"
              autoLoadDefault
              onSelect={(address) => setShipTo(address)}
            />
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

              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => {
                    setAutoPrint(e.target.checked);
                    try {
                      localStorage.setItem(AUTOPRINT_KEY, String(e.target.checked));
                    } catch {
                      // Stockage indisponible : le choix ne vaut que pour cette session.
                    }
                  }}
                />
                <span className="text-[13px] text-[--k-text]">
                  Ouvrir l’impression dès l’étiquette créée
                  {labelFormat === 'ZPL' && (
                    <span className="text-[--k-muted]">
                      {' '}
                      — sans effet en ZPL, format réservé aux imprimantes thermiques
                    </span>
                  )}
                </span>
              </label>
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

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[--k-border] bg-[--k-surface] p-3">
                {/* Les numéros passent par l'URL ; l'adresse d'enlèvement n'est
                    pas pré-remplie, c'est celle de l'expéditeur (d'où part le
                    chauffeur), pas celle du destinataire de l'étiquette. */}
                {trackingNumbers.length > 0 && (
                  <Link to={`/pickup?tracking=${encodeURIComponent(trackingNumbers.join(','))}`}>
                    <Button type="button" variant="secondary" size="sm">
                      <Truck className="h-4 w-4" />
                      Prévoir un enlèvement
                    </Button>
                  </Link>
                )}
                <SaveToBook address={shipTo} suggestedLabel={shipTo.name} />
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
                      <div className="flex gap-2">
                        {/* Les formats thermiques (ZPL, EPL, SPL) ne s'impriment
                            pas depuis le navigateur : seul le téléchargement
                            a du sens pour eux. */}
                        {isPrintable(pkg.label.mime) && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => printBase64(pkg.label!.base64, pkg.label!.mime)}
                          >
                            <Printer className="h-4 w-4" />
                            Imprimer
                          </Button>
                        )}
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
                      </div>
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
