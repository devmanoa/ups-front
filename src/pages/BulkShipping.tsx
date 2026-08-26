import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Layers, Plus, Trash2, Upload, CheckCircle2, XCircle, FileDown, ClipboardList, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { BulkEntry, BulkResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { AddressPicker } from '../components/ui/AddressPicker';
import { printImages } from '../utils/format';

const CSV_HEADER = 'nom;adresse;ville;code_postal;pays;poids;reference;type';
const CSV_EXAMPLE = `${CSV_HEADER}
Jean Dupont;10 rue Victor Hugo;Lyon;69001;FR;2;CMD-001;
Marie Martin;5 avenue de la Gare;Nantes;44000;FR;;CMD-002;DS620`;

const emptyEntry = (): BulkEntry => ({
  shipTo: { country: 'FR' },
  packages: [{ weight: '1' }],
});

/**
 * Analyse un CSV point-virgule. La première ligne peut être l'en-tête.
 * Format attendu : nom;adresse;ville;code_postal;pays;poids;reference;type
 * La colonne « type » désigne un type du catalogue et dispense du poids.
 */
function parseCsv(text: string): { entries: BulkEntry[]; errors: string[] } {
  const entries: BulkEntry[] = [];
  const errors: string[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const [i, line] of lines.entries()) {
    // Ignore la ligne d'en-tête si elle est présente.
    if (i === 0 && /nom\s*;/i.test(line)) continue;

    const cols = line.split(';').map((c) => c.trim());
    const [name, address, city, postalCode, country, weight, reference, packageType] = cols;

    if (!name || !address || !city || !postalCode) {
      errors.push(`Ligne ${i + 1} : nom, adresse, ville et code postal sont obligatoires.`);
      continue;
    }

    // Un type nommé dispense de renseigner le poids : le backend le retrouve
    // dans le catalogue. Sans type ni poids, on retombe sur 1 kg.
    if (!weight && !packageType) {
      errors.push(`Ligne ${i + 1} : indiquez un poids ou un type de colis.`);
      continue;
    }

    let weightValue: string | undefined;
    if (weight) {
      const weightNum = Number(weight.replace(',', '.'));
      if (!Number.isFinite(weightNum) || weightNum <= 0) {
        errors.push(`Ligne ${i + 1} : poids invalide (« ${weight} »).`);
        continue;
      }
      weightValue = String(weightNum);
    }

    entries.push({
      shipTo: {
        name,
        addressLine1: address,
        city,
        postalCode,
        country: (country || 'FR').toUpperCase(),
      },
      packages: [
        {
          // Le poids reste requis par le formulaire : le type le fournira
          // côté backend, mais l'affichage a besoin d'une valeur.
          weight: weightValue ?? '',
          reference: reference || undefined,
          packageType: packageType || undefined,
        },
      ],
    });
  }

  return { entries, errors };
}

export default function BulkShipping() {
  const [entries, setEntries] = useState<BulkEntry[]>([emptyEntry()]);
  const [labelFormat, setLabelFormat] = useState('GIF');
  const [serviceCode, setServiceCode] = useState('11');
  // Expediteur du lot : absent tant qu'on n'a pas change, le backend applique
  // alors son adresse par defaut.
  const [editShipFrom, setEditShipFrom] = useState(false);
  const [shipFrom, setShipFrom] = useState<Address>({ country: 'FR' });
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const shipper = useQuery({
    queryKey: ['shipper'],
    queryFn: () => api.getShipper(),
    staleTime: Infinity,
    retry: false,
  });

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    staleTime: Infinity,
  });

  const mutation = useMutation<BulkResult, Error, void>({
    mutationFn: () =>
      api.createBulkShipments({
        shipments: entries.map((e) => ({ ...e, serviceCode })),
        labelFormat,
        shipFrom: editShipFrom ? shipFrom : undefined,
      }),
  });

  const update = (index: number, patch: Partial<BulkEntry['shipTo']>) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, shipTo: { ...e.shipTo, ...patch } } : e)),
    );
  };

  const updateWeight = (index: number, weight: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, packages: [{ ...e.packages[0], weight }] } : e)),
    );
  };

  const importCsv = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const { entries: parsed, errors } = parseCsv(String(reader.result));
      setCsvErrors(errors);
      if (parsed.length > 0) setEntries(parsed);
    };
    reader.readAsText(file);
    // Permet de réimporter le même fichier après correction.
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_EXAMPLE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-envois.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Une ligne est valide si elle porte un poids OU un type de colis : dans
   * ce second cas, le backend retrouve le poids dans le catalogue.
   */
  const invalid = entries.some((e) => {
    const pkg = e.packages[0];
    const weighed = pkg?.packageType
      ? true
      : Boolean(pkg?.weight) && Number(pkg.weight) > 0;

    return (
      !e.shipTo.name ||
      !e.shipTo.addressLine1 ||
      !e.shipTo.city ||
      !e.shipTo.postalCode ||
      !e.shipTo.country ||
      !weighed
    );
  });

  // Memes champs obligatoires que pour un destinataire : UPS les exige.
  const missingShipFrom = editShipFrom
    ? (['name', 'addressLine1', 'city', 'postalCode', 'country'] as const)
        .filter((f) => !shipFrom[f])
    : [];

  const blockedReason = entries.length === 0
    ? 'Ajoutez au moins un destinataire'
    : invalid
      ? 'Chaque ligne doit être complète (nom, adresse, ville, code postal, pays, et poids ou type)'
      : entries.length > 50
        ? '50 expéditions maximum par lot'
        : missingShipFrom.length
          ? `Expéditeur — champs manquants : ${missingShipFrom.join(', ')}`
          : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    mutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Envoi groupé"
        subtitle="Créez plusieurs expéditions en une seule fois, à la main ou depuis un fichier CSV."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            <FileDown className="h-4 w-4" />
            Modèle CSV
          </Button>
        }
      />

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardTitle
            title="Import CSV"
            hint={`Colonnes attendues : ${CSV_HEADER.replace(/;/g, ', ')} — « type » dispense de renseigner le poids`}
          />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[--k-border] bg-[--k-bg]/40 px-4 py-4 text-[13px] transition hover:border-[--k-primary]/40 hover:bg-[--k-primary-2]/20">
            <Upload className="h-4 w-4 text-[--k-primary]" />
            Choisir un fichier CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          </label>

          {csvErrors.length > 0 && (
            <Alert type="error" className="mt-3">
              <ul className="space-y-0.5">
                {csvErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {csvErrors.length > 5 && <li>… et {csvErrors.length - 5} autre(s)</li>}
              </ul>
            </Alert>
          )}
        </Card>

        <Card>
          <CardTitle title="Destinataires" hint={`${entries.length} envoi(s) à créer`} />

          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-xl border border-[--k-border] bg-[--k-bg]/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[--k-muted]">Envoi {i + 1}</span>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                      className="inline-flex items-center gap-1 text-[12px] text-[--k-danger] hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  )}
                </div>

                <AddressPicker
                  className="mb-2"
                  label="Remplir depuis le carnet"
                  onSelect={(address) => update(i, address)}
                />

                <div className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <Field
                      label="Nom"
                      required
                      value={entry.shipTo.name ?? ''}
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-8">
                    <Field
                      label="Adresse"
                      required
                      value={entry.shipTo.addressLine1 ?? ''}
                      onChange={(e) => update(i, { addressLine1: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Field
                      label="Ville"
                      required
                      value={entry.shipTo.city ?? ''}
                      onChange={(e) => update(i, { city: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Field
                      label="Code postal"
                      required
                      value={entry.shipTo.postalCode ?? ''}
                      onChange={(e) => update(i, { postalCode: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      label="Pays"
                      required
                      maxLength={2}
                      value={entry.shipTo.country ?? ''}
                      onChange={(e) => update(i, { country: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Field
                      label="Poids (kg)"
                      required={!entry.packages[0]?.packageType}
                      type="number"
                      step="0.1"
                      min="0.1"
                      // Un type nommé fournit le poids côté backend : le champ
                      // reste modifiable pour traiter un cas particulier.
                      placeholder={
                        entry.packages[0]?.packageType
                          ? `depuis ${entry.packages[0].packageType}`
                          : undefined
                      }
                      value={entry.packages[0]?.weight ?? ''}
                      onChange={(e) => updateWeight(i, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEntries((prev) => [...prev, emptyEntry()])}
            >
              <Plus className="h-4 w-4" />
              Ajouter un destinataire
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle title="Options communes" hint="Appliquées à toutes les expéditions du lot." />
          <div className="grid gap-3 sm:grid-cols-2">
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
              <option value="GIF">GIF (image)</option>
              <option value="PDF">PDF</option>
              <option value="ZPL">ZPL (imprimante thermique)</option>
            </SelectField>
          </div>

          {/* L'expéditeur vaut pour tout le lot : un envoi groupé part d'un
              seul endroit, et le répéter par ligne serait du bruit. */}
          <div className="mt-4 border-t border-[--k-border] pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-medium text-[--k-muted]">Expéditeur</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!editShipFrom && shipper.data?.shipper) {
                    const s = shipper.data.shipper;
                    setShipFrom({
                      name: s.name,
                      attentionName: s.attentionName,
                      addressLine1: s.addressLine,
                      city: s.city,
                      postalCode: s.postalCode,
                      state: s.state,
                      country: s.country || 'FR',
                    });
                  }
                  setEditShipFrom((v) => !v);
                }}
              >
                {editShipFrom ? 'Utiliser l’adresse par défaut' : 'Changer'}
              </Button>
            </div>

            {editShipFrom ? (
              <>
                <AddressPicker
                  className="mb-3"
                  label="Charger depuis le carnet"
                  onSelect={(address) => setShipFrom(address)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Nom"
                    required
                    value={shipFrom.name ?? ''}
                    onChange={(e) => setShipFrom((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Field
                    label="Adresse"
                    required
                    value={shipFrom.addressLine1 ?? ''}
                    onChange={(e) => setShipFrom((p) => ({ ...p, addressLine1: e.target.value }))}
                  />
                  <Field
                    label="Ville"
                    required
                    value={shipFrom.city ?? ''}
                    onChange={(e) => setShipFrom((p) => ({ ...p, city: e.target.value }))}
                  />
                  <Field
                    label="Code postal"
                    required
                    value={shipFrom.postalCode ?? ''}
                    onChange={(e) => setShipFrom((p) => ({ ...p, postalCode: e.target.value }))}
                  />
                  <Field
                    label="Pays (ISO 2)"
                    required
                    maxLength={2}
                    value={shipFrom.country ?? ''}
                    onChange={(e) =>
                      setShipFrom((p) => ({ ...p, country: e.target.value.toUpperCase() }))
                    }
                  />
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[--k-text]">
                {shipper.data?.shipper.name ?? 'Adresse par défaut'}
                {shipper.data?.shipper.city && (
                  <span className="text-[--k-muted]">
                    {' '}
                    — {shipper.data.shipper.postalCode} {shipper.data.shipper.city}
                  </span>
                )}
              </p>
            )}
          </div>

          <Alert type="info" className="mt-3">
            Chaque expédition est facturée par UPS. En environnement test, aucune facturation
            réelle n'a lieu.
          </Alert>

          <SubmitBar
            isLoading={mutation.isPending}
            blockedReason={blockedReason}
            icon={<Layers className="h-4 w-4" />}
          >
            Créer {entries.length} expédition(s)
          </SubmitBar>
        </Card>
      </form>

      {mutation.isError && (
        <Alert type="error" className="mt-4">
          {mutation.error.message}
        </Alert>
      )}

      {mutation.isSuccess && <BulkReport result={mutation.data} />}
    </div>
  );
}

function BulkReport({ result }: { result: BulkResult }) {
  // Étiquettes image de tout le lot, dans l'ordre des lignes du fichier.
  const labels = result.results
    .flatMap((r) => r.shipment?.packages ?? [])
    .map((p) => p.label)
    .filter((l): l is NonNullable<typeof l> => Boolean(l?.mime.startsWith('image/')));

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] px-4 py-3">
        <div className="flex flex-wrap gap-4">
          <span className="inline-flex items-center gap-1.5 text-[13px]">
            <CheckCircle2 className="h-4 w-4 text-[--k-success]" />
            <strong className="text-[--k-text]">{result.created}</strong> créée(s)
          </span>
          {result.failed > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <XCircle className="h-4 w-4 text-[--k-danger]" />
              <strong className="text-[--k-text]">{result.failed}</strong> en échec
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* Toutes les étiquettes du lot en une seule boîte de dialogue :
              une par page, plutôt qu'un dialogue par colis. */}
          {labels.length > 0 && (
            <Button type="button" size="sm" onClick={() => printImages(labels)}>
              <Printer className="h-4 w-4" />
              Imprimer les {labels.length} étiquettes
            </Button>
          )}
          <Link to="/shipments">
            <Button type="button" variant="secondary" size="sm">
              Voir les envois
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardTitle
          title="Détail du lot"
          hint={result.batchId}
          action={
            <Link to={`/batches/${encodeURIComponent(result.batchId)}`}>
              <Button type="button" variant="secondary" size="sm">
                <ClipboardList className="h-4 w-4" />
                Suivre cette commande
              </Button>
            </Link>
          }
        />
        <div className="space-y-1.5">
          {result.results.map((r) => (
            <div
              key={r.index}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                r.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <span className={r.ok ? 'text-green-800' : 'text-red-800'}>
                {r.index + 1}. {r.recipient || 'Destinataire'}
              </span>
              <span className={`font-mono ${r.ok ? 'text-green-700' : 'text-red-700'}`}>
                {r.ok
                  ? r.shipment?.packages[0]?.trackingNumber || 'Créée'
                  : r.error}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

