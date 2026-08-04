import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPinned, Search, Building2, Home, Sparkles, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { api, type AddressPayload } from '../services/api';
import type { AddressValidationResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import Button from '../components/ui/Button';

/** Référence stable : évite de recréer l'autocomplete à chaque rendu. */
const US_PR = ['us', 'pr'];

/** Adresse UPS de démonstration, utile pour tester sans chercher un cas valide. */
const SAMPLE: Address = {
  addressLine1: '2311 York Rd',
  city: 'Timonium',
  state: 'MD',
  postalCode: '21093',
  country: 'US',
};

export default function AddressValidation() {
  const [address, setAddress] = useState<Address>({ country: 'US' });
  const [requestOption, setRequestOption] = useState('3');

  const mutation = useMutation<AddressValidationResult, Error, AddressPayload>({
    mutationFn: (payload) => api.validateAddress(payload),
  });

  const set = (patch: Partial<Address>) => setAddress((prev) => ({ ...prev, ...patch }));

  const blockedReason =
    !address.postalCode && !address.city ? 'Renseignez une ville ou un code postal' : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    mutation.mutate({ address, requestOption: Number(requestOption) });
  };

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        title="Validation d'adresse"
        subtitle="Vérifie et normalise une adresse, et indique si elle est résidentielle ou professionnelle."
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAddress(SAMPLE)}
          >
            <Sparkles className="h-4 w-4" />
            Exemple
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
        {/* Colonne formulaire */}
        <form onSubmit={submit}>
          <Card>
            <CardTitle
              title="Adresse à vérifier"
              hint="Cette API UPS ne couvre que les États-Unis et Porto Rico."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AddressAutocomplete
                  label="Adresse ligne 1"
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
                  // L'API de validation UPS ne couvre que les États-Unis et Porto Rico.
                  countries={US_PR}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Adresse ligne 2"
                  placeholder="Bâtiment, étage…"
                  value={address.addressLine2 ?? ''}
                  onChange={(e) => set({ addressLine2: e.target.value })}
                />
              </div>
              <Field
                label="Ville"
                placeholder="Timonium"
                value={address.city ?? ''}
                onChange={(e) => set({ city: e.target.value })}
              />
              <Field
                label="État (code)"
                placeholder="MD"
                maxLength={2}
                value={address.state ?? ''}
                onChange={(e) => set({ state: e.target.value.toUpperCase() })}
              />
              <Field
                label="Code postal"
                placeholder="21093"
                value={address.postalCode ?? ''}
                onChange={(e) => set({ postalCode: e.target.value })}
              />
              <Field
                label="Pays (ISO 2)"
                required
                maxLength={2}
                value={address.country ?? ''}
                onChange={(e) => set({ country: e.target.value.toUpperCase() })}
              />
              <div className="sm:col-span-2">
                <SelectField
                  label="Traitement"
                  value={requestOption}
                  onChange={(e) => setRequestOption(e.target.value)}
                >
                  <option value="3">Validation + classification</option>
                  <option value="1">Validation seule</option>
                  <option value="2">Classification seule</option>
                </SelectField>
              </div>
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<Search className="h-4 w-4" />}
            >
              Valider l'adresse
            </SubmitBar>
          </Card>
        </form>

        {/* Colonne résultats */}
        <div className="lg:sticky lg:top-4">
          {mutation.isError ? (
            <Alert type="error">{mutation.error.message}</Alert>
          ) : mutation.isSuccess ? (
            <Result data={mutation.data} />
          ) : (
            <EmptyState
              icon={MapPinned}
              title="Aucune vérification lancée"
              description="Saisissez une adresse américaine puis lancez la validation. UPS renvoie la version normalisée et le type d'adresse."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Result({ data }: { data: AddressValidationResult }) {
  const verdict = data.valid
    ? { icon: CheckCircle2, tone: 'success' as const, text: 'Adresse valide' }
    : data.ambiguous
      ? { icon: HelpCircle, tone: 'info' as const, text: 'Adresse ambiguë' }
      : { icon: XCircle, tone: 'error' as const, text: 'Adresse introuvable' };

  const VerdictIcon = verdict.icon;

  const STYLES = {
    success: 'border-green-200 bg-green-50 text-green-800',
    info: 'border-indigo-200 bg-[--k-primary-2] text-indigo-900',
    error: 'border-red-200 bg-red-50 text-red-800',
  };

  // La classification UPS distingue commercial (1) de résidentiel (2).
  const residential = data.classification?.code === '2';

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${STYLES[verdict.tone]}`}>
        <VerdictIcon className="h-5 w-5 shrink-0" />
        <div>
          <p className="text-[14px] font-semibold">{verdict.text}</p>
          {data.ambiguous && (
            <p className="text-[12px] opacity-80">Plusieurs correspondances possibles.</p>
          )}
        </div>
      </div>

      {data.classification && (
        <div className="flex items-center gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] px-4 py-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              residential ? 'bg-orange-50' : 'bg-indigo-50'
            }`}
          >
            {residential ? (
              <Home className="h-4 w-4 text-orange-600" />
            ) : (
              <Building2 className="h-4 w-4 text-indigo-600" />
            )}
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[--k-muted]">Classification</p>
            <p className="text-[14px] font-semibold text-[--k-text]">
              {data.classification.description}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardTitle
          title={
            data.candidates.length > 1
              ? `${data.candidates.length} adresses proposées`
              : 'Adresse normalisée'
          }
        />
        {data.candidates.length === 0 ? (
          <p className="text-[12px] text-[--k-muted]">Aucune suggestion retournée par UPS.</p>
        ) : (
          <div className="space-y-2">
            {data.candidates.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-xl border border-[--k-border] p-3 transition hover:border-[--k-primary]/40 hover:bg-[--k-primary-2]/30"
              >
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-[--k-primary]" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[--k-text]">
                    {c.addressLines.join(', ')}
                  </p>
                  <p className="text-[12px] text-[--k-muted]">
                    {[c.city, c.state, c.postalCode, c.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
