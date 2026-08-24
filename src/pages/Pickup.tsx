import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Truck, CalendarCheck, Plus, Trash2, XCircle, CheckCircle2 } from 'lucide-react';
import { api, type PickupPayload } from '../services/api';
import type { PickupResult, PickupPiece, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { AddressPicker } from '../components/ui/AddressPicker';
import Button from '../components/ui/Button';
import { money } from '../utils/format';

/** Demain : un enlèvement ne peut pas être planifié dans le passé. */
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const emptyPiece = (): PickupPiece => ({ quantity: '1', containerCode: '01', serviceCode: '001' });

export default function Pickup() {
  const [address, setAddress] = useState<Address>({ country: 'FR' });
  const [pickupDate, setPickupDate] = useState(tomorrow());
  const [readyTime, setReadyTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [pieces, setPieces] = useState<PickupPiece[]>([emptyPiece()]);
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');

  const containers = useQuery({
    queryKey: ['containers'],
    queryFn: () => api.getContainers(),
    staleTime: Infinity,
  });

  const mutation = useMutation<PickupResult, Error, PickupPayload>({
    mutationFn: (payload) => api.createPickup(payload),
  });

  const cancelMutation = useMutation<{ success: boolean; message: string }, Error, string>({
    mutationFn: (prn) => api.cancelPickup(prn),
  });

  const set = (patch: Partial<Address>) => setAddress((prev) => ({ ...prev, ...patch }));

  const updatePiece = (index: number, patch: Partial<PickupPiece>) => {
    setPieces((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const missing = (['addressLine1', 'city', 'postalCode', 'country'] as const).filter(
    (f) => !address[f],
  );
  const invalidPiece = pieces.some((p) => !p.quantity || Number(p.quantity) <= 0);
  const pastDate = pickupDate < new Date().toISOString().slice(0, 10);

  const blockedReason = missing.length
    ? `Adresse incomplète : ${missing.join(', ')}`
    : pastDate
      ? 'La date d’enlèvement ne peut pas être dans le passé'
      : readyTime >= closeTime
        ? "L'heure de fermeture doit être après l'heure de disponibilité"
        : invalidPiece
          ? 'Chaque ligne doit avoir une quantité supérieure à 0'
          : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    mutation.mutate({
      address,
      pickupDate,
      readyTime,
      closeTime,
      pieces,
      contactName,
      companyName,
      phone,
    });
  };

  return (
    <div>
      <PageHeader
        title="Enlèvement à domicile"
        subtitle="Planifiez le passage d'un chauffeur UPS pour récupérer vos colis."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardTitle title="Adresse d'enlèvement" />
            <AddressPicker className="mb-3" onSelect={(address) => setAddress(address)} />
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <AddressAutocomplete
                  label="Adresse"
                  required
                  placeholder="Commencez à taper l'adresse…"
                  value={address.addressLine1 ?? ''}
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
                  required
                  value={address.city ?? ''}
                  onChange={(e) => set({ city: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Code postal"
                  required
                  value={address.postalCode ?? ''}
                  onChange={(e) => set({ postalCode: e.target.value })}
                />
              </div>
              <div className="sm:col-span-1">
                <Field
                  label="Pays"
                  required
                  maxLength={2}
                  value={address.country ?? ''}
                  onChange={(e) => set({ country: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="sm:col-span-3">
                <Field
                  label="Société"
                  placeholder="Laisser vide pour l'expéditeur par défaut"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Field
                  label="Contact sur place"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div className="sm:col-span-6">
                <Field
                  label="Téléphone"
                  placeholder="0102030405"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle title="Créneau" hint="Le chauffeur passera entre ces deux heures." />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Date"
                required
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
              <Field
                label="Colis prêts à"
                type="time"
                value={readyTime}
                onChange={(e) => setReadyTime(e.target.value)}
              />
              <Field
                label="Fermeture"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </div>
          </Card>

          <Card>
            <CardTitle title="Colis à enlever" hint={`${pieces.length} ligne(s)`} />
            <div className="space-y-2">
              {pieces.map((piece, i) => (
                <div key={i} className="rounded-xl border border-[--k-border] bg-[--k-bg]/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[--k-muted]">Ligne {i + 1}</span>
                    {pieces.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPieces((prev) => prev.filter((_, j) => j !== i))}
                        className="inline-flex items-center gap-1 text-[12px] text-[--k-danger] hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field
                      label="Quantité"
                      required
                      type="number"
                      min="1"
                      value={piece.quantity}
                      onChange={(e) => updatePiece(i, { quantity: e.target.value })}
                    />
                    <SelectField
                      label="Conditionnement"
                      value={piece.containerCode ?? '01'}
                      onChange={(e) => updatePiece(i, { containerCode: e.target.value })}
                    >
                      {(containers.data ?? [{ code: '01', name: 'Colis' }]).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </SelectField>
                    <Field
                      label="Pays de destination"
                      maxLength={2}
                      placeholder={address.country}
                      value={piece.destinationCountry ?? ''}
                      onChange={(e) =>
                        updatePiece(i, { destinationCountry: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPieces((prev) => [...prev, emptyPiece()])}
              >
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </Button>
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<CalendarCheck className="h-4 w-4" />}
            >
              Planifier l'enlèvement
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
                  <p className="text-[14px] font-semibold text-green-800">Enlèvement planifié</p>
                  <p className="font-mono text-[12px] text-green-700">
                    {mutation.data.confirmationNumber}
                  </p>
                </div>
              </div>

              {mutation.data.charge != null && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] px-4 py-3">
                  <span className="text-[12px] text-[--k-muted]">Frais d'enlèvement</span>
                  <span className="text-[18px] font-bold text-[--k-text]">
                    {money(mutation.data.charge, mutation.data.currency || 'EUR')}
                  </span>
                </div>
              )}

              <Card>
                <p className="mb-3 text-[12px] text-[--k-muted]">
                  Conservez le numéro de confirmation : il est nécessaire pour annuler.
                </p>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  isLoading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(mutation.data.confirmationNumber)}
                >
                  {!cancelMutation.isPending && <XCircle className="h-4 w-4" />}
                  Annuler cet enlèvement
                </Button>

                {cancelMutation.isError && (
                  <Alert type="error" className="mt-3">
                    {cancelMutation.error.message}
                  </Alert>
                )}
                {cancelMutation.isSuccess && (
                  <Alert
                    type={cancelMutation.data.success ? 'success' : 'error'}
                    className="mt-3"
                  >
                    {cancelMutation.data.message}
                  </Alert>
                )}
              </Card>
            </div>
          ) : (
            <EmptyState
              icon={Truck}
              title="Aucun enlèvement planifié"
              description="Renseignez l'adresse, le créneau et les colis à récupérer, puis validez pour réserver le passage d'un chauffeur UPS."
            />
          )}
        </div>
      </div>
    </div>
  );
}
